import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellProfile, TerminalDefinition, Workspace } from "../types";
import { useAppStore } from "./appStore";

const apiMocks = vi.hoisted(() => ({
  openWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
  reorderWorkspaces: vi.fn(),
  moveTerminalToWorkspace: vi.fn(),
}));

vi.mock("../lib/api", () => apiMocks);

const shell: ShellProfile = {
  id: "native-zsh",
  name: "zsh",
  kind: "native",
  executable: "/bin/zsh",
  version: "5.9",
  distribution: null,
  shell: "zsh",
  loginShell: true,
  available: true,
};

const source: TerminalDefinition = {
  id: "terminal-source",
  name: "Codex",
  profile: "codex",
  shellProfile: shell,
  workingDirectory: { kind: "native", value: "/Users/test/Turtorge", distribution: null },
  startupCommand: "codex",
  environmentVariables: [{ key: "TURTORGE_TEST", value: "secret-value" }],
  autoStart: true,
  launcherProfileId: null,
};

const sibling: TerminalDefinition = {
  ...source,
  id: "terminal-sibling",
  name: "Shell",
  profile: "shell",
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
};

const workspace: Workspace = {
  id: "workspace-source",
  name: "Source workspace",
  description: null,
  color: "#72d8c9",
  rootDirectory: source.workingDirectory,
  defaultShellProfile: shell,
  terminals: [source, sibling],
  environmentVariables: [{ key: "WORKSPACE_ONLY", value: "inherited" }],
  layout: {
    type: "pane",
    id: "pane-source",
    terminalIds: [source.id, sibling.id],
    activeTerminalId: sibling.id,
  },
  pinned: false,
  favorite: false,
  createdAt: "2026-08-09T00:00:00Z",
  updatedAt: "2026-08-09T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

describe("appStore duplicateTerminal", () => {
  beforeEach(() => {
    apiMocks.saveWorkspace.mockReset();
    apiMocks.openWorkspace.mockReset();
    apiMocks.reorderWorkspaces.mockReset();
    apiMocks.moveTerminalToWorkspace.mockReset();
    apiMocks.saveWorkspace.mockImplementation(async (saved: Workspace) => saved);
    apiMocks.openWorkspace.mockImplementation(async (workspaceId: string) => {
      const opened = useAppStore.getState().workspaces.find((item) => item.id === workspaceId);
      if (!opened) throw new Error("Workspace not found");
      return opened;
    });
    useAppStore.setState({
      workspaces: [workspace],
      activeWorkspaceId: "workspace-other",
      startRequests: {},
      pendingStarts: {},
      pendingConnections: {},
      errors: {},
      workspaceMovePending: false,
    });
  });

  it("persists an independent copy beside its source, activates it, and starts it", async () => {
    const duplicate = await useAppStore.getState().duplicateTerminal(workspace.id, source.id);

    expect(duplicate).toMatchObject({
      name: "Codex Copy",
      profile: "codex",
      shellProfile: shell,
      workingDirectory: source.workingDirectory,
      startupCommand: "codex",
      environmentVariables: [{ key: "TURTORGE_TEST", value: "secret-value" }],
      autoStart: true,
      launcherProfileId: null,
    });
    expect(duplicate.id).not.toBe(source.id);

    const saved = apiMocks.saveWorkspace.mock.calls[0]?.[0] as Workspace;
    expect(saved.terminals).toEqual([source, duplicate, sibling]);
    expect(saved.layout).toMatchObject({
      terminalIds: [source.id, duplicate.id, sibling.id],
      activeTerminalId: duplicate.id,
    });
    expect(useAppStore.getState().activeWorkspaceId).toBe(workspace.id);
    expect(useAppStore.getState().startRequests[duplicate.id]).toBe(1);
  });

  it("continues copy numbering from a copied terminal without case-sensitive collisions", async () => {
    const numberedSource = { ...source, name: "Codex Copy 2" };
    const firstCopy = { ...sibling, id: "terminal-copy-1", name: "codex copy" };
    const workspaceWithCopies: Workspace = {
      ...workspace,
      terminals: [numberedSource, firstCopy, sibling],
      layout: {
        type: "pane",
        id: "pane-source",
        terminalIds: [numberedSource.id, firstCopy.id, sibling.id],
        activeTerminalId: numberedSource.id,
      },
    };
    useAppStore.setState({ workspaces: [workspaceWithCopies], activeWorkspaceId: workspace.id });

    const duplicate = await useAppStore.getState().duplicateTerminal(workspace.id, numberedSource.id);

    expect(duplicate.name).toBe("Codex Copy 3");
  });

  it("keeps the generated copy name within the terminal label limit", async () => {
    const longNameSource = { ...source, name: "A".repeat(80) };
    const workspaceWithLongName: Workspace = {
      ...workspace,
      terminals: [longNameSource],
      layout: {
        type: "pane",
        id: "pane-source",
        terminalIds: [longNameSource.id],
        activeTerminalId: longNameSource.id,
      },
    };
    useAppStore.setState({ workspaces: [workspaceWithLongName], activeWorkspaceId: workspace.id });

    const duplicate = await useAppStore.getState().duplicateTerminal(workspace.id, longNameSource.id);

    expect(duplicate.name).toBe(`${"A".repeat(75)} Copy`);
    expect(duplicate.name).toHaveLength(80);
  });

  it("leaves no duplicate, activation, or start request when persistence fails", async () => {
    apiMocks.saveWorkspace.mockRejectedValueOnce(new Error("Disk full"));

    await expect(useAppStore.getState().duplicateTerminal(workspace.id, source.id))
      .rejects.toThrow("Disk full");

    expect(useAppStore.getState().workspaces).toEqual([workspace]);
    expect(useAppStore.getState().activeWorkspaceId).toBe("workspace-other");
    expect(useAppStore.getState().startRequests).toEqual({});
    expect(apiMocks.openWorkspace).not.toHaveBeenCalled();
  });
});

describe("appStore reorderPinnedWorkspaces", () => {
  const pinnedAlpha: Workspace = { ...workspace, id: "workspace-alpha", name: "Alpha", pinned: true };
  const recent: Workspace = { ...workspace, id: "workspace-recent", name: "Recent", pinned: false };
  const pinnedBravo: Workspace = { ...workspace, id: "workspace-bravo", name: "Bravo", pinned: true };
  const original = [pinnedAlpha, recent, pinnedBravo];

  beforeEach(() => {
    apiMocks.reorderWorkspaces.mockReset();
    useAppStore.setState({ workspaces: original, workspaceMovePending: false });
  });

  it("commits the complete persisted order only after the reorder API succeeds", async () => {
    const persisted = [pinnedBravo, recent, pinnedAlpha];
    let resolveReorder!: (workspaces: Workspace[]) => void;
    apiMocks.reorderWorkspaces.mockReturnValue(new Promise<Workspace[]>((resolve) => {
      resolveReorder = resolve;
    }));

    const request = useAppStore.getState().reorderPinnedWorkspaces(pinnedBravo.id, 0);

    expect(apiMocks.reorderWorkspaces).toHaveBeenCalledWith([
      pinnedBravo.id,
      recent.id,
      pinnedAlpha.id,
    ]);
    expect(useAppStore.getState().workspaces).toEqual(original);

    resolveReorder(persisted);
    await expect(request).resolves.toBeUndefined();
    expect(useAppStore.getState().workspaces).toEqual(persisted);
  });

  it("leaves workspace state unchanged when persistence fails", async () => {
    apiMocks.reorderWorkspaces.mockRejectedValueOnce(new Error("Disk full"));

    await expect(useAppStore.getState().reorderPinnedWorkspaces(pinnedBravo.id, 0))
      .rejects.toThrow("Disk full");

    expect(useAppStore.getState().workspaces).toEqual(original);
  });

  it("rejects Recent workspaces before attempting persistence", async () => {
    await expect(useAppStore.getState().reorderPinnedWorkspaces(recent.id, 0))
      .rejects.toThrow("Pinned workspace not found");

    expect(apiMocks.reorderWorkspaces).not.toHaveBeenCalled();
    expect(useAppStore.getState().workspaces).toEqual(original);
  });
});

describe("appStore moveTerminalToWorkspace", () => {
  const targetWorkspace: Workspace = {
    ...workspace,
    id: "workspace-target",
    name: "Target workspace",
    terminals: [],
    layout: {
      type: "pane",
      id: "pane-target",
      terminalIds: [],
      activeTerminalId: null,
    },
  };
  const movedSource: Workspace = {
    ...workspace,
    terminals: [sibling],
    layout: {
      type: "pane",
      id: "pane-source",
      terminalIds: [sibling.id],
      activeTerminalId: sibling.id,
    },
  };
  const movedTarget: Workspace = {
    ...targetWorkspace,
    terminals: [source],
    layout: {
      type: "pane",
      id: "pane-target",
      terminalIds: [source.id],
      activeTerminalId: source.id,
    },
    lastOpenedAt: "2026-08-28T00:00:00Z",
    openCount: 1,
  };
  const request = {
    sourceWorkspaceId: workspace.id,
    sourcePaneId: "pane-source",
    targetWorkspaceId: targetWorkspace.id,
    targetPaneId: "pane-target",
    terminalId: source.id,
    targetIndex: 0,
  };
  const runtime = {
    id: "runtime-source",
    workspaceId: targetWorkspace.id,
    definitionId: source.id,
    processId: 42,
    status: "running" as const,
    exitCode: null,
    cols: 80,
    rows: 24,
    scrollback: [],
  };

  beforeEach(() => {
    apiMocks.moveTerminalToWorkspace.mockReset();
    apiMocks.saveWorkspace.mockReset();
    useAppStore.setState({
      workspaces: [workspace, targetWorkspace],
      activeWorkspaceId: workspace.id,
      settings: {
        ...useAppStore.getState().settings,
        lastActiveWorkspaceId: workspace.id,
      },
      runtimes: {
        [source.id]: { ...runtime, workspaceId: workspace.id },
      },
      startRequests: {},
      pendingStarts: {},
      pendingConnections: {},
      workspaceMovePending: false,
    });
  });

  it("commits both workspaces, runtime ownership, and activation together", async () => {
    apiMocks.moveTerminalToWorkspace.mockResolvedValueOnce({
      sourceWorkspace: movedSource,
      targetWorkspace: movedTarget,
      runtime,
    });

    await useAppStore.getState().moveTerminalToWorkspace(request);

    const state = useAppStore.getState();
    expect(state.workspaces).toEqual([movedSource, movedTarget]);
    expect(state.activeWorkspaceId).toBe(targetWorkspace.id);
    expect(state.settings.lastActiveWorkspaceId).toBe(targetWorkspace.id);
    expect(state.runtimes[source.id]).toEqual(runtime);
  });

  it("leaves every state slice unchanged when the atomic move fails", async () => {
    const before = useAppStore.getState();
    apiMocks.moveTerminalToWorkspace.mockRejectedValueOnce(new Error("Disk full"));

    await expect(useAppStore.getState().moveTerminalToWorkspace(request))
      .rejects.toThrow("Disk full");

    const after = useAppStore.getState();
    expect(after.workspaces).toEqual(before.workspaces);
    expect(after.activeWorkspaceId).toBe(before.activeWorkspaceId);
    expect(after.settings).toEqual(before.settings);
    expect(after.runtimes).toEqual(before.runtimes);
    expect(after.workspaceMovePending).toBe(false);
  });

  it("rejects stale workspace saves until the atomic move settles", async () => {
    let resolveMove!: (result: {
      sourceWorkspace: Workspace;
      targetWorkspace: Workspace;
      runtime: typeof runtime;
    }) => void;
    apiMocks.moveTerminalToWorkspace.mockReturnValueOnce(new Promise((resolve) => {
      resolveMove = resolve;
    }));

    const move = useAppStore.getState().moveTerminalToWorkspace(request);
    expect(useAppStore.getState().workspaceMovePending).toBe(true);
    await expect(useAppStore.getState().saveWorkspace(workspace))
      .rejects.toThrow("current terminal move");
    expect(apiMocks.saveWorkspace).not.toHaveBeenCalled();

    resolveMove({ sourceWorkspace: movedSource, targetWorkspace: movedTarget, runtime });
    await move;
    expect(useAppStore.getState().workspaceMovePending).toBe(false);
  });
});

describe("appStore terminal start lifecycle", () => {
  beforeEach(() => {
    useAppStore.setState({
      startRequests: {},
      pendingStarts: {},
      pendingConnections: {},
    });
  });

  it("keeps a terminal move-blocked from the synchronous start request through connection", () => {
    const state = useAppStore.getState();
    state.requestTerminalStart(source.id);
    expect(useAppStore.getState().pendingStarts[source.id]).toBe(true);
    expect(useAppStore.getState().pendingConnections[source.id]).toBeUndefined();

    useAppStore.getState().beginTerminalConnection(source.id);
    expect(useAppStore.getState().pendingStarts[source.id]).toBeUndefined();
    expect(useAppStore.getState().pendingConnections[source.id]).toBe(1);

    useAppStore.getState().endTerminalConnection(source.id);
    expect(useAppStore.getState().pendingConnections[source.id]).toBeUndefined();
  });
});
