// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppSettings, LauncherProfile, LauncherProfileStatus, Workspace } from "../../types";
import { SettingsDialog } from "./SettingsDialog";

const apiMocks = vi.hoisted(() => ({
  chooseLauncherProgram: vi.fn(),
  validateLauncherProfile: vi.fn(),
}));

vi.mock("../../lib/api", () => apiMocks);

const explorer: LauncherProfile = {
  id: "builtin-explorer",
  name: "File Explorer",
  program: "explorer.exe",
  arguments: ["{path}"],
  wslArguments: null,
  detectionMode: "auto",
  icon: "explorer",
  accent: null,
  builtIn: true,
};

const cursor: LauncherProfile = {
  id: "builtin-cursor",
  name: "Cursor",
  program: "cursor",
  arguments: ["{path}"],
  wslArguments: null,
  detectionMode: "auto",
  icon: "cursor",
  accent: null,
  builtIn: true,
};

const statuses: LauncherProfileStatus[] = [
  { profile: explorer, available: true, resolvedProgram: "C:\\Windows\\explorer.exe", unavailableReason: null },
  { profile: cursor, available: false, resolvedProgram: null, unavailableReason: "Cursor was not found." },
];

const settings: AppSettings = {
  theme: "system",
  openLastWorkspace: true,
  confirmBeforeClose: true,
  sidebarWidth: 236,
  lastActiveWorkspaceId: null,
  defaultLauncherProfileId: null,
  launcherProfiles: [],
};

describe("SettingsDialog launcher profiles", () => {
  beforeEach(() => {
    apiMocks.validateLauncherProfile.mockResolvedValue({
      valid: true,
      errors: [],
      resolvedProgram: "C:\\Windows\\explorer.exe",
    });
    apiMocks.chooseLauncherProgram.mockResolvedValue(null);
    vi.stubGlobal("crypto", { randomUUID: () => "profile-id" });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps unavailable built-ins visible but prevents selecting them", () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onChange });

    expect(screen.getByRole("radio", { name: "Cursor unavailable" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("radio", { name: "Cursor unavailable" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clones a built-in into an editable custom profile", async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onChange });

    fireEvent.click(screen.getByRole("button", { name: "Clone File Explorer" }));
    expect(screen.getByRole("dialog").textContent).toContain("Launcher profile");
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "My Explorer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange.mock.calls[0][0].launcherProfiles[0]).toMatchObject({
      id: "launcher-profile-id",
      name: "My Explorer",
      builtIn: false,
      icon: "explorer",
    });
  });

  it("confirms deletion and reports terminal references", async () => {
    const custom: LauncherProfile = { ...explorer, id: "custom-explorer", name: "Custom Explorer", builtIn: false };
    const customSettings = { ...settings, defaultLauncherProfileId: custom.id, launcherProfiles: [custom] };
    const workspace = workspaceWithLauncher(custom.id);
    const onDeleteProfile = vi.fn().mockResolvedValue(undefined);
    renderDialog({
      settings: customSettings,
      launcherProfiles: [...statuses, { profile: custom, available: true, resolvedProgram: "C:\\Windows\\explorer.exe", unavailableReason: null }],
      workspaces: [workspace],
      onDeleteProfile,
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete Custom Explorer" }));
    expect(screen.getByText("1 terminal will inherit the global default.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(onDeleteProfile).toHaveBeenCalledOnce());
    expect(onDeleteProfile.mock.calls[0][1]).toMatchObject({
      defaultLauncherProfileId: null,
      launcherProfiles: [],
    });
  });
});

function renderDialog(overrides: Partial<Parameters<typeof SettingsDialog>[0]> = {}) {
  return render(
    <SettingsDialog
      settings={settings}
      launcherProfiles={statuses}
      workspaces={[]}
      windowsShells={[]}
      wslDistributions={[]}
      onChange={vi.fn().mockResolvedValue(undefined)}
      onDeleteProfile={vi.fn().mockResolvedValue(undefined)}
      onClose={vi.fn()}
      {...overrides}
    />,
  );
}

function workspaceWithLauncher(profileId: string): Workspace {
  const now = "2026-08-01T00:00:00Z";
  return {
    id: "workspace-test",
    name: "Test",
    description: null,
    color: "#72d8c9",
    rootDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
    defaultShellProfile: {
      id: "pwsh",
      name: "PowerShell",
      kind: "powerShell",
      executable: "pwsh.exe",
      version: null,
      distribution: null,
      shell: null,
      loginShell: false,
      available: true,
    },
    terminals: [{
      id: "terminal-test",
      name: "Shell",
      profile: "shell",
      shellProfile: {
        id: "pwsh",
        name: "PowerShell",
        kind: "powerShell",
        executable: "pwsh.exe",
        version: null,
        distribution: null,
        shell: null,
        loginShell: false,
        available: true,
      },
      workingDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
      startupCommand: null,
      environmentVariables: [],
      autoStart: false,
      launcherProfileId: profileId,
    }],
    environmentVariables: [],
    layout: { type: "pane", id: "pane-test", terminalIds: ["terminal-test"], activeTerminalId: "terminal-test" },
    pinned: false,
    favorite: false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: null,
    openCount: 0,
  };
}
