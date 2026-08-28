import { ChevronDown, ChevronRight, Folder, FolderGit2, Pin, Plus, Settings } from "lucide-react";
import { Fragment, useEffect, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import { contextMenuPoint, type ContextMenuPoint } from "../ui/ContextMenu";
import type { LayoutNode, TerminalDefinition, TerminalRuntimeSnapshot, Workspace } from "../../types";
import type { TerminalTabDrag } from "../../lib/terminalDrag";

const PINNED_WORKSPACE_DRAG_MIME = "application/x-turtorge-pinned-workspace";

interface WorkspaceSidebarProps {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  errors: Record<string, string>;
  pendingStarts?: Record<string, boolean>;
  pendingConnections: Record<string, number>;
  collapsed: boolean;
  onSelect: (id: string) => void;
  onSelectTerminal: (workspaceId: string, paneId: string, terminalId: string) => void;
  onReorderPinned: (sourceId: string, targetIndex: number) => Promise<void>;
  terminalDrag?: TerminalTabDrag | null;
  terminalDropWorkspaceId?: string | null;
  onTerminalDragOverWorkspace?: (workspaceId: string) => void;
  onTerminalDragLeaveWorkspace?: (workspaceId: string) => void;
  onTerminalDropWorkspace?: (workspaceId: string) => void;
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
  pendingStarts = {},
  pendingConnections,
  collapsed,
  onSelect,
  onSelectTerminal,
  onReorderPinned,
  terminalDrag = null,
  terminalDropWorkspaceId = null,
  onTerminalDragOverWorkspace = () => undefined,
  onTerminalDragLeaveWorkspace = () => undefined,
  onTerminalDropWorkspace = () => undefined,
  workspaceContextTargetId,
  terminalContextTargetId,
  onWorkspaceContextMenu,
  onTerminalContextMenu,
  onCreate,
  onSettings,
}: WorkspaceSidebarProps) {
  const sidebarContentRef = useRef<HTMLDivElement>(null);
  const terminalLeaveTimerRef = useRef<{ workspaceId: string; timerId: number } | null>(null);
  const [expandedWorkspaceIds, setExpandedWorkspaceIds] = useState<Set<string>>(
    () => new Set(activeWorkspaceId ? [activeWorkspaceId] : []),
  );
  const [draggingWorkspaceId, setDraggingWorkspaceId] = useState<string | null>(null);
  const [pinnedDropIndex, setPinnedDropIndex] = useState<number | null>(null);
  const [reorderingWorkspaceId, setReorderingWorkspaceId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!collapsed) return;
    setDraggingWorkspaceId(null);
    setPinnedDropIndex(null);
  }, [collapsed]);

  useEffect(() => () => {
    if (terminalLeaveTimerRef.current) {
      window.clearTimeout(terminalLeaveTimerRef.current.timerId);
    }
  }, []);

  const runtimeLight = (terminalId: string): RuntimeLight => {
    const runtime = runtimes[terminalId];
    if (
      (pendingConnections[terminalId] ?? 0) > 0
      || Boolean(pendingStarts[terminalId])
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

  const stopPinnedDrag = () => {
    setDraggingWorkspaceId(null);
    setPinnedDropIndex(null);
  };

  const startPinnedDrag = (workspaceId: string, event: ReactDragEvent<HTMLDivElement>) => {
    if (collapsed || reorderingWorkspaceId) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(PINNED_WORKSPACE_DRAG_MIME, workspaceId);
    setReorderError(null);
    setDraggingWorkspaceId(workspaceId);
    setPinnedDropIndex(null);
  };

  const dropIndexFromEvent = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggingWorkspaceId) return null;
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>("[data-pinned-workspace-id]"),
    ).filter((row) => row.dataset.pinnedWorkspaceId !== draggingWorkspaceId);
    const nextRowIndex = rows.findIndex((row) => {
      const bounds = row.getBoundingClientRect();
      return event.clientY < bounds.top + bounds.height / 2;
    });
    return nextRowIndex < 0 ? rows.length : nextRowIndex;
  };

  const scrollSidebarAtEdge = (clientY: number) => {
    const sidebar = sidebarContentRef.current;
    if (!sidebar || sidebar.scrollHeight <= sidebar.clientHeight) return;
    const bounds = sidebar.getBoundingClientRect();
    const edgeSize = Math.min(44, Math.max(24, bounds.height / 4));
    const maxScrollTop = sidebar.scrollHeight - sidebar.clientHeight;
    if (clientY < bounds.top + edgeSize) {
      sidebar.scrollTop = Math.max(0, sidebar.scrollTop - 14);
    } else if (clientY > bounds.bottom - edgeSize) {
      sidebar.scrollTop = Math.min(maxScrollTop, sidebar.scrollTop + 14);
    }
  };

  const cancelTerminalLeave = (workspaceId?: string) => {
    const pending = terminalLeaveTimerRef.current;
    if (!pending || (workspaceId && pending.workspaceId !== workspaceId)) return;
    window.clearTimeout(pending.timerId);
    terminalLeaveTimerRef.current = null;
  };

  const scheduleTerminalLeave = (workspaceId: string) => {
    cancelTerminalLeave();
    const timerId = window.setTimeout(() => {
      terminalLeaveTimerRef.current = null;
      onTerminalDragLeaveWorkspace(workspaceId);
    }, 40);
    terminalLeaveTimerRef.current = { workspaceId, timerId };
  };

  const dragOverPinned = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggingWorkspaceId || collapsed || reorderingWorkspaceId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setPinnedDropIndex(dropIndexFromEvent(event));
    scrollSidebarAtEdge(event.clientY);
  };

  const dropPinned = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!draggingWorkspaceId || collapsed || reorderingWorkspaceId) return;
    event.preventDefault();
    event.stopPropagation();
    const transferredId = event.dataTransfer.getData(PINNED_WORKSPACE_DRAG_MIME);
    const sourceId = transferredId || draggingWorkspaceId;
    if (sourceId !== draggingWorkspaceId || !pinned.some((workspace) => workspace.id === sourceId)) {
      stopPinnedDrag();
      return;
    }
    const targetIndex = pinnedDropIndex ?? dropIndexFromEvent(event);
    stopPinnedDrag();
    if (targetIndex === null) return;

    setReorderingWorkspaceId(sourceId);
    setReorderError(null);
    void onReorderPinned(sourceId, targetIndex)
      .catch((reason) => {
        setReorderError(`Could not reorder pinned workspaces. ${messageFromReason(reason)}`);
      })
      .finally(() => setReorderingWorkspaceId(null));
  };

  const remainingPinned = draggingWorkspaceId
    ? pinned.filter((workspace) => workspace.id !== draggingWorkspaceId)
    : pinned;
  const markerBeforeWorkspaceId = pinnedDropIndex === null
    ? null
    : remainingPinned[pinnedDropIndex]?.id ?? null;
  const markerAtEnd = pinnedDropIndex !== null && pinnedDropIndex >= remainingPinned.length;

  const renderWorkspace = (workspace: Workspace, pinnedIndex?: number) => {
    const terminals = orderedSidebarTerminals(workspace);
    const count = terminals.filter(({ definition }) => runtimeLight(definition.id) === "alive").length;
    const active = workspace.id === activeWorkspaceId;
    const expanded = expandedWorkspaceIds.has(workspace.id);
    const terminalListId = `workspace-${workspace.id}-terminals`;

    return (
      <div
        className={`workspace-tree-item ${draggingWorkspaceId === workspace.id ? "dragging" : ""} ${terminalDropWorkspaceId === workspace.id ? "terminal-drop-target" : ""}`}
        key={workspace.id}
        onDragOver={(event) => {
          if (!terminalDrag) return;
          cancelTerminalLeave(workspace.id);
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          scrollSidebarAtEdge(event.clientY);
          onTerminalDragOverWorkspace(workspace.id);
        }}
        onDragLeave={(event) => {
          if (!terminalDrag || event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          scheduleTerminalLeave(workspace.id);
        }}
        onDrop={(event) => {
          if (!terminalDrag) return;
          cancelTerminalLeave();
          event.preventDefault();
          event.stopPropagation();
          onTerminalDropWorkspace(workspace.id);
        }}
      >
        <div
          className={`workspace-item ${active ? "active" : ""} ${workspaceContextTargetId === workspace.id ? "context-target" : ""}`}
          data-pinned-workspace-id={pinnedIndex === undefined ? undefined : workspace.id}
          draggable={pinnedIndex !== undefined && !collapsed && !reorderingWorkspaceId}
          aria-grabbed={pinnedIndex === undefined || collapsed ? undefined : draggingWorkspaceId === workspace.id}
          onDragStart={pinnedIndex === undefined ? undefined : (event) => startPinnedDrag(workspace.id, event)}
          onDragEnd={pinnedIndex === undefined ? undefined : stopPinnedDrag}
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
      <div className="sidebar-content" ref={sidebarContentRef}>
        {!collapsed && <div className="sidebar-section-label">Pinned</div>}
        <div
          className="sidebar-pinned-list"
          data-testid="pinned-workspace-list"
          aria-busy={Boolean(reorderingWorkspaceId)}
          onDragOver={dragOverPinned}
          onDrop={dropPinned}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setPinnedDropIndex(null);
            }
          }}
        >
          {pinned.map((workspace, index) => (
            <Fragment key={workspace.id}>
              {markerBeforeWorkspaceId === workspace.id && (
                <div className="workspace-insertion-marker" data-drop-index={pinnedDropIndex ?? undefined} aria-hidden="true" />
              )}
              {renderWorkspace(workspace, index)}
            </Fragment>
          ))}
          {markerAtEnd && (
            <div className="workspace-insertion-marker" data-drop-index={pinnedDropIndex ?? undefined} aria-hidden="true" />
          )}
        </div>
        {reorderError && !collapsed && <div className="sidebar-reorder-error" role="alert">{reorderError}</div>}
        {!collapsed && recent.length > 0 && <div className="sidebar-section-label recent-label">Recent</div>}
        {recent.map((workspace) => renderWorkspace(workspace))}
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

function messageFromReason(reason: unknown): string {
  if (typeof reason === "object" && reason && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }
  return String(reason);
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
