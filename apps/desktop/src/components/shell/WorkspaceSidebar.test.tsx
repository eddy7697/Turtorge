// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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
});
