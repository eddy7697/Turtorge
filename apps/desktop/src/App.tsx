import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "./app/ThemeProvider";
import { ConfirmQuitDialog } from "./components/dialogs/ConfirmQuitDialog";
import { CreateWorkspaceDialog } from "./components/dialogs/CreateWorkspaceDialog";
import { NewTerminalDialog } from "./components/dialogs/NewTerminalDialog";
import { QuickOpenDialog } from "./components/dialogs/QuickOpenDialog";
import { RenameWorkspaceDialog } from "./components/dialogs/RenameWorkspaceDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import { WorkspaceHeader } from "./components/shell/WorkspaceHeader";
import { WorkspaceSidebar } from "./components/shell/WorkspaceSidebar";
import { TerminalWorkspace } from "./components/terminals/TerminalWorkspace";
import { TerminalActions, type TerminalActionRequest } from "./components/terminals/TerminalActions";
import { ContextMenu, type ContextMenuPoint } from "./components/ui/ContextMenu";
import { closeTerminal, isTauri, startTerminal, terminateAllTerminals } from "./lib/api";
import {
  addTerminalToPane,
  findPane,
  firstPaneId,
  moveTerminal,
  paneCount,
  removePaneFromLayout,
  removeTerminalFromLayout,
  setActiveTerminal,
  splitPane,
  updateSplitRatio,
} from "./lib/layout";
import { selectActiveWorkspace, useAppStore } from "./stores/appStore";
import type { SplitDirection, TerminalDefinition, TerminalEvent, Workspace } from "./types";

type DialogName = "createWorkspace" | "newTerminal" | "settings" | "quickOpen" | "quit" | null;

export default function App() {
  const settings = useAppStore((state) => state.settings);
  return <ThemeProvider preference={settings.theme}><TurtorgeApp /></ThemeProvider>;
}

