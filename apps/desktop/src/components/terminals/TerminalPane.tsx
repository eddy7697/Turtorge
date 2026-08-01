import { AlertCircle, AlertTriangle, Columns2, FolderOpen, LoaderCircle, Pencil, Play, Plus, RotateCw, Rows2, Settings2, Trash2, X } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type DragEvent as ReactDragEvent, type FormEvent, type WheelEvent as ReactWheelEvent } from "react";
import { closeTerminal, openLauncher } from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { PaneNode, SplitDirection, TerminalDefinition, Workspace } from "../../types";
import { EditTerminalDialog } from "../dialogs/EditTerminalDialog";
import { LauncherSetupDialog } from "../dialogs/LauncherSetupDialog";
import { LauncherLogo } from "../ui/LauncherLogo";
import { Modal } from "../ui/Modal";
import { XtermView } from "./XtermView";

export function TerminalPane({
  pane,
  workspace,
  terminalFocusRequest,
  canDeletePane,
  dragging,
  dropTarget,
  onSelectTerminal,
  onNewTerminal,
  onSplit,
  onDeletePane,
  onRemoveTerminal,
  onRenameTerminal,
  onEditTerminal,
  onOpenLauncherSettings,
  onTabDragStart,
  onTabDragEnd,
  onTabDragOver,
  onTabDrop,
}: {
  pane: PaneNode;
  workspace: Workspace;
  terminalFocusRequest?: { terminalId: string; sequence: number } | null;
  canDeletePane: boolean;
  dragging: { paneId: string; terminalId: string } | null;
  dropTarget: { paneId: string; index: number } | null;
  onSelectTerminal: (paneId: string, terminalId: string) => void;
  onNewTerminal: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onDeletePane: (paneId: string) => Promise<void>;
  onRemoveTerminal: (terminalId: string) => Promise<void>;
  onRenameTerminal: (terminalId: string, name: string) => Promise<void>;
  onEditTerminal: (definition: TerminalDefinition) => Promise<void>;
  onOpenLauncherSettings: () => void;
  onTabDragStart: (paneId: string, terminalId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (paneId: string, index: number) => void;
  onTabDrop: (paneId: string, index: number) => void;
}) {
  const runtimes = useAppStore((state) => state.runtimes);
  const errors = useAppStore((state) => state.errors);
  const startRequests = useAppStore((state) => state.startRequests);
  const pendingConnections = useAppStore((state) => state.pendingConnections);
  const settings = useAppStore((state) => state.settings);
  const launcherProfiles = useAppStore((state) => state.launcherProfiles);
  const windowsShells = useAppStore((state) => state.windowsShells);
  const wslDistributions = useAppStore((state) => state.wslDistributions);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const requestStart = useAppStore((state) => state.requestTerminalStart);
  const removeRuntime = useAppStore((state) => state.removeRuntime);
  const suppressConfirm = useAppStore((state) => state.suppressTerminalCloseConfirm);
  const suppressCloseConfirmForSession = useAppStore((state) => state.suppressCloseConfirmForSession);
  const tabStripRef = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState<TerminalDefinition | null>(null);
  const [suppressChecked, setSuppressChecked] = useState(false);
  const [renaming, setRenaming] = useState<TerminalDefinition | null>(null);
  const [editing, setEditing] = useState<TerminalDefinition | null>(null);
  const [launcherSetup, setLauncherSetup] = useState(false);
  const [launcherPending, setLauncherPending] = useState(false);
  const [launcherError, setLauncherError] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [deletingPane, setDeletingPane] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSaving, setDeleteSaving] = useState(false);

  const definitions = pane.terminalIds
    .map((id) => workspace.terminals.find((terminal) => terminal.id === id))
    .filter((terminal): terminal is TerminalDefinition => Boolean(terminal));
  const active = definitions.find((terminal) => terminal.id === pane.activeTerminalId) ?? definitions[0];
  const runtime = active ? runtimes[active.id] : undefined;
  const error = active ? errors[active.id] : undefined;
  const transitioning = definitions.some((definition) => {
    const status = runtimes[definition.id]?.status;
    return status === "starting" || status === "stopping" || (pendingConnections[definition.id] ?? 0) > 0;
  });
  const runningCount = definitions.filter((definition) => runtimes[definition.id]?.status === "running").length;
  const activeLauncherId = active?.launcherProfileId ?? settings.defaultLauncherProfileId ?? null;
  const activeLauncher = launcherProfiles.find(({ profile }) => profile.id === activeLauncherId);

  useEffect(() => {
    const activeTab = Array.from(tabStripRef.current?.querySelectorAll<HTMLElement>("[data-terminal-id]") ?? [])
      .find((tab) => tab.dataset.terminalId === active?.id);
    activeTab?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active?.id]);

  const requestClose = async (definition: TerminalDefinition) => {
    const current = runtimes[definition.id];
    if (current && ["starting", "running", "stopping"].includes(current.status) && !suppressConfirm) {
      setClosing(definition);
      return;
    }
    await finishClose(definition);
  };

  const finishClose = async (definition: TerminalDefinition) => {
    const current = useAppStore.getState().runtimes[definition.id];
    if (current) await closeTerminal(current.id);
    removeRuntime(definition.id);
    await onRemoveTerminal(definition.id);
    if (suppressChecked) suppressCloseConfirmForSession();
    setClosing(null);
  };

  const restart = async () => {
    if (!active) return;
    if (runtime) await closeTerminal(runtime.id);
    removeRuntime(active.id);
    requestStart(active.id);
  };

  const launch = async (profileId: string) => {
    if (!active || launcherPending) return;
    setLauncherPending(true);
    setLauncherError("");
    try {
      await openLauncher({ profileId, path: active.workingDirectory });
    } catch (reason) {
      setLauncherError(String((reason as { message?: string })?.message ?? reason));
      throw reason;
    } finally {
      setLauncherPending(false);
    }
  };

  const requestLauncher = () => {
    if (!active) return;
    if (!activeLauncherId) {
      setLauncherSetup(true);
      return;
    }
    void launch(activeLauncherId).catch(() => undefined);
  };

  const openRename = (definition: TerminalDefinition) => {
    setRenaming(definition);
    setRenameValue(definition.name);
    setRenameError("");
  };

  const finishRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!renaming) return;
    const normalized = renameValue.trim();
    if (!normalized) {
      setRenameError("Enter a terminal name.");
      return;
    }
    setRenameSaving(true);
    setRenameError("");
    try {
      await onRenameTerminal(renaming.id, normalized);
      setRenaming(null);
    } catch (reason) {
      setRenameError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setRenameSaving(false);
    }
  };

  const requestDeletePane = () => {
    if (!canDeletePane) return;
    if (definitions.length === 0) {
      void onDeletePane(pane.id).catch(() => undefined);
      return;
    }
    setDeleteError("");
    setDeletingPane(true);
  };

  const finishDeletePane = async () => {
    if (transitioning) return;
    setDeleteSaving(true);
    setDeleteError("");
    try {
      await onDeletePane(pane.id);
      setDeletingPane(false);
    } catch (reason) {
      setDeleteError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setDeleteSaving(false);
    }
  };

  const dropIndexFromEvent = (event: ReactDragEvent<HTMLDivElement>) => {
    const strip = event.currentTarget;
    const bounds = strip.getBoundingClientRect();
    if (event.clientX < bounds.left + 28) strip.scrollLeft -= 18;
    else if (event.clientX > bounds.right - 28) strip.scrollLeft += 18;
    const tabs = Array.from(strip.querySelectorAll<HTMLElement>("[data-terminal-id]"))
      .filter((tab) => tab.dataset.terminalId !== dragging?.terminalId);
    const index = tabs.findIndex((tab) => {
      const tabBounds = tab.getBoundingClientRect();
      return event.clientX < tabBounds.left + tabBounds.width / 2;
    });
    return index === -1 ? tabs.length : index;
  };

  const dragOverTabs = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    onTabDragOver(pane.id, dropIndexFromEvent(event));
  };

  const dropOnTabs = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.preventDefault();
    event.stopPropagation();
    onTabDrop(pane.id, dropIndexFromEvent(event));
  };

  const scrollTabsWithWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const strip = event.currentTarget;
    if (strip.scrollWidth <= strip.clientWidth || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || event.deltaY === 0) return;
    const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
    const previous = strip.scrollLeft;
    strip.scrollLeft += event.deltaY * scale;
    if (strip.scrollLeft !== previous) event.preventDefault();
  };

  const dragOverSurface = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    const count = definitions.filter((definition) => definition.id !== dragging.terminalId).length;
    onTabDragOver(pane.id, count);
  };

  const dropOnSurface = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!dragging) return;
    event.preventDefault();
    const count = definitions.filter((definition) => definition.id !== dragging.terminalId).length;
    onTabDrop(pane.id, count);
  };

  return (
    <section className={`terminal-pane ${runtime?.status === "running" ? "running" : ""} ${dropTarget ? "drop-target" : ""}`}>
      <div className="terminal-tabs" role="tablist" aria-label="Terminal tabs">
        <div ref={tabStripRef} className="terminal-tab-strip" onWheel={scrollTabsWithWheel} onDragOver={dragOverTabs} onDrop={dropOnTabs}>
          {definitions.map((definition, definitionIndex) => {
            const itemRuntime = runtimes[definition.id];
            const isActive = definition.id === active?.id;
            const isDragging = definition.id === dragging?.terminalId;
            const insertionIndex = definitions
              .slice(0, definitionIndex)
              .filter((item) => item.id !== dragging?.terminalId).length;
            const showMarker = Boolean(dropTarget && !isDragging && dropTarget.index === insertionIndex);
            return (
              <Fragment key={definition.id}>
                {showMarker && <span className="tab-insertion-marker" aria-hidden="true" />}
                <button
                  role="tab"
                  data-terminal-id={definition.id}
                  draggable
                  aria-selected={isActive}
                  className={`terminal-tab ${isActive ? "active" : ""} ${isDragging ? "dragging" : ""}`}
                  onClick={() => onSelectTerminal(pane.id, definition.id)}
                  onDoubleClick={() => openRename(definition)}
                  onDragStart={(event) => {
                    if ((event.target as HTMLElement).closest(".tab-close")) {
                      event.preventDefault();
                      return;
                    }
                    onTabDragStart(pane.id, definition.id, event);
                  }}
                  onDragEnd={onTabDragEnd}
                  title="Drag to move · Double-click to rename"
                >
                  <span className={`runtime-dot ${itemRuntime?.status ?? ((pendingConnections[definition.id] ?? 0) > 0 ? "starting" : "idle")}`} />
                  <span>{definition.name}</span>
                  <span className="tab-shell">{definition.shellProfile.shell?.split("/").pop() ?? definition.shellProfile.version?.split(".")[0] ?? "PS"}</span>
                  <span className="tab-close" role="button" draggable={false} aria-label={`Close ${definition.name}`} onPointerDown={(event) => event.stopPropagation()} onDoubleClick={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); void requestClose(definition); }}><X size={12} /></span>
                </button>
              </Fragment>
            );
          })}
          {dropTarget && dropTarget.index === definitions.filter((definition) => definition.id !== dragging?.terminalId).length && <span className="tab-insertion-marker" aria-hidden="true" />}
        </div>
        <div className="pane-actions">
          <button onClick={() => onNewTerminal(pane.id)} aria-label="New terminal in pane" title="New terminal"><Plus size={13} /></button>
          <button onClick={() => onSplit(pane.id, "horizontal")} aria-label="Split right" title="Split right"><Columns2 size={13} /></button>
          <button onClick={() => onSplit(pane.id, "vertical")} aria-label="Split down" title="Split down"><Rows2 size={13} /></button>
          <button className="launcher-pane-action" disabled={!active || launcherPending} onClick={requestLauncher} aria-label={activeLauncher ? `Open working directory in ${activeLauncher.profile.name}` : "Open working directory"} title={activeLauncher ? `Open in ${activeLauncher.profile.name}` : "Choose how to open this working directory"}>{launcherPending ? <LoaderCircle className="spin" size={13} /> : activeLauncher ? <LauncherLogo icon={activeLauncher.profile.icon} accent={activeLauncher.profile.accent} size={14} /> : <FolderOpen size={13} />}</button>
          <button disabled={!active} onClick={() => active && setEditing(active)} aria-label="Edit terminal" title="Edit terminal"><Pencil size={13} /></button>
          <span className="pane-action-divider" aria-hidden="true" />
          <button className="delete-pane-action" disabled={!canDeletePane} onClick={requestDeletePane} aria-label="Delete pane" title={canDeletePane ? "Delete pane" : "The last pane cannot be deleted"}><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="terminal-surface" onDragOver={dragOverSurface} onDrop={dropOnSurface}>
        {!active ? (
          <div className="terminal-empty"><p>No terminals in this pane.</p><button className="primary-button" onClick={() => onNewTerminal(pane.id)}><Plus size={14} /> Add Terminal</button></div>
        ) : (
          <>
            <XtermView key={`${workspace.id}:${active.id}`} workspace={workspace} definition={active} activate={Boolean(runtime) || Boolean(startRequests[active.id])} connectionGeneration={startRequests[active.id] ?? 0} focusRequest={terminalFocusRequest?.terminalId === active.id ? terminalFocusRequest.sequence : undefined} />
            {!runtime && !startRequests[active.id] && !error && <div className="terminal-overlay"><Play size={20} /><p><strong>{active.name}</strong> is not running.</p><button className="primary-button" onClick={() => requestStart(active.id)}><Play size={13} /> Start Terminal</button></div>}
            {error && <div className="terminal-overlay error"><AlertCircle size={22} /><p><strong>Unable to start terminal.</strong><span>{error}</span></p><div><button className="secondary-button" onClick={() => requestStart(active.id)}><RotateCw size={13} /> Retry</button></div></div>}
            {runtime?.status === "exited" && <div className="terminal-exit-banner"><span>Process exited with code {runtime.exitCode ?? 0}.</span><button onClick={() => void restart()}><RotateCw size={12} /> Restart</button></div>}
            {launcherError && <div className="launcher-error-banner" role="alert"><AlertCircle size={14} /><span><strong>Unable to open working directory.</strong><small>{launcherError}</small></span><button onClick={() => { setLauncherError(""); onOpenLauncherSettings(); }}><Settings2 size={12} /> Settings</button><button aria-label="Dismiss launcher error" title="Dismiss" onClick={() => setLauncherError("")}><X size={12} /></button></div>}
          </>
        )}
      </div>

      {closing && <Modal title={`Close “${closing.name}”?`} description="This terminal is still running. Closing it will terminate the process." onClose={() => setClosing(null)} width="small" footer={<><button className="secondary-button" onClick={() => setClosing(null)}>Cancel</button><button className="danger-button" onClick={() => void finishClose(closing)}>Close Terminal</button></>}><label className="checkbox-field"><input type="checkbox" checked={suppressChecked} onChange={(event) => setSuppressChecked(event.target.checked)} /><span><strong>Do not ask again for this session</strong><small>This resets when Turtorge exits.</small></span></label></Modal>}
      {renaming && <Modal title="Rename Terminal" description="The new label is saved with this workspace." onClose={() => !renameSaving && setRenaming(null)} width="small" footer={<><button className="secondary-button" onClick={() => setRenaming(null)} disabled={renameSaving}>Cancel</button><button className="primary-button" type="submit" form="rename-terminal-form" disabled={renameSaving}>Rename</button></>}><form id="rename-terminal-form" onSubmit={finishRename}><label className="field"><span>Terminal name</span><input autoFocus maxLength={80} value={renameValue} onChange={(event) => setRenameValue(event.target.value)} /></label>{renameError && <div className="form-error rename-error">{renameError}</div>}</form></Modal>}
      {editing && <EditTerminalDialog definition={editing} workspace={workspace} windowsShells={windowsShells} wslDistributions={wslDistributions} launcherProfiles={launcherProfiles} globalDefaultLauncherId={settings.defaultLauncherProfileId} running={Boolean(runtime && ["starting", "running"].includes(runtime.status))} onSave={onEditTerminal} onRestart={restart} onClose={() => setEditing(null)} />}
      {launcherSetup && active && <LauncherSetupDialog launcherProfiles={launcherProfiles} path={active.workingDirectory.value} onClose={() => setLauncherSetup(false)} onManage={() => { setLauncherSetup(false); onOpenLauncherSettings(); }} onSaveAndOpen={async (profileId) => { await updateSettings({ ...settings, defaultLauncherProfileId: profileId }); await launch(profileId); }} />}
      {deletingPane && <Modal title="Delete Pane?" description="This permanently removes every saved terminal in the pane." onClose={() => !deleteSaving && setDeletingPane(false)} width="small" footer={<><button className="secondary-button" onClick={() => setDeletingPane(false)} disabled={deleteSaving}>Cancel</button><button className="danger-button" onClick={() => void finishDeletePane()} disabled={deleteSaving || transitioning}>Delete Pane</button></>}><div className="pane-delete-summary"><AlertTriangle size={16} /><span><strong>{definitions.length} saved {definitions.length === 1 ? "terminal" : "terminals"} will be deleted.</strong><small>{runningCount} running {runningCount === 1 ? "process" : "processes"} will be terminated.</small></span></div><div className="pane-delete-list">{definitions.map((definition) => { const itemRuntime = runtimes[definition.id]; const status = (pendingConnections[definition.id] ?? 0) > 0 ? "starting" : itemRuntime?.status ?? "not running"; return <div key={definition.id}><span><i className={`runtime-dot ${status.replace(" ", "-")}`} />{definition.name}</span><small>{status}</small></div>; })}</div>{transitioning && <div className="form-status pane-delete-wait"><RotateCw className="spin" size={14} /><span><strong>Wait for terminal activity to settle.</strong><small>Try again after every terminal finishes starting or stopping.</small></span></div>}{deleteError && <div className="form-error">{deleteError}</div>}</Modal>}
    </section>
  );
}
