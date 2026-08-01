# Shared layouts

The application shell is composed in `apps/desktop/src/App.tsx`. The reusable shell regions are recorded below with their full source.

## `apps/desktop/src/components/shell/TitleBar.tsx`

Borderless application title bar with workspace navigation, quick open, global actions, and Windows controls.

~~~tsx
import { Minus, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../lib/api";

interface TitleBarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onQuickOpen: () => void;
  onNewTerminal: () => void;
  onSettings: () => void;
  onRequestQuit: () => void;
}

export function TitleBar({
  sidebarCollapsed,
  onToggleSidebar,
  onQuickOpen,
  onNewTerminal,
  onSettings,
  onRequestQuit,
}: TitleBarProps) {
  const minimize = () => isTauri() && void getCurrentWindow().minimize();
  const maximize = () => isTauri() && void getCurrentWindow().toggleMaximize();

  return (
    <header className="title-bar" data-tauri-drag-region>
      <div className="title-bar-brand" data-tauri-drag-region>
        <button className="icon-button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <div className="brand-crop" data-tauri-drag-region>
          <img src="/logo.png" alt="Turtorge" draggable={false} />
        </div>
      </div>

      <button className="quick-open-trigger" onClick={onQuickOpen}>
        <Search size={13} />
        <span>Quick Open…</span>
        <kbd>Ctrl P</kbd>
      </button>

      <div className="title-bar-actions">
        <button className="icon-button" onClick={onNewTerminal} aria-label="New terminal" title="New terminal (Ctrl+Shift+T)">
          <Plus size={16} />
        </button>
        <button className="icon-button" onClick={onSettings} aria-label="Settings" title="Settings (Ctrl+,)">
          <Settings size={16} />
        </button>
        <div className="window-controls">
          <button onClick={minimize} aria-label="Minimize" title="Minimize"><Minus size={15} /></button>
          <button onClick={maximize} aria-label="Maximize or restore" title="Maximize or restore"><Square size={12} /></button>
          <button className="window-close" onClick={onRequestQuit} aria-label="Close" title="Close"><X size={16} /></button>
        </div>
      </div>
    </header>
  );
}
~~~

## `apps/desktop/src/components/shell/WorkspaceSidebar.tsx`

Workspace-first primary navigation.

~~~tsx
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
~~~

## `apps/desktop/src/components/shell/WorkspaceHeader.tsx`

Active workspace identity, state, and common actions.

~~~tsx
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
~~~

## `apps/desktop/src/components/shell/StatusBar.tsx`

Compact application status surface.

~~~tsx
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
~~~
