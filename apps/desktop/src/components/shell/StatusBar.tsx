import { Activity, Box, Terminal } from "lucide-react";
import type { TerminalRuntimeSnapshot, Workspace } from "../../types";

export function StatusBar({
  workspace,
  runtimes,
}: {
  workspace?: Workspace;
  runtimes: Record<string, TerminalRuntimeSnapshot>;
}) {
  const running = workspace
    ? workspace.terminals.filter((terminal) => runtimes[terminal.id]?.status === "running").length
    : 0;
  return (
    <footer className="status-bar">
      <div>
        <span><Box size={12} /> {workspace?.name ?? "No workspace"}</span>
        {workspace && <span><Terminal size={12} /> {workspace.defaultShellProfile.name}</span>}
      </div>
      <div>
        <span><Activity size={12} className={running ? "status-running" : ""} /> {running} terminals</span>
        <span className="ready-label">Ready</span>
      </div>
    </footer>
  );
}
