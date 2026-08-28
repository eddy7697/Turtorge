// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import type { ShellProfile, TerminalDefinition, Workspace } from "../types";
import { bootstrap, moveTerminalToWorkspace, reorderWorkspaces, saveWorkspace } from "./api";

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

function workspace(id: string): Workspace {
  return {
    id,
    name: id,
    description: null,
    color: "#72d8c9",
    rootDirectory: { kind: "windows", value: `E:\\Projects\\${id}`, distribution: null },
    defaultShellProfile: shell,
    terminals: [],
    environmentVariables: [],
    layout: { type: "pane", id: `pane-${id}`, terminalIds: [], activeTerminalId: null },
    pinned: true,
    favorite: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    lastOpenedAt: null,
    openCount: 0,
  };
}

describe("browser workspace persistence APIs", () => {
  it("validates a complete permutation and returns the persisted order", async () => {
    const alpha = workspace("api-alpha");
    const bravo = workspace("api-bravo");
    const charlie = workspace("api-charlie");
    await saveWorkspace(alpha);
    await saveWorkspace(bravo);
    await saveWorkspace(charlie);

    const reordered = await reorderWorkspaces([charlie.id, alpha.id, bravo.id]);
    expect(reordered.map((item) => item.id)).toEqual([charlie.id, alpha.id, bravo.id]);
    expect((await bootstrap()).workspaces.map((item) => item.id)).toEqual([
      charlie.id,
      alpha.id,
      bravo.id,
    ]);

    await expect(reorderWorkspaces([alpha.id, alpha.id, charlie.id]))
      .rejects.toThrow("every workspace exactly once");
    expect((await bootstrap()).workspaces.map((item) => item.id)).toEqual([
      charlie.id,
      alpha.id,
      bravo.id,
    ]);
  });

  it("moves a terminal atomically and rejects an invalid target index without mutation", async () => {
    const definition: TerminalDefinition = {
      id: "api-terminal-move",
      name: "Movable terminal",
      profile: "shell",
      shellProfile: shell,
      workingDirectory: { kind: "windows", value: "E:\\Projects\\api-source", distribution: null },
      startupCommand: null,
      environmentVariables: [],
      autoStart: false,
    };
    const source = {
      ...workspace("api-move-source"),
      terminals: [definition],
      layout: {
        type: "pane" as const,
        id: "api-pane-source",
        terminalIds: [definition.id],
        activeTerminalId: definition.id,
      },
    };
    const target = workspace("api-move-target");
    await saveWorkspace(source);
    await saveWorkspace(target);

    const request = {
      sourceWorkspaceId: source.id,
      sourcePaneId: source.layout.id,
      targetWorkspaceId: target.id,
      targetPaneId: target.layout.id,
      terminalId: definition.id,
      targetIndex: 1,
    };
    await expect(moveTerminalToWorkspace(request)).rejects.toThrow("target index");
    const unchanged = (await bootstrap()).workspaces;
    expect(unchanged.find(({ id }) => id === source.id)).toEqual(source);
    expect(unchanged.find(({ id }) => id === target.id)).toEqual(target);

    const moved = await moveTerminalToWorkspace({ ...request, targetIndex: 0 });
    expect(moved.runtime).toBeNull();
    expect(moved.sourceWorkspace.terminals).toEqual([]);
    expect(moved.sourceWorkspace.layout).toMatchObject({
      terminalIds: [],
      activeTerminalId: null,
    });
    expect(moved.targetWorkspace.terminals).toEqual([definition]);
    expect(moved.targetWorkspace.layout).toMatchObject({
      terminalIds: [definition.id],
      activeTerminalId: definition.id,
    });
    expect(moved.targetWorkspace.openCount).toBe(1);
    expect(moved.targetWorkspace.lastOpenedAt).not.toBeNull();
  });
});
