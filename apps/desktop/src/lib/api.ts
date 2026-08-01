import { Channel, invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type {
  AppSettings,
  BootstrapPayload,
  LauncherLaunchResult,
  LauncherOpenRequest,
  LauncherProfile,
  LauncherValidationResult,
  ShellProfile,
  TerminalEvent,
  TerminalRuntimeSnapshot,
  TerminalStartRequest,
  Workspace,
  WorkspacePath,
  WslDistribution,
  WslShellDetection,
} from "../types";

export const isTauri = (): boolean => "__TAURI_INTERNALS__" in window;

let mockWorkspaces: Workspace[] = [];
const mockRuntimes = new Map<string, TerminalRuntimeSnapshot>();
const mockScrollback = new Map<string, Uint8Array>();
let mockSettings: AppSettings = {
  theme: "system",
  openLastWorkspace: true,
  confirmBeforeClose: true,
  sidebarWidth: 236,
  lastActiveWorkspaceId: null,
  defaultLauncherProfileId: null,
  launcherProfiles: [],
};

const mockExplorerLauncher: LauncherProfile = {
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

const mockBuiltInLaunchers: LauncherProfile[] = [
  mockExplorerLauncher,
  mockLauncher("builtin-vscode", "Visual Studio Code", "code", "vsCode", ["{path}"], ["--remote", "wsl+{distribution}", "{wslPath}"]),
  mockLauncher("builtin-cursor", "Cursor", "cursor", "cursor", ["{path}"], ["--remote", "wsl+{distribution}", "{wslPath}"]),
  mockLauncher("builtin-antigravity", "Antigravity", "antigravity", "antigravity"),
  mockLauncher("builtin-zed", "Zed", "zed", "zed"),
  mockLauncher("builtin-intellij", "IntelliJ IDEA", "idea64", "intelliJ"),
  mockLauncher("builtin-rider", "JetBrains Rider", "rider64", "rider"),
  mockLauncher("builtin-webstorm", "WebStorm", "webstorm64", "webStorm"),
  mockLauncher("builtin-pycharm", "PyCharm", "pycharm64", "pyCharm"),
  mockLauncher("builtin-unity", "Unity", "Unity.exe", "unity", ["-projectPath", "{projectRoot}"]),
];

const mockPowerShell: ShellProfile = {
  id: "powershell-7.5.2",
  name: "PowerShell 7.5.2",
  kind: "powerShell",
  executable: "pwsh.exe",
  version: "7.5.2",
  loginShell: false,
  available: true,
};

const mockWslShell: ShellProfile = {
  id: "wsl-Ubuntu-20.04-zsh",
  name: "WSL Ubuntu-20.04 · zsh",
  kind: "wsl",
  executable: "wsl.exe",
  version: "zsh 5.8.1",
  distribution: "Ubuntu-20.04",
  shell: "/usr/bin/zsh",
  loginShell: true,
  available: true,
};

function mockBootstrap(): BootstrapPayload {
  if (mockWorkspaces.length === 0 && new URLSearchParams(location.search).has("demo")) {
    const now = new Date().toISOString();
    mockWorkspaces = [
      {
        id: "workspace-demo",
        name: "Turtorge",
        description: "Workspace-first terminal manager",
        color: "#72d8c9",
        rootDirectory: { kind: "windows", value: "E:\\Projects\\Turtorge" },
        defaultShellProfile: mockWslShell,
        environmentVariables: [],
        pinned: true,
        favorite: true,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        openCount: 4,
        terminals: [
          {
            id: "terminal-codex",
            name: "Codex",
            profile: "codex",
            shellProfile: mockWslShell,
            workingDirectory: { kind: "windows", value: "E:\\Projects\\Turtorge" },
            environmentVariables: [],
            autoStart: true,
          },
          {
            id: "terminal-powershell",
            name: "PowerShell 7",
            profile: "shell",
            shellProfile: mockPowerShell,
            workingDirectory: { kind: "windows", value: "E:\\Projects\\Turtorge" },
            environmentVariables: [],
            autoStart: false,
          },
          {
            id: "terminal-server",
            name: "API Server",
            profile: "custom",
            shellProfile: mockWslShell,
            workingDirectory: { kind: "windows", value: "E:\\Projects\\Turtorge" },
            startupCommand: "pnpm dev",
            environmentVariables: [],
            autoStart: true,
          },
          {
            id: "terminal-zsh",
            name: "WSL zsh",
            profile: "shell",
            shellProfile: mockWslShell,
            workingDirectory: { kind: "windows", value: "E:\\Projects\\Turtorge" },
            environmentVariables: [],
            autoStart: true,
          },
        ],
        layout: {
          type: "split",
          id: "split-root",
          direction: "horizontal",
          ratio: 0.5,
          first: {
            type: "pane",
            id: "pane-left",
            terminalIds: ["terminal-codex", "terminal-powershell"],
            activeTerminalId: "terminal-codex",
          },
          second: {
            type: "split",
            id: "split-right",
            direction: "vertical",
            ratio: 0.5,
            first: {
              type: "pane",
              id: "pane-server",
              terminalIds: ["terminal-server"],
              activeTerminalId: "terminal-server",
            },
            second: {
              type: "pane",
              id: "pane-zsh",
              terminalIds: ["terminal-zsh"],
              activeTerminalId: "terminal-zsh",
            },
          },
        },
      },
    ];
  }
  return {
    workspaces: structuredClone(mockWorkspaces),
    settings: {
      ...structuredClone(mockSettings),
      lastActiveWorkspaceId: mockSettings.lastActiveWorkspaceId ?? mockWorkspaces[0]?.id ?? null,
    },
    windowsShells: [mockPowerShell],
    wslDistributions: [
      { name: "Ubuntu-20.04", isDefault: true, isRunning: true, version: 2 },
    ],
    launcherProfiles: [
      ...mockBuiltInLaunchers.map((profile, index) => ({
        profile,
        available: index < 4,
        resolvedProgram: index < 4 ? profile.program : null,
        unavailableReason: index < 4 ? null : `${profile.name} was not found.`,
      })),
      ...mockSettings.launcherProfiles.map((profile) => ({
        profile: structuredClone(profile),
        available: Boolean(profile.program),
        resolvedProgram: profile.program || null,
        unavailableReason: profile.program ? null : "Program not configured",
      })),
    ],
  };
}

export async function bootstrap(): Promise<BootstrapPayload> {
  return isTauri() ? invoke("app_bootstrap") : mockBootstrap();
}

export async function saveWorkspace(workspace: Workspace): Promise<Workspace> {
  if (isTauri()) return invoke("workspace_save", { workspace });
  const index = mockWorkspaces.findIndex((item) => item.id === workspace.id);
  if (index >= 0) mockWorkspaces[index] = structuredClone(workspace);
  else mockWorkspaces.push(structuredClone(workspace));
  return workspace;
}

export async function openWorkspace(id: string): Promise<Workspace> {
  if (isTauri()) return invoke("workspace_open", { id });
  const workspace = mockWorkspaces.find((item) => item.id === id);
  if (!workspace) throw new Error("Workspace not found");
  workspace.openCount += 1;
  workspace.lastOpenedAt = new Date().toISOString();
  return structuredClone(workspace);
}

export async function deleteWorkspace(id: string): Promise<void> {
  if (isTauri()) return invoke("workspace_delete", { id });
  mockWorkspaces = mockWorkspaces.filter((workspace) => workspace.id !== id);
}

export async function updateSettings(settings: AppSettings): Promise<AppSettings> {
  if (isTauri()) return invoke("settings_update", { settings });
  mockSettings = structuredClone(settings);
  return structuredClone(settings);
}

export async function validateLauncherProfile(
  profile: LauncherProfile,
): Promise<LauncherValidationResult> {
  if (isTauri()) return invoke("launcher_validate_profile", { profile });
  const hasPath = [...profile.arguments, ...(profile.wslArguments ?? [])].some((argument) =>
    ["{path}", "{wslPath}", "{projectRoot}"].some((placeholder) =>
      argument.includes(placeholder),
    ),
  );
  return {
    valid: Boolean(profile.program.trim()) && hasPath,
    errors: hasPath ? [] : ["Arguments must include a path placeholder."],
    resolvedProgram: profile.program || null,
  };
}

export async function listLauncherProfiles(): Promise<BootstrapPayload["launcherProfiles"]> {
  if (isTauri()) return invoke("launcher_list_profiles");
  return mockBootstrap().launcherProfiles;
}

export async function chooseLauncherProgram(): Promise<string | null> {
  if (!isTauri()) return "C:\\Program Files\\Editor\\Editor.exe";
  const selected = await open({
    directory: false,
    multiple: false,
    filters: [{ name: "Launcher programs", extensions: ["exe", "com", "cmd", "bat"] }],
  });
  return typeof selected === "string" ? selected : null;
}

export async function openLauncher(
  request: LauncherOpenRequest,
): Promise<LauncherLaunchResult> {
  if (isTauri()) return invoke("launcher_open", { request });
  const profileId = request.profileId ?? "builtin-explorer";
  return {
    profileId,
    program: "explorer.exe",
    arguments: [request.path.value],
  };
}

export async function detectWindowsShells(): Promise<ShellProfile[]> {
  return isTauri() ? invoke("platform_detect_windows_shells") : [mockPowerShell];
}

export async function listWslDistributions(): Promise<WslDistribution[]> {
  return isTauri()
    ? invoke("platform_list_wsl_distributions")
    : [{ name: "Ubuntu-20.04", isDefault: true, isRunning: true, version: 2 }];
}

export async function detectWslShells(distribution: string): Promise<WslShellDetection> {
  if (isTauri()) return invoke("platform_detect_wsl_shells", { distribution });
  return {
    distribution,
    defaultShell: "/usr/bin/zsh",
    shells: [mockWslShell, { ...mockWslShell, id: `wsl-${distribution}-bash`, name: `WSL ${distribution} · bash`, shell: "/usr/bin/bash", version: "GNU bash 5.0.17" }],
  };
}

export async function validatePath(path: WorkspacePath): Promise<boolean> {
  return isTauri() ? invoke("platform_validate_path", { path }) : path.value.length > 0;
}

export async function chooseWindowsDirectory(): Promise<string | null> {
  if (!isTauri()) return "E:\\Projects\\Turtorge";
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" ? selected : null;
}

export async function chooseWslDirectory(distribution: string): Promise<WorkspacePath | null> {
  if (!isTauri()) {
    return { kind: "wsl", value: "~/projects/Turtorge", distribution };
  }
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: `\\\\wsl.localhost\\${distribution}\\`,
  });
  if (typeof selected !== "string") return null;
  const value = await invoke<string>("platform_resolve_wsl_path", {
    path: { kind: "windows", value: selected, distribution: null } satisfies WorkspacePath,
    distribution,
  });
  return { kind: "wsl", value, distribution };
}