function TurtorgeApp() {
  const initialized = useAppStore((state) => state.initialized);
  const loading = useAppStore((state) => state.loading);
  const workspaces = useAppStore((state) => state.workspaces);
  const workspace = useAppStore(selectActiveWorkspace);
  const settings = useAppStore((state) => state.settings);
  const windowsShells = useAppStore((state) => state.windowsShells);
  const wslDistributions = useAppStore((state) => state.wslDistributions);
  const launcherProfiles = useAppStore((state) => state.launcherProfiles);
  const runtimes = useAppStore((state) => state.runtimes);
  const errors = useAppStore((state) => state.errors);
  const pendingConnections = useAppStore((state) => state.pendingConnections);
  const sidebarCollapsed = useAppStore((state) => state.sidebarCollapsed);
  const initialize = useAppStore((state) => state.initialize);
  const selectWorkspace = useAppStore((state) => state.selectWorkspace);
  const saveWorkspace = useAppStore((state) => state.saveWorkspace);
  const deleteWorkspace = useAppStore((state) => state.deleteWorkspace);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setRuntime = useAppStore((state) => state.setRuntime);
  const setRuntimeStatus = useAppStore((state) => state.setRuntimeStatus);
  const setTerminalError = useAppStore((state) => state.setTerminalError);
  const requestTerminalStart = useAppStore((state) => state.requestTerminalStart);
  const removeRuntime = useAppStore((state) => state.removeRuntime);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [newTerminalTarget, setNewTerminalTarget] = useState<{ workspaceId: string; paneId: string } | null>(null);
  const [terminalActionRequest, setTerminalActionRequest] = useState<TerminalActionRequest | null>(null);
  const [workspaceMenu, setWorkspaceMenu] = useState<{ workspace: Workspace; point: ContextMenuPoint } | null>(null);
  const [renamingWorkspace, setRenamingWorkspace] = useState<Workspace | null>(null);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const [terminalFocusRequest, setTerminalFocusRequest] = useState<{ terminalId: string; sequence: number } | null>(null);
  const terminalFocusSequence = useRef(0);
  const autoStartAttempted = useRef(new Set<string>());

  useEffect(() => { void initialize(); }, [initialize]);
  useEffect(() => { setLayoutError(null); }, [workspace?.id]);

  const requestQuit = useCallback(() => {
    const running = Object.values(useAppStore.getState().runtimes).filter((runtime) => runtime.status === "running" || runtime.status === "starting");
    if (running.length > 0 && useAppStore.getState().settings.confirmBeforeClose) setDialog("quit");
    else void finishQuit();
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      requestQuit();
    }).then((dispose) => { unlisten = dispose; });
    return () => unlisten?.();
  }, [requestQuit]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === "b") { event.preventDefault(); toggleSidebar(); }
      if (event.ctrlKey && event.key.toLowerCase() === "p") { event.preventDefault(); setDialog("quickOpen"); }
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") { event.preventDefault(); if (workspace) { setNewTerminalTarget({ workspaceId: workspace.id, paneId: firstPaneId(workspace.layout) }); setDialog("newTerminal"); } }
      if (event.ctrlKey && event.key === ",") { event.preventDefault(); setDialog("settings"); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar, workspace]);

  useEffect(() => {
    if (!workspace) return;
    for (const definition of workspace.terminals.filter((terminal) => terminal.autoStart)) {
      if (runtimes[definition.id] || autoStartAttempted.current.has(definition.id)) continue;
      autoStartAttempted.current.add(definition.id);
      const onEvent = (event: TerminalEvent) => {
        if (event.event === "status") setRuntimeStatus(definition.id, event.data);
        else if (event.event === "exited") setRuntimeStatus(definition.id, "exited", event.data.exitCode);
        else if (event.event === "error") setTerminalError(definition.id, event.data.message);
      };
      void startTerminal(
        { workspaceId: workspace.id, definition, workspaceEnvironment: workspace.environmentVariables, cols: 80, rows: 24 },
        `auto-start:${definition.id}:${crypto.randomUUID()}`,
        onEvent,
      )
        .then(setRuntime)
        .catch((error) => setTerminalError(definition.id, String(error?.message ?? error)));
    }
  }, [runtimes, setRuntime, setRuntimeStatus, setTerminalError, workspace]);

  const persist = async (next: Workspace) => { await saveWorkspace({ ...next, updatedAt: new Date().toISOString() }); };
  const persistLayout = async (next: Workspace) => {
    setLayoutError(null);
    try {
      await persist(next);
    } catch (reason) {
      const message = messageFromReason(reason);
      setLayoutError(message);
      throw reason;
    }
  };
  const openNewTerminal = (targetWorkspace: Workspace | undefined, paneId?: string) => {
    if (!targetWorkspace) return;
    setNewTerminalTarget({ workspaceId: targetWorkspace.id, paneId: paneId ?? firstPaneId(targetWorkspace.layout) });
    setDialog("newTerminal");
  };
  const createTerminal = async (definition: TerminalDefinition) => {
    const targetWorkspace = useAppStore.getState().workspaces.find((item) => item.id === newTerminalTarget?.workspaceId);
    if (!targetWorkspace) return;
    const paneId = newTerminalTarget?.paneId ?? firstPaneId(targetWorkspace.layout);
    await persist({ ...targetWorkspace, terminals: [...targetWorkspace.terminals, definition], layout: addTerminalToPane(targetWorkspace.layout, paneId, definition.id) });
    requestTerminalStart(definition.id);
  };
  const selectTerminal = (targetWorkspace: Workspace, paneId: string, terminalId: string) => void persistLayout({
    ...targetWorkspace,
    layout: setActiveTerminal(targetWorkspace.layout, paneId, terminalId),
  }).catch(() => undefined);
  const selectSidebarTerminal = async (workspaceId: string, paneId: string, terminalId: string) => {
    if (useAppStore.getState().activeWorkspaceId !== workspaceId) await selectWorkspace(workspaceId);
    const targetWorkspace = useAppStore.getState().workspaces.find((item) => item.id === workspaceId);
    if (!targetWorkspace) return;
    await persistLayout({
      ...targetWorkspace,
      layout: setActiveTerminal(targetWorkspace.layout, paneId, terminalId),
    });
    terminalFocusSequence.current += 1;
    setTerminalFocusRequest({ terminalId, sequence: terminalFocusSequence.current });
  };
  const split = (targetWorkspace: Workspace, paneId: string, direction: SplitDirection) => void persistLayout({
    ...targetWorkspace,
    layout: splitPane(targetWorkspace.layout, paneId, direction),
  }).catch(() => undefined);
  const ratioChange = (targetWorkspace: Workspace, splitId: string, ratio: number) => void persistLayout({
    ...targetWorkspace,
    layout: updateSplitRatio(targetWorkspace.layout, splitId, ratio),
  }).catch(() => undefined);
  const moveTerminalTab = async (targetWorkspace: Workspace, sourcePaneId: string, targetPaneId: string, terminalId: string, targetIndex: number) => {
    await persistLayout({
      ...targetWorkspace,
      layout: moveTerminal(targetWorkspace.layout, sourcePaneId, targetPaneId, terminalId, targetIndex),
    });
  };
  const deletePane = async (targetWorkspace: Workspace, paneId: string) => {
    if (paneCount(targetWorkspace.layout) <= 1) return;
    const pane = findPane(targetWorkspace.layout, paneId);
    if (!pane) return;
    const definitions = pane.terminalIds
      .map((terminalId) => targetWorkspace.terminals.find((terminal) => terminal.id === terminalId))
      .filter((terminal): terminal is TerminalDefinition => Boolean(terminal));
    const transitioning = definitions.some((definition) => {
      const status = runtimes[definition.id]?.status;
      return status === "starting" || status === "stopping" || (pendingConnections[definition.id] ?? 0) > 0;
    });
    if (transitioning) {
      const reason = new Error("Wait for terminals to finish starting or stopping, then try again.");
      setLayoutError(reason.message);
      throw reason;
    }

    for (const definition of definitions) {
      const current = useAppStore.getState().runtimes[definition.id];
      if (current?.status === "running") {
        try {
          await closeTerminal(current.id);
          removeRuntime(definition.id);
        } catch (reason) {
          setLayoutError(messageFromReason(reason));
          throw reason;
        }
      }
    }

    await persistLayout({
      ...targetWorkspace,
      terminals: targetWorkspace.terminals.filter((terminal) => !pane.terminalIds.includes(terminal.id)),
      layout: removePaneFromLayout(targetWorkspace.layout, paneId),
    });
    for (const definition of definitions) removeRuntime(definition.id);
  };
  const removeTerminal = async (targetWorkspace: Workspace, terminalId: string) => {
    await persistLayout({ ...targetWorkspace, terminals: targetWorkspace.terminals.filter((terminal) => terminal.id !== terminalId), layout: removeTerminalFromLayout(targetWorkspace.layout, terminalId) });
  };
  const renameTerminal = async (targetWorkspace: Workspace, terminalId: string, name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    await persist({
      ...targetWorkspace,
      terminals: targetWorkspace.terminals.map((terminal) =>
        terminal.id === terminalId ? { ...terminal, name: normalized } : terminal,
      ),
    });
  };
  const editTerminal = async (targetWorkspace: Workspace, definition: TerminalDefinition) => {
    await persist({
      ...targetWorkspace,
      terminals: targetWorkspace.terminals.map((terminal) =>
        terminal.id === definition.id ? definition : terminal,
      ),
    });
  };
  const renameWorkspace = async (targetWorkspace: Workspace, name: string) => {
    const normalized = name.trim();
    if (!normalized) return;
    await persist({ ...targetWorkspace, name: normalized });
  };
  const openWorkspaceTerminalDialog = async (targetWorkspace: Workspace) => {
    setWorkspaceMenu(null);
    if (useAppStore.getState().activeWorkspaceId !== targetWorkspace.id) await selectWorkspace(targetWorkspace.id);
    openNewTerminal(targetWorkspace);
  };
  const createWorkspace = async (created: Workspace) => {
    await saveWorkspace(created);
    await selectWorkspace(created.id);
    const initialTerminal = created.terminals[0];
    if (initialTerminal) requestTerminalStart(initialTerminal.id);
  };
  const deleteLauncherProfile = async (profileId: string, nextSettings: typeof settings) => {
    const affected = useAppStore.getState().workspaces.filter((item) =>
      item.terminals.some((terminal) => terminal.launcherProfileId === profileId),
    );
    for (const item of affected) {
      await saveWorkspace({
        ...item,
        terminals: item.terminals.map((terminal) =>
          terminal.launcherProfileId === profileId
            ? { ...terminal, launcherProfileId: null }
            : terminal,
        ),
        updatedAt: new Date().toISOString(),
      });
    }
    await updateSettings(nextSettings);
  };

  const runningCount = Object.values(runtimes).filter((runtime) => runtime.status === "running" || runtime.status === "starting").length;
  const runningWorkspaceCount = workspaces.filter((item) => item.terminals.some((terminal) => {
    const status = runtimes[terminal.id]?.status;
    return status === "running" || status === "starting";
  })).length;
  const newTerminalWorkspace = workspaces.find((item) => item.id === newTerminalTarget?.workspaceId);
  const terminalContextTargetId = terminalActionRequest?.kind === "menu" ? terminalActionRequest.target.definition.id : null;

  if (!initialized || loading) return <div className="boot-screen"><img src="/logo.png" alt="Turtorge" /><span className="loading-line" /><div className="boot-status" role="status" aria-live="polite"><strong>Preparing your terminal environments…</strong><small>Detecting PowerShell and WSL quietly in the background.</small></div></div>;

  return (
    <div className="app-shell">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} onQuickOpen={() => setDialog("quickOpen")} onNewTerminal={() => openNewTerminal(workspace)} onSettings={() => setDialog("settings")} onRequestQuit={requestQuit} />
      <div className="app-body">
        <WorkspaceSidebar workspaces={workspaces} activeWorkspaceId={workspace?.id ?? null} runtimes={runtimes} errors={errors} pendingConnections={pendingConnections} collapsed={sidebarCollapsed} onSelect={(id) => void selectWorkspace(id)} onSelectTerminal={(workspaceId, paneId, terminalId) => void selectSidebarTerminal(workspaceId, paneId, terminalId).catch(() => undefined)} workspaceContextTargetId={workspaceMenu?.workspace.id ?? null} terminalContextTargetId={terminalContextTargetId} onWorkspaceContextMenu={(targetWorkspace, point) => { setTerminalActionRequest(null); setWorkspaceMenu({ workspace: targetWorkspace, point }); }} onTerminalContextMenu={(targetWorkspace, definition, point) => { setWorkspaceMenu(null); setTerminalActionRequest({ kind: "menu", target: { workspace: targetWorkspace, definition }, point }); }} onCreate={() => setDialog("createWorkspace")} onSettings={() => setDialog("settings")} />
        <main className="main-content">
          {workspace ? <><WorkspaceHeader workspace={workspace} runtimes={runtimes} onNewTerminal={() => openNewTerminal(workspace)} /><div className="workspace-terminal-deck">{workspaces.map((item) => {
            const isActive = item.id === workspace.id;
            return <div key={item.id} className={`workspace-terminal-layer ${isActive ? "active" : "inactive"}`} aria-hidden={!isActive}>
              <TerminalWorkspace
                workspace={item}
                visible={isActive}
                layoutError={isActive ? layoutError : null}
                terminalFocusRequest={isActive ? terminalFocusRequest : null}
                onDismissLayoutError={() => setLayoutError(null)}
                onSelectTerminal={(paneId, terminalId) => selectTerminal(item, paneId, terminalId)}
                onNewTerminal={(paneId) => openNewTerminal(item, paneId)}
                onSplit={(paneId, direction) => split(item, paneId, direction)}
                onRatioChange={(splitId, ratio) => ratioChange(item, splitId, ratio)}
                onMoveTerminal={(sourcePaneId, targetPaneId, terminalId, targetIndex) => moveTerminalTab(item, sourcePaneId, targetPaneId, terminalId, targetIndex)}
                onDeletePane={(paneId) => deletePane(item, paneId)}
                onRenameTerminal={(terminalId, name) => renameTerminal(item, terminalId, name)}
                terminalContextTargetId={terminalActionRequest?.kind === "menu" && terminalActionRequest.target.workspace.id === item.id ? terminalContextTargetId : null}
                onTerminalContextMenu={(definition, point) => { setWorkspaceMenu(null); setTerminalActionRequest({ kind: "menu", target: { workspace: item, definition }, point }); }}
                onOpenLauncherSettings={() => setDialog("settings")}
              />
            </div>;
          })}</div></> : <EmptyState onCreate={() => setDialog("createWorkspace")} />}
        </main>
      </div>
      <StatusBar workspace={workspace} runtimes={runtimes} />

      {dialog === "createWorkspace" && <CreateWorkspaceDialog windowsShells={windowsShells} wslDistributions={wslDistributions} launcherProfiles={launcherProfiles} globalDefaultLauncherId={settings.defaultLauncherProfileId} onClose={() => setDialog(null)} onCreate={createWorkspace} />}
      {dialog === "newTerminal" && newTerminalWorkspace && <NewTerminalDialog workspace={newTerminalWorkspace} windowsShells={windowsShells} wslDistributions={wslDistributions} launcherProfiles={launcherProfiles} globalDefaultLauncherId={settings.defaultLauncherProfileId} onClose={() => { setDialog(null); setNewTerminalTarget(null); }} onCreate={createTerminal} />}
      {dialog === "settings" && <SettingsDialog settings={settings} launcherProfiles={launcherProfiles} workspaces={workspaces} windowsShells={windowsShells} wslDistributions={wslDistributions} onChange={updateSettings} onDeleteProfile={deleteLauncherProfile} onClose={() => setDialog(null)} />}
      {dialog === "quickOpen" && <QuickOpenDialog workspaces={workspaces} onSelect={(id) => void selectWorkspace(id)} onClose={() => setDialog(null)} />}
      {dialog === "quit" && <ConfirmQuitDialog workspaceCount={runningWorkspaceCount} terminalCount={runningCount} onCancel={() => setDialog(null)} onConfirm={() => void finishQuit()} />}

      {workspaceMenu && <ContextMenu point={workspaceMenu.point} label={`${workspaceMenu.workspace.name} workspace actions`} onClose={() => setWorkspaceMenu(null)} entries={[
        { type: "item", key: "new-terminal", label: "New Terminal", icon: <Plus size={14} />, onSelect: () => void openWorkspaceTerminalDialog(workspaceMenu.workspace).catch(() => undefined) },
        { type: "item", key: "rename-workspace", label: "Rename Workspace", icon: <Pencil size={14} />, onSelect: () => { setRenamingWorkspace(workspaceMenu.workspace); setWorkspaceMenu(null); } },
      ]} />}
      {renamingWorkspace && <RenameWorkspaceDialog workspace={renamingWorkspace} onSave={(name) => renameWorkspace(renamingWorkspace, name)} onClose={() => setRenamingWorkspace(null)} />}
      <TerminalActions request={terminalActionRequest} onRequestChange={setTerminalActionRequest} onRename={renameTerminal} onEdit={editTerminal} onRemove={removeTerminal} onOpenLauncherSettings={() => setDialog("settings")} />
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return <section className="empty-state"><div className="empty-logo-crop"><img src="/logo.png" alt="Turtorge turtle" /></div><h1>Bring every development workspace home.</h1><p>Open a project with its shell, terminals, agents, and layout already where they belong.</p><div><button className="primary-button large" onClick={onCreate}><Plus size={15} /> Create Workspace</button><button className="secondary-button large" onClick={onCreate}><FolderOpen size={15} /> Open Folder</button></div></section>;
}

async function finishQuit() {
  await terminateAllTerminals();
  if (isTauri()) await getCurrentWindow().destroy();
}

function messageFromReason(reason: unknown): string {
  if (typeof reason === "object" && reason && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }
  return String(reason);
}
