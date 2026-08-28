// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../stores/appStore";
import type { ShellProfile, TerminalDefinition, Workspace } from "../../types";
import { TerminalActions, type TerminalActionRequest } from "./TerminalActions";

const apiMocks = vi.hoisted(() => ({
  closeTerminal: vi.fn(),
  openLauncher: vi.fn(),
  chooseWindowsDirectory: vi.fn(),
  chooseWslDirectory: vi.fn(),
  detectWslShells: vi.fn(),
  validatePath: vi.fn(),
}));
vi.mock("../../lib/api", () => apiMocks);

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

const definition: TerminalDefinition = {
  id: "terminal-test",
  name: "SSH session",
  profile: "shell",
  shellProfile: shell,
  workingDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
};

const workspace: Workspace = {
  id: "workspace-test",
  name: "Test",
  description: null,
  color: "#72d8c9",
  rootDirectory: definition.workingDirectory,
  defaultShellProfile: shell,
  terminals: [definition],
  environmentVariables: [],
  layout: { type: "pane", id: "pane-test", terminalIds: [definition.id], activeTerminalId: definition.id },
  pinned: false,
  favorite: false,
  createdAt: "2026-08-05T00:00:00Z",
  updatedAt: "2026-08-05T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

describe("TerminalActions", () => {
  afterEach(cleanup);
  beforeEach(() => {
    apiMocks.closeTerminal.mockReset();
    apiMocks.closeTerminal.mockResolvedValue(undefined);
    useAppStore.setState({
      runtimes: {},
      pendingConnections: {},
      startRequests: {},
      pendingStarts: {},
      errors: {},
      launcherProfiles: [],
      windowsShells: [shell],
      wslDistributions: [],
      settings: {
        theme: "system",
        openLastWorkspace: true,
        confirmBeforeClose: true,
        sidebarWidth: 236,
        lastActiveWorkspaceId: null,
        defaultLauncherProfileId: null,
        launcherProfiles: [],
      },
    });
  });

  it("confirms a force restart and requests a fresh terminal generation", async () => {
    useAppStore.setState({
      runtimes: {
        [definition.id]: {
          id: "runtime-test",
          workspaceId: workspace.id,
          definitionId: definition.id,
          processId: 42,
          status: "running",
          exitCode: null,
          cols: 80,
          rows: 24,
          scrollback: [],
        },
      },
    });
    const onRequestChange = vi.fn();
    const { rerender } = render(renderActions(menuRequest(), onRequestChange));

    fireEvent.click(screen.getByRole("menuitem", { name: "Force Restart" }));
    const restartRequest = onRequestChange.mock.calls.at(-1)?.[0] as TerminalActionRequest;
    rerender(renderActions(restartRequest, onRequestChange));
    fireEvent.click(screen.getByRole("button", { name: "Force Restart" }));

    await waitFor(() => expect(apiMocks.closeTerminal).toHaveBeenCalledWith("runtime-test"));
    expect(useAppStore.getState().startRequests[definition.id]).toBe(1);
  });

  it("always confirms deletion of a stopped terminal", async () => {
    const onRequestChange = vi.fn();
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(renderActions(menuRequest(), onRequestChange, onRemove));

    fireEvent.click(screen.getByRole("menuitem", { name: /Delete Terminal/ }));
    const deleteRequest = onRequestChange.mock.calls.at(-1)?.[0] as TerminalActionRequest;
    rerender(renderActions(deleteRequest, onRequestChange, onRemove));
    expect(screen.getByText("This terminal is not currently running.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Terminal" }));

    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(workspace, definition.id));
    expect(apiMocks.closeTerminal).not.toHaveBeenCalled();
  });

  it("duplicates a terminal directly from the shared terminal menu", async () => {
    const onRequestChange = vi.fn();
    const onDuplicate = vi.fn().mockResolvedValue(undefined);
    render(renderActions(menuRequest(), onRequestChange, undefined, onDuplicate));

    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate Terminal" }));

    await waitFor(() => expect(onDuplicate).toHaveBeenCalledWith(workspace.id, definition.id));
    expect(onRequestChange).toHaveBeenCalledWith(null);
  });

  it("disables duplication when the terminal is not assigned to a pane", () => {
    const orphanWorkspace: Workspace = {
      ...workspace,
      layout: { type: "pane", id: "pane-test", terminalIds: [], activeTerminalId: null },
    };
    render(renderActions(menuRequest(orphanWorkspace), vi.fn()));

    const duplicate = screen.getByRole("menuitem", { name: /Duplicate Terminal/ }) as HTMLButtonElement;
    expect(duplicate.disabled).toBe(true);
    expect(duplicate.title).toBe("Terminal is not assigned to a pane.");
  });

  it("shows a readable error when the duplicate cannot be persisted", async () => {
    const onDuplicate = vi.fn().mockRejectedValue(new Error("Workspace storage is unavailable."));
    render(renderActions(menuRequest(), vi.fn(), undefined, onDuplicate));

    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate Terminal" }));

    expect(await screen.findByText("Couldn’t duplicate terminal")).toBeTruthy();
    expect(screen.getByText("Workspace storage is unavailable.")).toBeTruthy();
  });
});

function menuRequest(targetWorkspace = workspace): TerminalActionRequest {
  return { kind: "menu", target: { workspace: targetWorkspace, definition }, point: { x: 100, y: 80 } };
}

function renderActions(
  request: TerminalActionRequest,
  onRequestChange: (request: TerminalActionRequest | null) => void,
  onRemove = vi.fn().mockResolvedValue(undefined),
  onDuplicate = vi.fn().mockResolvedValue(undefined),
) {
  return (
    <TerminalActions
      request={request}
      onRequestChange={onRequestChange}
      onDuplicate={onDuplicate}
      onRename={vi.fn().mockResolvedValue(undefined)}
      onEdit={vi.fn().mockResolvedValue(undefined)}
      onRemove={onRemove}
      onOpenLauncherSettings={vi.fn()}
    />
  );
}
