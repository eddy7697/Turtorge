import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellProfile, TerminalDefinition, Workspace } from "../types";
import { useAppStore } from "./appStore";

const apiMocks = vi.hoisted(() => ({
  openWorkspace: vi.fn(),
  saveWorkspace: vi.fn(),
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
      errors: {},
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
