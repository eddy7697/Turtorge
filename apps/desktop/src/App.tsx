import { getCurrentWindow } from "@tauri-apps/api/window";
import { FolderOpen, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ThemeProvider } from "./app/ThemeProvider";
import { ConfirmQuitDialog } from "./components/dialogs/ConfirmQuitDialog";
import { CreateWorkspaceDialog } from "./components/dialogs/CreateWorkspaceDialog";
import { NewTerminalDialog } from "./components/dialogs/NewTerminalDialog";
import { QuickOpenDialog } from "./components/dialogs/QuickOpenDialog";
import { SettingsDialog } from "./components/dialogs/SettingsDialog";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import { WorkspaceHeader } from "./components/shell/WorkspaceHeader";
import { WorkspaceSidebar } from "./components/shell/WorkspaceSidebar";
import { TerminalWorkspace } from "./components/terminals/TerminalWorkspace";
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
  const [targetPaneId, setTargetPaneId] = useState<string | null>(null);
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
      if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === "t") { event.preventDefault(); if (workspace) { setTargetPaneId(firstPaneId(workspace.layout)); setDialog("newTerminal"); } }
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
  const openNewTerminal = (paneId?: string) => {
    if (!workspace) return;
    setTargetPaneId(paneId ?? firstPaneId(workspace.layout));
    setDialog("newTerminal");
  };
  const createTerminal = async (definition: TerminalDefinition) => {
    if (!workspace) return;
    const paneId = targetPaneId ?? firstPaneId(workspace.layout);
    await persist({ ...workspace, terminals: [...workspace.terminals, definition], layout: addTerminalToPane(workspace.layout, paneId, definition.id) });
    requestTerminalStart(definition.id);
  };
  const selectTerminal = (paneId: string, terminalId: string) => workspace && void persistLayout({ ...workspace, layout: setActiveTerminal(workspace.layout, paneId, terminalId) }).catch(() => undefined);
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
  const split = (paneId: string, direction: SplitDirection) => workspace && void persistLayout({ ...workspace, layout: splitPane(workspace.layout, paneId, direction) }).catch(() => undefined);
  const ratioChange = (splitId: string, ratio: number) => workspace && void persistLayout({ ...workspace, layout: updateSplitRatio(workspace.layout, splitId, ratio) }).catch(() => undefined);
  const moveTerminalTab = async (sourcePaneId: string, targetPaneId: string, terminalId: string, targetIndex: number) => {
    if (!workspace) return;
    await persistLayout({
      ...workspace,
      layout: moveTerminal(workspace.layout, sourcePaneId, targetPaneId, terminalId, targetIndex),
    });
  };
  const deletePane = async (paneId: string) => {
    if (!workspace || paneCount(workspace.layout) <= 1) return;
    const pane = findPane(workspace.layout, paneId);
    if (!pane) return;
    const definitions = pane.terminalIds
      .map((terminalId) => workspace.terminals.find((terminal) => terminal.id === terminalId))
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
      ...workspace,
      terminals: workspace.terminals.filter((terminal) => !pane.terminalIds.includes(terminal.id)),
      layout: removePaneFromLayout(workspace.layout, paneId),
    });
    for (const definition of definitions) removeRuntime(definition.id);
  };
  const removeTerminal = async (terminalId: string) => {
    if (!workspace) return;
    await persistLayout({ ...workspace, terminals: workspace.terminals.filter((terminal) => terminal.id !== terminalId), layout: removeTerminalFromLayout(workspace.layout, terminalId) });
  };
  const renameTerminal = async (terminalId: string, name: string) => {
    if (!workspace) return;
    const normalized = name.trim();
    if (!normalized) return;
    await persist({
      ...workspace,
      terminals: workspace.terminals.map((terminal) =>
        terminal.id === terminalId ? { ...terminal, name: normalized } : terminal,
      ),
    });
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

  if (!initialized || loading) return <div className="boot-screen"><img src="/logo.png" alt="Turtorge" /><span className="loading-line" /><div className="boot-status" role="status" aria-live="polite"><strong>Preparing your terminal environments…</strong><small>Detecting PowerShell and WSL quietly in the background.</small></div></div>;

  return (
    <div className="app-shell">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} onQuickOpen={() => setDialog("quickOpen")} onNewTerminal={() => openNewTerminal()} onSettings={() => setDialog("settings")} onRequestQuit={requestQuit} />
      <div className="app-body">
        <WorkspaceSidebar workspaces={workspaces} activeWorkspaceId={workspace?.id ?? null} runtimes={runtimes} errors={errors} pendingConnections={pendingConnections} collapsed={sidebarCollapsed} onSelect={(id) => void selectWorkspace(id)} onSelectTerminal={(workspaceId, paneId, terminalId) => void selectSidebarTerminal(workspaceId, paneId, terminalId).catch(() => undefined)} onCreate={() => setDialog("createWorkspace")} onSettings={() => setDialog("settings")} />
        <main className="main-content">
          {workspace ? <><WorkspaceHeader workspace={workspace} runtimes={runtimes} onNewTerminal={() => openNewTerminal()} /><TerminalWorkspace workspace={workspace} layoutError={layoutError} terminalFocusRequest={terminalFocusRequest} onDismissLayoutError={() => setLayoutError(null)} onSelectTerminal={selectTerminal} onNewTerminal={openNewTerminal} onSplit={split} onRatioChange={ratioChange} onMoveTerminal={moveTerminalTab} onDeletePane={deletePane} onRemoveTerminal={removeTerminal} onRenameTerminal={renameTerminal} /></> : <EmptyState onCreate={() => setDialog("createWorkspace")} />}
        </main>
      </div>
      <StatusBar workspace={workspace} runtimes={runtimes} />

      {dialog === "createWorkspace" && <CreateWorkspaceDialog windowsShells={windowsShells} wslDistributions={wslDistributions} onClose={() => setDialog(null)} onCreate={createWorkspace} />}
      {dialog === "newTerminal" && workspace && <NewTerminalDialog workspace={workspace} windowsShells={windowsShells} wslDistributions={wslDistributions} onClose={() => setDialog(null)} onCreate={createTerminal} />}
      {dialog === "settings" && <SettingsDialog settings={settings} launcherProfiles={launcherProfiles} workspaces={workspaces} windowsShells={windowsShells} wslDistributions={wslDistributions} onChange={updateSettings} onDeleteProfile={deleteLauncherProfile} onClose={() => setDialog(null)} />}
      {dialog === "quickOpen" && <QuickOpenDialog workspaces={workspaces} onSelect={(id) => void selectWorkspace(id)} onClose={() => setDialog(null)} />}
      {dialog === "quit" && <ConfirmQuitDialog workspaceCount={runningWorkspaceCount} terminalCount={runningCount} onCancel={() => setDialog(null)} onConfirm={() => void finishQuit()} />}
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
