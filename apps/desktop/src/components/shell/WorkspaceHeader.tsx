import { ExternalLink, Plus, RotateCw, TerminalSquare } from "lucide-react";
import type { TerminalRuntimeSnapshot, Workspace } from "../../types";

export function WorkspaceHeader({
  workspace,
  runtimes,
  onNewTerminal,
}: {
  workspace: Workspace;
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  onNewTerminal: () => void;
}) {
  const running = workspace.terminals.filter((terminal) => runtimes[terminal.id]?.status === "running").length;
  const shell = workspace.defaultShellProfile;
  const environmentLabel = shell.kind === "wsl" ? shell.distribution : shell.name;

  return (
    <header className="workspace-header">
      <div className="workspace-heading">
        <div className="workspace-title-row">
          <h1>{workspace.name}</h1>
          <span className={`status-chip ${running > 0 ? "running" : "idle"}`}>
            <span /> {running > 0 ? `${running} running` : "Ready"}
          </span>
        </div>
        <div className="workspace-meta">
          <span>{workspace.rootDirectory.value}</span>
          <span className="meta-separator">•</span>
          <span>{environmentLabel}</span>
        </div>
      </div>
      <div className="workspace-actions">
        <button className="secondary-button" disabled title="External editor profiles are planned after the vertical slice">
          <ExternalLink size={14} /> Open Editor
        </button>
        <button className="primary-button" onClick={onNewTerminal}>
          <Plus size={14} /> Terminal
        </button>
        <button className="icon-button" disabled aria-label="Restart workspace" title="Restart workspace">
          <RotateCw size={14} />
        </button>
        <TerminalSquare size={15} className="workspace-terminal-mark" aria-hidden="true" />
      </div>
    </header>
  );
}

