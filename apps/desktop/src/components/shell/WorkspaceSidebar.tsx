import { Folder, FolderGit2, Pin, Plus, Settings } from "lucide-react";
import type { TerminalRuntimeSnapshot, Workspace } from "../../types";

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onSettings: () => void;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspaceId,
  runtimes,
  collapsed,
  onSelect,
  onCreate,
  onSettings,
}: WorkspaceSidebarProps) {
  const pinned = workspaces.filter((workspace) => workspace.pinned);
  const recent = workspaces
    .filter((workspace) => !workspace.pinned)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""));

  const renderWorkspace = (workspace: Workspace) => {
    const count = workspace.terminals.filter((terminal) => runtimes[terminal.id]?.status === "running").length;
    const active = workspace.id === activeWorkspaceId;
    return (
      <button
        key={workspace.id}
        className={`workspace-item ${active ? "active" : ""}`}
        onClick={() => onSelect(workspace.id)}
        aria-current={active ? "page" : undefined}
        title={collapsed ? `${workspace.name}\n${workspace.rootDirectory.value}` : workspace.rootDirectory.value}
      >
        <span className="workspace-accent" style={{ background: workspace.color }} />
        {active ? <FolderGit2 size={16} /> : <Folder size={16} />}
        {!collapsed && <span className="workspace-name">{workspace.name}</span>}
        {!collapsed && workspace.pinned && <Pin size={11} className="workspace-pin" />}
        {count > 0 && <span className="runtime-count">{count}</span>}
      </button>
    );
  };

  return (
    <aside className={`workspace-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="sidebar-content">
        {!collapsed && <div className="sidebar-section-label">Pinned</div>}
        {pinned.map(renderWorkspace)}
        {!collapsed && recent.length > 0 && <div className="sidebar-section-label recent-label">Recent</div>}
        {recent.map(renderWorkspace)}
        {workspaces.length === 0 && !collapsed && <p className="sidebar-empty">No workspaces yet.</p>}
      </div>
      <div className="sidebar-footer">
        <button className="sidebar-action primary" onClick={onCreate} title="Create workspace">
          <Plus size={15} /> {!collapsed && <span>New Workspace</span>}
        </button>
        <button className="sidebar-action" onClick={onSettings} title="Settings">
          <Settings size={15} /> {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </aside>
  );
}

