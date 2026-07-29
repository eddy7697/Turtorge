export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type PathKind = "windows" | "wsl";
export type ShellKind = "powerShell" | "wsl";
export type TerminalProfileKind = "shell" | "claudeCode" | "codex" | "custom";
export type TerminalStatus = "starting" | "running" | "exited" | "failed" | "stopping";
export type SplitDirection = "horizontal" | "vertical";

export interface AppSettings {
  theme: ThemePreference;
  openLastWorkspace: boolean;
  confirmBeforeClose: boolean;
  sidebarWidth: number;
  lastActiveWorkspaceId?: string | null;
}

export interface WorkspacePath {
  kind: PathKind;
  value: string;
  distribution?: string | null;
}

export interface ShellProfile {
  id: string;
  name: string;
  kind: ShellKind;
  executable: string;
  version?: string | null;
  distribution?: string | null;
  shell?: string | null;
  loginShell: boolean;
  available: boolean;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface TerminalDefinition {
  id: string;
  name: string;
  profile: TerminalProfileKind;
  shellProfile: ShellProfile;
  workingDirectory: WorkspacePath;
  startupCommand?: string | null;
  environmentVariables: EnvironmentVariable[];
  autoStart: boolean;
}

export interface PaneNode {
  type: "pane";
  id: string;
  terminalIds: string[];
  activeTerminalId?: string | null;
}

export interface SplitNode {
  type: "split";
  id: string;
  direction: SplitDirection;
  ratio: number;
  first: LayoutNode;
  second: LayoutNode;
}

export type LayoutNode = PaneNode | SplitNode;

export interface Workspace {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  rootDirectory: WorkspacePath;
  defaultShellProfile: ShellProfile;
  terminals: TerminalDefinition[];
  environmentVariables: EnvironmentVariable[];
  layout: LayoutNode;
  pinned: boolean;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string | null;
  openCount: number;
}

export interface WslDistribution {
  name: string;
  isDefault: boolean;
  isRunning: boolean;
  version: number;
}

export interface WslShellDetection {
  distribution: string;
  defaultShell?: string | null;
  shells: ShellProfile[];
}

export interface BootstrapPayload {
  workspaces: Workspace[];
  settings: AppSettings;
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
}

export interface TerminalStartRequest {
  workspaceId: string;
  definition: TerminalDefinition;
  workspaceEnvironment: EnvironmentVariable[];
  cols: number;
  rows: number;
}

export interface TerminalRuntimeSnapshot {
  id: string;
  workspaceId: string;
  definitionId: string;
  processId?: number | null;
  status: TerminalStatus;
  exitCode?: number | null;
  cols: number;
  rows: number;
  scrollback: number[];
}

export type TerminalEvent =
  | { event: "snapshot"; data: number[] }
  | { event: "output"; data: number[] }
  | { event: "status"; data: TerminalStatus }
  | { event: "exited"; data: { exitCode: number } }
  | { event: "error"; data: { code: string; message: string } };

export interface ApiError {
  code: string;
  message: string;
}
