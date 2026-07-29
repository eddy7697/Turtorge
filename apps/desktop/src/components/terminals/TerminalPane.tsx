import { AlertCircle, Columns2, MoreHorizontal, Play, Plus, RotateCw, Rows2, X } from "lucide-react";
import { useState } from "react";
import { closeTerminal } from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { PaneNode, SplitDirection, TerminalDefinition, Workspace } from "../../types";
import { Modal } from "../ui/Modal";
import { XtermView } from "./XtermView";

export function TerminalPane({
  pane,
  workspace,
  onSelectTerminal,
  onNewTerminal,
  onSplit,
  onRemoveTerminal,
}: {
  pane: PaneNode;
  workspace: Workspace;
  onSelectTerminal: (paneId: string, terminalId: string) => void;
  onNewTerminal: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onRemoveTerminal: (terminalId: string) => Promise<void>;
}) {
  const runtimes = useAppStore((state) => state.runtimes);
  const errors = useAppStore((state) => state.errors);
  const startRequests = useAppStore((state) => state.startRequests);
  const requestStart = useAppStore((state) => state.requestTerminalStart);
  const removeRuntime = useAppStore((state) => state.removeRuntime);
  const suppressConfirm = useAppStore((state) => state.suppressTerminalCloseConfirm);
  const suppressCloseConfirmForSession = useAppStore((state) => state.suppressCloseConfirmForSession);
  const [closing, setClosing] = useState<TerminalDefinition | null>(null);
  const [suppressChecked, setSuppressChecked] = useState(false);

  const definitions = pane.terminalIds
    .map((id) => workspace.terminals.find((terminal) => terminal.id === id))
    .filter((terminal): terminal is TerminalDefinition => Boolean(terminal));
  const active = definitions.find((terminal) => terminal.id === pane.activeTerminalId) ?? definitions[0];
  const runtime = active ? runtimes[active.id] : undefined;
  const error = active ? errors[active.id] : undefined;

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

  return (
    <section className={`terminal-pane ${runtime?.status === "running" ? "running" : ""}`}>
      <div className="terminal-tabs" role="tablist" aria-label="Terminal tabs">
        {definitions.map((definition) => {
          const itemRuntime = runtimes[definition.id];
          const isActive = definition.id === active?.id;
          return (
            <button key={definition.id} role="tab" aria-selected={isActive} className={`terminal-tab ${isActive ? "active" : ""}`} onClick={() => onSelectTerminal(pane.id, definition.id)}>
              <span className={`runtime-dot ${itemRuntime?.status ?? "idle"}`} />
              <span>{definition.name}</span>
              <span className="tab-shell">{definition.shellProfile.shell?.split("/").pop() ?? definition.shellProfile.version?.split(".")[0] ?? "PS"}</span>
              <span className="tab-close" role="button" aria-label={`Close ${definition.name}`} onClick={(event) => { event.stopPropagation(); void requestClose(definition); }}><X size={12} /></span>
            </button>
          );
        })}
        <button className="tab-action" onClick={() => onNewTerminal(pane.id)} aria-label="New terminal in pane" title="New terminal"><Plus size={13} /></button>
        <div className="pane-actions">
          <button onClick={() => onSplit(pane.id, "horizontal")} aria-label="Split right" title="Split right"><Columns2 size={13} /></button>
          <button onClick={() => onSplit(pane.id, "vertical")} aria-label="Split down" title="Split down"><Rows2 size={13} /></button>
          <button aria-label="More terminal actions" title="More actions"><MoreHorizontal size={14} /></button>
        </div>
      </div>

      <div className="terminal-surface">
        {!active ? (
          <div className="terminal-empty"><p>No terminals in this pane.</p><button className="primary-button" onClick={() => onNewTerminal(pane.id)}><Plus size={14} /> Add Terminal</button></div>
        ) : (
          <>
            <XtermView workspace={workspace} definition={active} activate={Boolean(runtime) || Boolean(startRequests[active.id])} connectionGeneration={startRequests[active.id] ?? 0} />
            {!runtime && !startRequests[active.id] && !error && <div className="terminal-overlay"><Play size={20} /><p><strong>{active.name}</strong> is not running.</p><button className="primary-button" onClick={() => requestStart(active.id)}><Play size={13} /> Start Terminal</button></div>}
            {error && <div className="terminal-overlay error"><AlertCircle size={22} /><p><strong>Unable to start terminal.</strong><span>{error}</span></p><div><button className="secondary-button" onClick={() => requestStart(active.id)}><RotateCw size={13} /> Retry</button></div></div>}
            {runtime?.status === "exited" && <div className="terminal-exit-banner"><span>Process exited with code {runtime.exitCode ?? 0}.</span><button onClick={() => void restart()}><RotateCw size={12} /> Restart</button></div>}
          </>
        )}
      </div>

      {closing && <Modal title={`Close “${closing.name}”?`} description="This terminal is still running. Closing it will terminate the process." onClose={() => setClosing(null)} width="small" footer={<><button className="secondary-button" onClick={() => setClosing(null)}>Cancel</button><button className="danger-button" onClick={() => void finishClose(closing)}>Close Terminal</button></>}><label className="checkbox-field"><input type="checkbox" checked={suppressChecked} onChange={(event) => setSuppressChecked(event.target.checked)} /><span><strong>Do not ask again for this session</strong><small>This resets when Turtorge exits.</small></span></label></Modal>}
    </section>
  );
}