export async function startTerminal(
  request: TerminalStartRequest,
  connectionId: string,
  onEvent: (event: TerminalEvent) => void,
): Promise<TerminalRuntimeSnapshot> {
  if (isTauri()) {
    const channel = new Channel<TerminalEvent>();
    channel.onmessage = onEvent;
    return invoke("terminal_start", { request, connectionId, onEvent: channel });
  }
  const runtime: TerminalRuntimeSnapshot = {
    id: `runtime-${request.definition.id}`,
    workspaceId: request.workspaceId,
    definitionId: request.definition.id,
    processId: 4242,
    status: "running",
    cols: request.cols,
    rows: request.rows,
    scrollback: [],
  };
  mockRuntimes.set(runtime.id, runtime);
  const output = new TextEncoder().encode(mockTerminalOutput(request.definition.name));
  mockScrollback.set(runtime.id, output);
  queueMicrotask(() => {
    onEvent({ event: "status", data: "running" });
    onEvent({
      event: "output",
      data: Array.from(output),
    });
  });
  return runtime;
}

export async function attachTerminal(
  runtimeId: string,
  connectionId: string,
  onEvent: (event: TerminalEvent) => void,
): Promise<TerminalRuntimeSnapshot> {
  if (isTauri()) {
    const channel = new Channel<TerminalEvent>();
    channel.onmessage = onEvent;
    return invoke("terminal_attach", { runtimeId, connectionId, onEvent: channel });
  }
  const runtime = mockRuntimes.get(runtimeId);
  if (!runtime) throw new Error("Terminal not found");
  const snapshot = mockScrollback.get(runtimeId);
  if (snapshot) queueMicrotask(() => onEvent({ event: "snapshot", data: Array.from(snapshot) }));
  return runtime;
}

