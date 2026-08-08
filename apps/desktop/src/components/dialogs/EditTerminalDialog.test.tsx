// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LauncherProfileStatus, ShellProfile, TerminalDefinition, Workspace } from "../../types";
import { EditTerminalDialog } from "./EditTerminalDialog";

const apiMocks = vi.hoisted(() => ({
  chooseNativeDirectory: vi.fn(),
  chooseWindowsDirectory: vi.fn(),
  chooseWslDirectory: vi.fn(),
  detectWslShells: vi.fn(),
  validatePath: vi.fn(),
  validateShellExecutable: vi.fn(),
}));
vi.mock("../../lib/api", () => apiMocks);

const powerShell: ShellProfile = {
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

const terminal: TerminalDefinition = {
  id: "terminal-test",
  name: "Terminal",
  profile: "shell",
  shellProfile: powerShell,
  workingDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
  launcherProfileId: null,
};

const workspace: Workspace = {
  id: "workspace-test",
  name: "Test",
  description: null,
  color: "#72d8c9",
  rootDirectory: terminal.workingDirectory,
  defaultShellProfile: powerShell,
  terminals: [terminal],
  environmentVariables: [],
  layout: { type: "pane", id: "pane-test", terminalIds: [terminal.id], activeTerminalId: terminal.id },
  pinned: false,
  favorite: false,
  createdAt: "2026-08-01T00:00:00Z",
  updatedAt: "2026-08-01T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

const explorer: LauncherProfileStatus = {
  profile: {
    id: "builtin-explorer",
    name: "File Explorer",
    program: "explorer.exe",
    arguments: ["{path}"],
    wslArguments: null,
    detectionMode: "auto",
    icon: "explorer",
    accent: null,
    builtIn: true,
  },
  available: true,
  resolvedProgram: "C:\\Windows\\explorer.exe",
  unavailableReason: null,
};

describe("EditTerminalDialog", () => {
  beforeEach(() => apiMocks.validatePath.mockResolvedValue(true));
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("applies a launcher-only change immediately without requesting restart", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderDialog({ onSave, onClose });

    fireEvent.change(screen.getByLabelText("Open with"), { target: { value: explorer.profile.id } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0][0].launcherProfileId).toBe(explorer.profile.id);
    expect(screen.queryByText("Restart terminal?")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("asks before restarting a running terminal after process settings change", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onRestart = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderDialog({ onSave, onRestart, onClose });

    fireEvent.change(screen.getByLabelText("Working directory"), { target: { value: "E:\\Projects\\Changed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    await waitFor(() => expect(screen.getByRole("dialog").textContent).toContain("Restart terminal?"));
    expect(onRestart).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Restart Now" }));

    await waitFor(() => expect(onRestart).toHaveBeenCalledOnce());
    expect(onClose).toHaveBeenCalledOnce();
  });
});

function renderDialog(overrides: Partial<Parameters<typeof EditTerminalDialog>[0]> = {}) {
  return render(
    <EditTerminalDialog
      definition={terminal}
      workspace={workspace}
      windowsShells={[powerShell]}
      wslDistributions={[]}
      launcherProfiles={[explorer]}
      globalDefaultLauncherId={null}
      running
      onSave={vi.fn().mockResolvedValue(undefined)}
      onRestart={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}
