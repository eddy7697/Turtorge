// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LayoutNode, ShellProfile, TerminalDefinition, TerminalRuntimeSnapshot, Workspace } from "../../types";
import { WorkspaceSidebar } from "./WorkspaceSidebar";

const shell: ShellProfile = {
  id: "powershell-7",
  name: "PowerShell 7",
  kind: "powerShell",
  executable: "pwsh.exe",
  version: "7.5.2",
  distribution: null,
  shell: null,
  loginShell: false,
  available: true,
};

const terminal = (id: string, name: string): TerminalDefinition => ({
  id,
  name,
  profile: "shell",
  shellProfile: shell,
  workingDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
});

const terminals = [
  terminal("terminal-visible", "Visible terminal"),
  terminal("terminal-starting", "Starting terminal"),
  terminal("terminal-normal-exit", "Normal exit"),
  terminal("terminal-failed", "Failed terminal"),
];

const layout: LayoutNode = {
  type: "split",
  id: "split-test",
  direction: "horizontal",
  ratio: 0.5,
  first: {
    type: "pane",
    id: "pane-first",
    terminalIds: ["terminal-starting", "terminal-visible"],
    activeTerminalId: "terminal-visible",
  },
  second: {
    type: "pane",
    id: "pane-second",
    terminalIds: ["terminal-normal-exit", "terminal-failed"],
    activeTerminalId: "terminal-normal-exit",
  },
};

const workspace = (id = "workspace-test", name = "Test"): Workspace => ({
  id,
  name,
  description: null,
  color: "#72d8c9",
  rootDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  defaultShellProfile: shell,
  terminals,
  environmentVariables: [],
  layout,
  pinned: true,
  favorite: false,
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
});

const runtime = (definitionId: string, status: TerminalRuntimeSnapshot["status"], exitCode?: number): TerminalRuntimeSnapshot => ({
  id: `runtime-${definitionId}`,
  workspaceId: "workspace-test",
  definitionId,
  processId: 123,
  status,
  exitCode,
  cols: 80,
  rows: 24,
  scrollback: [],
});

function dragDataTransfer() {
  const data = new Map<string, string>();
  return {
    dropEffect: "none",
    effectAllowed: "none",
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => data.set(type, value),
  };
}