export async function detachTerminal(runtimeId: string, connectionId: string): Promise<void> {
  if (isTauri()) await invoke("terminal_detach", { runtimeId, connectionId });
}

export async function writeTerminal(runtimeId: string, data: Uint8Array): Promise<void> {
  if (isTauri()) await invoke("terminal_write", { runtimeId, data: Array.from(data) });
}

export async function writeTerminalDefinition(definitionId: string, data: Uint8Array): Promise<void> {
  if (isTauri()) await invoke("terminal_write_definition", { definitionId, data: Array.from(data) });
}

export async function resizeTerminal(runtimeId: string, cols: number, rows: number): Promise<void> {
  if (isTauri()) await invoke("terminal_resize", { runtimeId, cols, rows });
}

export async function closeTerminal(runtimeId: string): Promise<void> {
  if (isTauri()) await invoke("terminal_close", { runtimeId });
  mockRuntimes.delete(runtimeId);
  mockScrollback.delete(runtimeId);
}

export async function listRuntimes(): Promise<TerminalRuntimeSnapshot[]> {
  return isTauri()
    ? invoke("terminal_list_runtime")
    : Array.from(mockRuntimes.values());
}

export async function terminateAllTerminals(): Promise<void> {
  if (isTauri()) await invoke("terminal_terminate_all");
  mockRuntimes.clear();
  mockScrollback.clear();
}

function mockTerminalOutput(name: string): string {
  return `\u001b[38;2;114;216;201mTurtorge\u001b[0m · ${name}\r\n` +
    `\u001b[90mInteractive PTY ready. This browser preview uses a mock stream.\u001b[0m\r\n\r\n` +
    `\u001b[38;2;114;216;201m➜\u001b[0m  \u001b[38;2;121;184;232mturtorge\u001b[0m git:(\u001b[31mdevelop\u001b[0m) `;
}

function mockLauncher(
  id: string,
  name: string,
  program: string,
  icon: LauncherProfile["icon"],
  args: string[] = ["{path}"],
  wslArguments: string[] | null = null,
): LauncherProfile {
  return {
    id,
    name,
    program,
    arguments: args,
    wslArguments,
    detectionMode: "auto",
    icon,
    accent: null,
    builtIn: true,
  };
}
