// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShellProfile, Workspace, WorkspacePath } from "../../types";
import { NewTerminalDialog } from "./NewTerminalDialog";

const apiMocks = vi.hoisted(() => ({
  chooseWindowsDirectory: vi.fn(),
  chooseWslDirectory: vi.fn(),
  detectWslShells: vi.fn(),
  validatePath: vi.fn(),
}));

vi.mock("../../lib/api", () => apiMocks);

const wslShell: ShellProfile = {
  id: "wsl-Ubuntu-24.04-zsh",
  name: "WSL Ubuntu-24.04 · zsh",
  kind: "wsl",
  executable: "wsl.exe",
  version: "zsh 5.9",
  distribution: "Ubuntu-24.04",
  shell: "/usr/bin/zsh",
  loginShell: true,
  available: true,
};

const workspace: Workspace = {
  id: "workspace-test",
  name: "Test",
  description: null,
  color: "#72d8c9",
  rootDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  defaultShellProfile: wslShell,
  terminals: [],
  environmentVariables: [],
  layout: { type: "pane", id: "pane-test", terminalIds: [], activeTerminalId: null },
  pinned: false,
  favorite: false,
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

describe("NewTerminalDialog", () => {
  beforeEach(() => {
    apiMocks.detectWslShells.mockResolvedValue({
      distribution: "Ubuntu-24.04",
      defaultShell: "/usr/bin/zsh",
      shells: [wslShell],
    });
    apiMocks.validatePath.mockResolvedValue(true);
    apiMocks.chooseWslDirectory.mockResolvedValue({
      kind: "wsl",
      value: "/home/vince/projects/app",
      distribution: "Ubuntu-24.04",
    } satisfies WorkspacePath);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("stores the WSL folder selected for the new terminal", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(
      <NewTerminalDialog
        workspace={workspace}
        windowsShells={[]}
        wslDistributions={[{ name: "Ubuntu-24.04", isDefault: true, isRunning: true, version: 2 }]}
        onClose={vi.fn()}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Browse WSL folders" }));
    await waitFor(() => expect(screen.getByLabelText("Working directory")).toHaveProperty("value", "/home/vince/projects/app"));
    fireEvent.click(screen.getByRole("button", { name: "Save and Start" }));

    await waitFor(() => expect(onCreate).toHaveBeenCalledOnce());
    expect(onCreate.mock.calls[0][0].workingDirectory).toEqual({
      kind: "wsl",
      value: "/home/vince/projects/app",
      distribution: "Ubuntu-24.04",
    });
  });

  it("explains background WSL detection with readable status text", () => {
    apiMocks.detectWslShells.mockReturnValue(new Promise(() => {}));
    render(
      <NewTerminalDialog
        workspace={workspace}
        windowsShells={[]}
        wslDistributions={[{ name: "Ubuntu-24.04", isDefault: true, isRunning: true, version: 2 }]}
        onClose={vi.fn()}
        onCreate={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain("Detecting WSL shells");
    expect(screen.getByRole("status").textContent).toContain("Ubuntu-24.04");
  });
});
