import type { DesktopPlatform, ShellProfile } from "../types";

export const CUSTOM_SHELL_ID = "__custom-native-shell__";

export type TerminalEnvironment = "windows" | "wsl" | "macos";

export function defaultEnvironment(platform: DesktopPlatform, prefersWsl = false): TerminalEnvironment {
  if (platform === "macos") return "macos";
  return prefersWsl ? "wsl" : "windows";
}

export function nativeShellProfile(executable: string, loginShell: boolean): ShellProfile {
  const normalized = executable.trim();
  const name = normalized.split("/").filter(Boolean).pop() || "Custom shell";
  const stablePath = normalized.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: `native-custom-${stablePath}`,
    name: `${name} (custom)`,
    kind: "native",
    executable: normalized,
    version: null,
    distribution: null,
    shell: name,
    loginShell,
    available: true,
  };
}

export function isCustomNativeShell(
  shell: ShellProfile,
  detectedShells: ShellProfile[],
): boolean {
  return shell.kind === "native" && !detectedShells.some((item) => item.id === shell.id);
}
