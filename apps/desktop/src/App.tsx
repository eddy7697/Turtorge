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
import { isTauri, startTerminal, terminateAllTerminals } from "./lib/api";
import { addTerminalToPane, firstPaneId, removeTerminalFromLayout, setActiveTerminal, splitPane, updateSplitRatio } from "./lib/layout";
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
  const runtimes = useAppStore((state) => state.runtimes);
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
  const [dialog, setDialog] = useState<DialogName>(null);
  const [targetPaneId, setTargetPaneId] = useState<string | null>(null);
  const autoStartAttempted = useRef(new Set<string>());

  useEffect(() => { void initialize(); }, [initialize]);

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
      void startTerminal({ workspaceId: workspace.id, definition, workspaceEnvironment: workspace.environmentVariables, cols: 80, rows: 24 }, onEvent)
        .then(setRuntime)
        .catch((error) => setTerminalError(definition.id, String(error?.message ?? error)));
    }
  }, [runtimes, setRuntime, setRuntimeStatus, setTerminalError, workspace]);

  const persist = async (next: Workspace) => { await saveWorkspace({ ...next, updatedAt: new Date().toISOString() }); };
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
  const selectTerminal = (paneId: string, terminalId: string) => workspace && void persist({ ...workspace, layout: setActiveTerminal(workspace.layout, paneId, terminalId) });
  const split = (paneId: string, direction: SplitDirection) => workspace && void persist({ ...workspace, layout: splitPane(workspace.layout, paneId, direction) });
  const ratioChange = (splitId: string, ratio: number) => workspace && void persist({ ...workspace, layout: updateSplitRatio(workspace.layout, splitId, ratio) });
  const removeTerminal = async (terminalId: string) => {
    if (!workspace) return;
    await persist({ ...workspace, terminals: workspace.terminals.filter((terminal) => terminal.id !== terminalId), layout: removeTerminalFromLayout(workspace.layout, terminalId) });
  };
  const createWorkspace = async (created: Workspace) => {
    await saveWorkspace(created);
    await selectWorkspace(created.id);
    const initialTerminal = created.terminals[0];
    if (initialTerminal) requestTerminalStart(initialTerminal.id);
  };

  const runningCount = Object.values(runtimes).filter((runtime) => runtime.status === "running" || runtime.status === "starting").length;
  const runningWorkspaceCount = workspaces.filter((item) => item.terminals.some((terminal) => {
    const status = runtimes[terminal.id]?.status;
    return status === "running" || status === "starting";
  })).length;

  if (!initialized || loading) return <div className="boot-screen"><img src="/logo.png" alt="Turtorge" /><span className="loading-line" /></div>;

  return (
    <div className="app-shell">
      <TitleBar sidebarCollapsed={sidebarCollapsed} onToggleSidebar={toggleSidebar} onQuickOpen={() => setDialog("quickOpen")} onNewTerminal={() => openNewTerminal()} onSettings={() => setDialog("settings")} onRequestQuit={requestQuit} />
      <div className="app-body">
        <WorkspaceSidebar workspaces={workspaces} activeWorkspaceId={workspace?.id ?? null} runtimes={runtimes} collapsed={sidebarCollapsed} onSelect={(id) => void selectWorkspace(id)} onCreate={() => setDialog("createWorkspace")} onSettings={() => setDialog("settings")} />
        <main className="main-content">
          {workspace ? <><WorkspaceHeader workspace={workspace} runtimes={runtimes} onNewTerminal={() => openNewTerminal()} /><TerminalWorkspace workspace={workspace} onSelectTerminal={selectTerminal} onNewTerminal={openNewTerminal} onSplit={split} onRatioChange={ratioChange} onRemoveTerminal={removeTerminal} /></> : <EmptyState onCreate={() => setDialog("createWorkspace")} />}
        </main>
      </div>
      <StatusBar workspace={workspace} runtimes={runtimes} />

      {dialog === "createWorkspace" && <CreateWorkspaceDialog windowsShells={windowsShells} wslDistributions={wslDistributions} onClose={() => setDialog(null)} onCreate={createWorkspace} />}
      {dialog === "newTerminal" && workspace && <NewTerminalDialog workspace={workspace} windowsShells={windowsShells} wslDistributions={wslDistributions} onClose={() => setDialog(null)} onCreate={createTerminal} />}
      {dialog === "settings" && <SettingsDialog settings={settings} windowsShells={windowsShells} wslDistributions={wslDistributions} onChange={(next) => void updateSettings(next)} onClose={() => setDialog(null)} />}
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
