import { describe, expect, it } from "vitest";
import type { TerminalRuntimeSnapshot, Workspace } from "../types";
import {
  readTerminalTabDrag,
  terminalMoveIsTransitioning,
  TERMINAL_TAB_DRAG_MIME,
  workspaceEndDropTarget,
  writeTerminalTabDrag,
  type TerminalTabDrag,
} from "./terminalDrag";

function dataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    dropEffect: "none",
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => values.set(type, value),
  } as unknown as DataTransfer;
}

function workspace(): Workspace {
  return {
    id: "workspace-target",
    name: "Target",
    description: null,
    color: "#fff",
    rootDirectory: { kind: "windows", value: "E:\\Target" },
    defaultShellProfile: {
      id: "shell",
      name: "PowerShell",
      kind: "powerShell",
      executable: "pwsh.exe",
      shell: null,
      version: null,
      distribution: null,
      loginShell: false,
      available: true,
    },
    terminals: [],
    environmentVariables: [],
    layout: {
      type: "pane",
      id: "pane-target",
      terminalIds: ["terminal-a", "terminal-b"],
      activeTerminalId: "terminal-a",
    },
    pinned: true,
    favorite: false,
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
    lastOpenedAt: null,
    openCount: 0,
  };
}

describe("terminal tab drag contracts", () => {
  it("writes and reads a typed drag payload", () => {
    const transfer = dataTransfer();
    const drag: TerminalTabDrag = {
      sourceWorkspaceId: "workspace-source",
      sourcePaneId: "pane-source",
      terminalId: "terminal-a",
    };

    writeTerminalTabDrag(transfer, drag);

    expect(transfer.effectAllowed).toBe("move");
    expect(transfer.getData(TERMINAL_TAB_DRAG_MIME)).not.toBe("");
    expect(readTerminalTabDrag(transfer)).toEqual(drag);
  });

  it("rejects malformed drag payloads", () => {
    const transfer = dataTransfer();
    transfer.setData(TERMINAL_TAB_DRAG_MIME, JSON.stringify({ terminalId: "terminal-a" }));

    expect(readTerminalTabDrag(transfer)).toBeNull();
  });

  it("appends at the first pane while excluding the source tab", () => {
    const target = workspaceEndDropTarget(
      [workspace()],
      {
        sourceWorkspaceId: "workspace-target",
        sourcePaneId: "pane-target",
        terminalId: "terminal-a",
      },
      "workspace-target",
    );

    expect(target).toEqual({
      workspaceId: "workspace-target",
      paneId: "pane-target",
      index: 1,
    });
  });

  it("blocks only unstable runtime and connection states", () => {
    const runtime = (status: TerminalRuntimeSnapshot["status"]): TerminalRuntimeSnapshot => ({
      id: "runtime",
      workspaceId: "workspace",
      definitionId: "terminal",
      processId: 1,
      status,
      exitCode: null,
      cols: 80,
      rows: 24,
      scrollback: [],
    });

    expect(terminalMoveIsTransitioning(runtime("starting"), 0)).toBe(true);
    expect(terminalMoveIsTransitioning(runtime("stopping"), 0)).toBe(true);
    expect(terminalMoveIsTransitioning(runtime("running"), 1)).toBe(true);
    expect(terminalMoveIsTransitioning(runtime("running"), 0, true)).toBe(true);
    expect(terminalMoveIsTransitioning(runtime("running"), 0)).toBe(false);
    expect(terminalMoveIsTransitioning(runtime("exited"), 0)).toBe(false);
    expect(terminalMoveIsTransitioning(undefined, 0)).toBe(false);
  });
});