describe("WorkspaceSidebar", () => {
  afterEach(cleanup);

  it("lists every terminal in pane and tab order with three-state runtime lights", () => {
    const onSelectTerminal = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[workspace()]}
        activeWorkspaceId="workspace-test"
        runtimes={{
          "terminal-starting": runtime("terminal-starting", "starting"),
          "terminal-normal-exit": runtime("terminal-normal-exit", "exited", 0),
          "terminal-failed": runtime("terminal-failed", "exited", 2),
        }}
        errors={{ "terminal-starting": "Previous attempt failed" }}
        pendingConnections={{ "terminal-starting": 1 }}
        collapsed={false}
        onSelect={vi.fn()}
        onSelectTerminal={onSelectTerminal}
        onReorderPinned={vi.fn()}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={vi.fn()}
        onTerminalContextMenu={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const group = screen.getByRole("group", { name: "Test terminals" });
    expect(within(group).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "Starting terminal",
      "Visible terminal",
      "Normal exit",
      "Failed terminal",
    ]);
    expect(screen.getByRole("button", { name: "Starting terminal, Alive" }).querySelector(".runtime-dot.alive")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Visible terminal, Not running" }).classList.contains("visible")).toBe(true);
    expect(screen.getByRole("button", { name: "Normal exit, Not running" }).querySelector(".runtime-dot.idle")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Failed terminal, Failed" }).querySelector(".runtime-dot.failed")).toBeTruthy();
    expect(screen.getByText("1").classList.contains("runtime-count")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Starting terminal, Alive" }));
    expect(onSelectTerminal).toHaveBeenCalledWith("workspace-test", "pane-first", "terminal-starting");
  });

  it("keeps independent expansion state and automatically expands a newly active workspace", () => {
    const other = { ...workspace("workspace-other", "Other"), pinned: false, lastOpenedAt: "2026-07-30T00:00:00Z" };
    const props = {
      workspaces: [workspace(), other],
      runtimes: {},
      errors: {},
      pendingConnections: {},
      collapsed: false,
      onSelect: vi.fn(),
      onSelectTerminal: vi.fn(),
      onReorderPinned: vi.fn(),
      workspaceContextTargetId: null,
      terminalContextTargetId: null,
      onWorkspaceContextMenu: vi.fn(),
      onTerminalContextMenu: vi.fn(),
      onCreate: vi.fn(),
      onSettings: vi.fn(),
    };
    const { rerender } = render(<WorkspaceSidebar {...props} activeWorkspaceId="workspace-test" />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse Test" }));
    expect(screen.queryByRole("group", { name: "Test terminals" })).toBeNull();

    rerender(<WorkspaceSidebar {...props} activeWorkspaceId="workspace-other" />);
    expect(screen.getByRole("group", { name: "Other terminals" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: "Test terminals" })).toBeNull();
  });

  it("opens workspace and terminal context menus without changing selection", () => {
    const onSelect = vi.fn();
    const onSelectTerminal = vi.fn();
    const onWorkspaceContextMenu = vi.fn();
    const onTerminalContextMenu = vi.fn();
    render(
      <WorkspaceSidebar
        workspaces={[workspace()]}
        activeWorkspaceId="workspace-test"
        runtimes={{}}
        errors={{}}
        pendingConnections={{}}
        collapsed={false}
        onSelect={onSelect}
        onSelectTerminal={onSelectTerminal}
        onReorderPinned={vi.fn()}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={onWorkspaceContextMenu}
        onTerminalContextMenu={onTerminalContextMenu}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("button", { name: "Visible terminal, Not running" }), { clientX: 80, clientY: 120 });
    expect(onTerminalContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "workspace-test" }), terminals[0], { x: 80, y: 120 });
    expect(onSelectTerminal).not.toHaveBeenCalled();

    fireEvent.contextMenu(screen.getByRole("button", { name: "TestPinned workspace" }), { clientX: 48, clientY: 64 });
    expect(onWorkspaceContextMenu).toHaveBeenCalledWith(expect.objectContaining({ id: "workspace-test" }), { x: 48, y: 64 });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows an exact marker and reorders pinned workspaces without selecting or collapsing them", async () => {
    const onSelect = vi.fn();
    const onReorderPinned = vi.fn().mockResolvedValue(undefined);
    const alpha = workspace("workspace-alpha", "Alpha");
    const bravo = workspace("workspace-bravo", "Bravo");
    const charlie = workspace("workspace-charlie", "Charlie");
    const { container } = render(
      <WorkspaceSidebar
        workspaces={[alpha, bravo, charlie]}
        activeWorkspaceId={bravo.id}
        runtimes={{}}
        errors={{}}
        pendingConnections={{}}
        collapsed={false}
        onSelect={onSelect}
        onSelectTerminal={vi.fn()}
        onReorderPinned={onReorderPinned}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={vi.fn()}
        onTerminalContextMenu={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-pinned-workspace-id]"));
    rows.forEach((row, index) => {
      row.getBoundingClientRect = () => ({
        top: index * 34,
        bottom: index * 34 + 32,
        left: 0,
        right: 220,
        width: 220,
        height: 32,
        x: 0,
        y: index * 34,
        toJSON: () => ({}),
      });
    });
    const sidebar = container.querySelector<HTMLElement>(".sidebar-content")!;
    Object.defineProperties(sidebar, {
      clientHeight: { configurable: true, value: 100 },
      scrollHeight: { configurable: true, value: 500 },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    sidebar.getBoundingClientRect = () => ({
      top: 0,
      bottom: 100,
      left: 0,
      right: 236,
      width: 236,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    const transfer = dragDataTransfer();
    const list = screen.getByTestId("pinned-workspace-list");
    const bravoRow = container.querySelector<HTMLElement>(`[data-pinned-workspace-id="${bravo.id}"]`)!;
    fireEvent.dragStart(bravoRow, { dataTransfer: transfer });
    const dragOverEvent = createEvent.dragOver(list, { dataTransfer: transfer });
    Object.defineProperty(dragOverEvent, "clientY", { value: 98 });
    fireEvent(list, dragOverEvent);

    expect(container.querySelector(".workspace-insertion-marker")?.getAttribute("data-drop-index")).toBe("2");
    expect(sidebar.scrollTop).toBe(14);
    expect(screen.getByRole("group", { name: "Bravo terminals" })).toBeTruthy();

    const dropEvent = createEvent.drop(list, { dataTransfer: transfer });
    Object.defineProperty(dropEvent, "clientY", { value: 98 });
    fireEvent(list, dropEvent);
    await waitFor(() => expect(onReorderPinned).toHaveBeenCalledWith(bravo.id, 2));
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("group", { name: "Bravo terminals" })).toBeTruthy();
  });

  it("does not make Recent workspaces draggable or accept a pinned drop in Recent", () => {
    const pinnedWorkspace = workspace("workspace-pinned", "Pinned");
    const recentWorkspace = {
      ...workspace("workspace-recent", "Recent"),
      pinned: false,
      lastOpenedAt: "2026-08-20T00:00:00Z",
    };
    const onReorderPinned = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <WorkspaceSidebar
        workspaces={[pinnedWorkspace, recentWorkspace]}
        activeWorkspaceId={pinnedWorkspace.id}
        runtimes={{}}
        errors={{}}
        pendingConnections={{}}
        collapsed={false}
        onSelect={vi.fn()}
        onSelectTerminal={vi.fn()}
        onReorderPinned={onReorderPinned}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={vi.fn()}
        onTerminalContextMenu={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const recentRow = screen.getByRole("button", { name: "Recent" }).closest<HTMLElement>(".workspace-item")!;
    expect(recentRow.draggable).toBe(false);

    const transfer = dragDataTransfer();
    const pinnedRow = container.querySelector<HTMLElement>(`[data-pinned-workspace-id="${pinnedWorkspace.id}"]`)!;
    fireEvent.dragStart(pinnedRow, { dataTransfer: transfer });
    fireEvent.dragOver(recentRow, { clientY: 200, dataTransfer: transfer });
    fireEvent.drop(recentRow, { clientY: 200, dataTransfer: transfer });
    fireEvent.dragEnd(pinnedRow, { dataTransfer: transfer });

    expect(onReorderPinned).not.toHaveBeenCalled();
    expect(container.querySelector(".workspace-insertion-marker")).toBeNull();
  });

  it("accepts terminal drops on collapsed workspace icons without enabling workspace reorder", () => {
    vi.useFakeTimers();
    const source = workspace("workspace-source", "Source");
    const target = workspace("workspace-target", "Target");
    const onTerminalDragOverWorkspace = vi.fn();
    const onTerminalDragLeaveWorkspace = vi.fn();
    const onTerminalDropWorkspace = vi.fn();
    const onReorderPinned = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <WorkspaceSidebar
        workspaces={[source, target]}
        activeWorkspaceId={source.id}
        runtimes={{}}
        errors={{}}
        pendingConnections={{}}
        collapsed
        onSelect={vi.fn()}
        onSelectTerminal={vi.fn()}
        onReorderPinned={onReorderPinned}
        terminalDrag={{
          sourceWorkspaceId: source.id,
          sourcePaneId: "pane-first",
          terminalId: "terminal-visible",
        }}
        terminalDropWorkspaceId={target.id}
        onTerminalDragOverWorkspace={onTerminalDragOverWorkspace}
        onTerminalDragLeaveWorkspace={onTerminalDragLeaveWorkspace}
        onTerminalDropWorkspace={onTerminalDropWorkspace}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={vi.fn()}
        onTerminalContextMenu={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const rows = container.querySelectorAll<HTMLElement>(".workspace-tree-item");
    const targetRow = rows[1]!;
    const targetItem = targetRow.querySelector<HTMLElement>(".workspace-item")!;
    const targetButton = targetRow.querySelector<HTMLElement>(".workspace-select")!;
    const transfer = dragDataTransfer();

    expect(targetRow.classList.contains("terminal-drop-target")).toBe(true);
    expect(targetItem.draggable).toBe(false);

    fireEvent.dragOver(targetRow, { clientY: 20, dataTransfer: transfer });
    expect(onTerminalDragOverWorkspace).toHaveBeenCalledWith(target.id);

    try {
      const nestedLeave = createEvent.dragLeave(targetRow, { dataTransfer: transfer });
      Object.defineProperty(nestedLeave, "relatedTarget", { value: targetButton });
      fireEvent(targetRow, nestedLeave);
      expect(onTerminalDragLeaveWorkspace).not.toHaveBeenCalled();

      const nullLeave = createEvent.dragLeave(targetRow, { dataTransfer: transfer });
      Object.defineProperty(nullLeave, "relatedTarget", { value: null });
      fireEvent(targetRow, nullLeave);
      fireEvent.dragOver(targetRow, { clientY: 20, dataTransfer: transfer });
      vi.advanceTimersByTime(50);
      expect(onTerminalDragLeaveWorkspace).not.toHaveBeenCalled();

      const outsideLeave = createEvent.dragLeave(targetRow, { dataTransfer: transfer });
      Object.defineProperty(outsideLeave, "relatedTarget", { value: document.body });
      fireEvent(targetRow, outsideLeave);
      vi.advanceTimersByTime(50);
      expect(onTerminalDragLeaveWorkspace).toHaveBeenCalledWith(target.id);

      fireEvent.drop(targetRow, { dataTransfer: transfer });
      expect(onTerminalDropWorkspace).toHaveBeenCalledWith(target.id);
      expect(onReorderPinned).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the current order and shows a readable error when persistence fails", async () => {
    const alpha = workspace("workspace-alpha", "Alpha");
    const bravo = workspace("workspace-bravo", "Bravo");
    const onReorderPinned = vi.fn().mockRejectedValue(new Error("Disk full"));
    const { container } = render(
      <WorkspaceSidebar
        workspaces={[alpha, bravo]}
        activeWorkspaceId={alpha.id}
        runtimes={{}}
        errors={{}}
        pendingConnections={{}}
        collapsed={false}
        onSelect={vi.fn()}
        onSelectTerminal={vi.fn()}
        onReorderPinned={onReorderPinned}
        workspaceContextTargetId={null}
        terminalContextTargetId={null}
        onWorkspaceContextMenu={vi.fn()}
        onTerminalContextMenu={vi.fn()}
        onCreate={vi.fn()}
        onSettings={vi.fn()}
      />,
    );

    const transfer = dragDataTransfer();
    const list = screen.getByTestId("pinned-workspace-list");
    const alphaRow = container.querySelector<HTMLElement>(`[data-pinned-workspace-id="${alpha.id}"]`)!;
    fireEvent.dragStart(alphaRow, { dataTransfer: transfer });
    fireEvent.dragOver(list, { clientY: 100, dataTransfer: transfer });
    fireEvent.drop(list, { clientY: 100, dataTransfer: transfer });

    expect((await screen.findByRole("alert")).textContent).toContain("Could not reorder pinned workspaces. Disk full");
    expect(container.querySelectorAll(".workspace-name")[0]?.textContent).toBe("Alpha");
  });
});
