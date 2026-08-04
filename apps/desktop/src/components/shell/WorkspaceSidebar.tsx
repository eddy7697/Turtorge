import { ChevronDown, ChevronRight, Folder, FolderGit2, Pin, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { contextMenuPoint, type ContextMenuPoint } from "../ui/ContextMenu";
import type { LayoutNode, TerminalDefinition, TerminalRuntimeSnapshot, Workspace } from "../../types";

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  errors: Record<string, string>;
  pendingConnections: Record<string, number>;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onSelectTerminal: (workspaceId: string, paneId: string, terminalId: string) => void;
  workspaceContextTargetId: string | null;
  terminalContextTargetId: string | null;
  onWorkspaceContextMenu: (workspace: Workspace, point: ContextMenuPoint) => void;
  onTerminalContextMenu: (workspace: Workspace, definition: TerminalDefinition, point: ContextMenuPoint) => void;
  onCreate: () => void;
  onSettings: () => void;
}

type RuntimeLight = "alive" | "failed" | "idle";

interface SidebarTerminal {
  definition: TerminalDefinition;
  paneId: string | null;
  visible: boolean;
}

export function WorkspaceSidebar({
  workspaces,
  activeWorkspaceId,
  runtimes,
  errors,
  pendingConnections,
  collapsed,
  onSelect,
  onSelectTerminal,
  workspaceContextTargetId,
  terminalContextTargetId,
  onWorkspaceContextMenu,
  onTerminalContextMenu,
  onCreate,
  onSettings,
}: WorkspaceSidebarProps) {
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );
  const pinned = workspaces.filter((workspace) => workspace.pinned);
  const recent = workspaces
    .filter((workspace) => !workspace.pinned)
    .sort((a, b) => (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? ""));

  useEffect(() => {
    if (!activeWorkspaceId) return;
    setExpandedWorkspaceIds((current) => {
      if (current.has(activeWorkspaceId)) return current;
      const next = new Set(current);
      next.add(activeWorkspaceId);
      return next;
    });
  }, [activeWorkspaceId]);

  const runtimeLight = (terminalId: string): RuntimeLight => {
    const runtime = runtimes[terminalId];
    if (
      (pendingConnections[terminalId] ?? 0) > 0
      || runtime?.status === "starting"
      || runtime?.status === "running"
      || runtime?.status === "stopping"
    ) return "alive";
    if (
      errors[terminalId]
      || runtime?.status === "failed"
      || (runtime?.status === "exited" && (runtime.exitCode ?? 0) !== 0)
    ) return "failed";
    return "idle";
  };

  const toggleWorkspace = (workspaceId: string) => {
    setExpandedWorkspaceIds((current) => {
      const next = new Set(current);
      if (next.has(workspaceId)) next.delete(workspaceId);
      else next.add(workspaceId);
      return next;
    });
  };

  const renderWorkspace = (workspace: Workspace) => {
    const terminals = orderedSidebarTerminals(workspace);
    const count = terminals.filter(({ definition }) => runtimeLight(definition.id) === "alive").length;
    const active = workspace.id === activeWorkspaceId;
    const expanded = expandedWorkspaceIds.has(workspace.id);
    const terminalListId = `workspace-${workspace.id}-terminals`;

    return (
      <div className="workspace-tree-item" key={workspace.id}>
        <div
          className={`workspace-item ${active ? "active" : ""} ${workspaceContextTargetId === workspace.id ? "context-target" : ""}`}
          onContextMenu={(event) => {
            event.preventDefault();
            onWorkspaceContextMenu(workspace, contextMenuPoint(event));
          }}
        >
          <span className="workspace-accent" style={{ background: workspace.color }} />
          {!collapsed && (
            <button
              className="workspace-disclosure"
              onClick={() => toggleWorkspace(workspace.id)}
              aria-expanded={expanded}
              aria-controls={terminalListId}
              aria-label={`${expanded ? "Collapse" : "Expand"} ${workspace.name}`}
              title={`${expanded ? "Collapse" : "Expand"} terminal list`}
            >
              {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            </button>
          )}
          <button
            className="workspace-select"
            onClick={() => onSelect(workspace.id)}
            aria-current={active ? "page" : undefined}
            title={collapsed ? `${workspace.name}\n${workspace.rootDirectory.value}` : workspace.rootDirectory.value}
          >
            {active ? <FolderGit2 size={16} /> : <Folder size={16} />}
            {!collapsed && <span className="workspace-name">{workspace.name}</span>}
            {!collapsed && workspace.pinned && <Pin size={11} className="workspace-pin" aria-label="Pinned workspace" />}
            {count > 0 && <span className="runtime-count">{count}</span>}
          </button>
        </div>
        {!collapsed && expanded && (
          <div className="workspace-terminal-list" id={terminalListId} role="group" aria-label={`${workspace.name} terminals`}>
            {terminals.map(({ definition, paneId, visible }) => {
              const light = runtimeLight(definition.id);
              const statusLabel = light === "alive" ? "Alive" : light === "failed" ? "Failed" : "Not running";
              return (
                <button
                  key={definition.id}
                  className={`workspace-terminal-item ${visible ? "visible" : ""} ${terminalContextTargetId === definition.id ? "context-target" : ""}`}
                  onClick={() => paneId ? onSelectTerminal(workspace.id, paneId, definition.id) : onSelect(workspace.id)}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onTerminalContextMenu(workspace, definition, contextMenuPoint(event));
                  }}
                  aria-label={`${definition.name}, ${statusLabel}`}
                  title={`${definition.name} — ${statusLabel}`}
                >
                  <span className={`runtime-dot ${light}`} aria-hidden="true" />
                  <span>{definition.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
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

function orderedSidebarTerminals(workspace: Workspace): SidebarTerminal[] {
  const definitions = new Map(workspace.terminals.map((terminal) => [terminal.id, terminal]));
  const ordered: SidebarTerminal[] = [];
  const seen = new Set<string>();

  const visit = (node: LayoutNode) => {
    if (node.type === "split") {
      visit(node.first);
      visit(node.second);
      return;
    }
    for (const terminalId of node.terminalIds) {
      const definition = definitions.get(terminalId);
      if (!definition || seen.has(terminalId)) continue;
      ordered.push({ definition, paneId: node.id, visible: node.activeTerminalId === terminalId });
      seen.add(terminalId);
    }
  };

  visit(workspace.layout);
  for (const definition of workspace.terminals) {
    if (!seen.has(definition.id)) ordered.push({ definition, paneId: null, visible: false });
  }
  return ordered;
}
