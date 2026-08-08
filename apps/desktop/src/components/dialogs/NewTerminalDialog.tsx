import { FolderOpen, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { chooseNativeDirectory, chooseWindowsDirectory, chooseWslDirectory, detectWslShells, validatePath, validateShellExecutable } from "../../lib/api";
import { createId } from "../../lib/ids";
import { CUSTOM_SHELL_ID, defaultEnvironment, isCustomNativeShell, nativeShellProfile, type TerminalEnvironment } from "../../lib/platform";
import type { DesktopPlatform, EnvironmentVariable, LauncherProfileStatus, PathKind, ShellProfile, TerminalDefinition, TerminalProfileKind, Workspace, WorkspacePath, WslDistribution } from "../../types";
import { EnvironmentEditor } from "../ui/EnvironmentEditor";
import { LauncherProfileSelect } from "../ui/LauncherProfileSelect";
import { Modal } from "../ui/Modal";

export function NewTerminalDialog({
  workspace,
  windowsShells,
  nativeShells = [],
  platform = "windows",
  wslDistributions,
  launcherProfiles = [],
  globalDefaultLauncherId = null,
  onClose,
  onCreate,
}: {
  workspace: Workspace;
  windowsShells: ShellProfile[];
  nativeShells?: ShellProfile[];
  platform?: DesktopPlatform;
  wslDistributions: WslDistribution[];
  launcherProfiles?: LauncherProfileStatus[];
  globalDefaultLauncherId?: string | null;
  onClose: () => void;
  onCreate: (definition: TerminalDefinition) => Promise<void>;
}) {
  const defaultKind = workspace.defaultShellProfile.kind;
  const isMacos = platform === "macos";
  const [environment, setEnvironment] = useState<TerminalEnvironment>(defaultEnvironment(platform, defaultKind === "wsl"));
  const [distribution, setDistribution] = useState(workspace.defaultShellProfile.distribution ?? wslDistributions.find((item) => item.isDefault)?.name ?? "");
  const [wslShells, setWslShells] = useState<ShellProfile[]>(defaultKind === "wsl" ? [workspace.defaultShellProfile] : []);
  const defaultIsCustomNative = isCustomNativeShell(workspace.defaultShellProfile, nativeShells);
  const [shellId, setShellId] = useState(defaultIsCustomNative ? CUSTOM_SHELL_ID : workspace.defaultShellProfile.id);
  const [customShellPath, setCustomShellPath] = useState(defaultIsCustomNative ? workspace.defaultShellProfile.executable : "");
  const [customLoginShell, setCustomLoginShell] = useState(defaultIsCustomNative ? workspace.defaultShellProfile.loginShell : true);
  const [profile, setProfile] = useState<TerminalProfileKind>("shell");
  const [name, setName] = useState("Terminal");
  const [workingDirectory, setWorkingDirectory] = useState<WorkspacePath>(() =>
    initialWorkingDirectory(workspace.rootDirectory, defaultEnvironment(platform, defaultKind === "wsl"), distribution),
  );
  const [command, setCommand] = useState("");
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [autoStart, setAutoStart] = useState(false);
  const [launcherProfileId, setLauncherProfileId] = useState<string | null>(null);
  const [loadingShells, setLoadingShells] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (environment !== "wsl" || !distribution) return;
    let cancelled = false;
    setLoadingShells(true);
    detectWslShells(distribution)
      .then((result) => {
        if (cancelled) return;
        setWslShells(result.shells);
        const matching = result.shells.find((shell) => shell.id === workspace.defaultShellProfile.id);
        setShellId((matching ?? result.shells[0])?.id ?? "");
      })
      .catch((reason) => !cancelled && setError(String(reason?.message ?? reason)))
      .finally(() => !cancelled && setLoadingShells(false));
    return () => { cancelled = true; };
  }, [distribution, environment, workspace.defaultShellProfile.id]);

  const availableShells = environment === "macos" ? nativeShells : environment === "wsl" ? wslShells : windowsShells;
  const selectedShell = shellId === CUSTOM_SHELL_ID && customShellPath.trim()
    ? nativeShellProfile(customShellPath, customLoginShell)
    : availableShells.find((shell) => shell.id === shellId);
  const suggestedName = useMemo(() => {
    if (profile === "claudeCode") return "Claude Code";
    if (profile === "codex") return "Codex";
    if (profile === "custom") return "Custom Command";
    if (selectedShell?.kind === "native") return selectedShell.name.replace(/ \(.+\)$/, "");
    if (selectedShell?.shell?.endsWith("zsh")) return "WSL zsh";
    if (selectedShell?.shell?.endsWith("bash")) return "WSL bash";
    return selectedShell?.name ?? "Terminal";
  }, [profile, selectedShell]);

  useEffect(() => setName(suggestedName), [suggestedName]);

  const changeEnvironment = (next: TerminalEnvironment) => {
    setEnvironment(next);
    if (next === "windows") {
      setShellId(windowsShells[0]?.id ?? "");
      setWorkingDirectory({ ...workspace.rootDirectory });
      return;
    }
    setWorkingDirectory(initialWorkingDirectory(workspace.rootDirectory, next, distribution));
  };

  const changeDistribution = (next: string) => {
    setDistribution(next);
    setWorkingDirectory((current) => current.kind === "wsl"
      ? { kind: "wsl", value: current.distribution === next ? current.value : "~", distribution: next }
      : current);
  };

  const changeWorkingDirectory = (value: string) => {
    const kind = environment === "macos" ? "native" : environment === "windows" ? "windows" : inferPathKind(value, workingDirectory.kind);
    setWorkingDirectory({
      kind,
      value,
      distribution: kind === "wsl" ? distribution : null,
    });
  };

  const browseWorkingDirectory = async () => {
    setError("");
    try {
      if (environment === "wsl") {
        const selected = await chooseWslDirectory(distribution);
        if (selected) setWorkingDirectory(selected);
      } else if (environment === "macos") {
        const selected = await chooseNativeDirectory();
        if (selected) setWorkingDirectory({ kind: "native", value: selected, distribution: null });
      } else {
        const selected = await chooseWindowsDirectory();
        if (selected) setWorkingDirectory({ kind: "windows", value: selected, distribution: null });
      }
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!selectedShell || !name.trim()) {
      setError("Select an available shell and enter a terminal name.");
      return;
    }
    if (selectedShell.kind === "native" && !(await validateShellExecutable(selectedShell.executable))) {
      setError("The selected shell is not an executable file.");
      return;
    }
    const terminalDirectory: WorkspacePath = workingDirectory.kind === "wsl"
      ? { ...workingDirectory, value: workingDirectory.value.trim(), distribution }
      : { ...workingDirectory, value: workingDirectory.value.trim(), distribution: null };
    if (!terminalDirectory.value) {
      setError("Choose a working directory for this terminal.");
      return;
    }
    if (selectedShell.kind === "powerShell" && terminalDirectory.kind === "wsl") {
      setError("A Windows shell cannot start directly in a WSL-native path. Choose WSL or a Windows-mounted workspace.");
      return;
    }
    setSaving(true);
    try {
      if (!(await validatePath(terminalDirectory))) {
        setError("The selected working directory does not exist. Locate it or edit the path.");
        return;
      }
      await onCreate({
        id: createId("terminal"),
        name: name.trim(),
        profile,
        shellProfile: selectedShell,
        workingDirectory: terminalDirectory,
        startupCommand: profile === "custom" ? command.trim() || null : null,
        environmentVariables: variables.filter((item) => item.key.trim()),
        autoStart,
        launcherProfileId,
      });
      onClose();
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New Terminal" description="Start now; Auto Start only controls the next workspace restore." onClose={onClose} width="medium" footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="new-terminal-form" disabled={loadingShells || saving}>{saving && <LoaderCircle className="spin" size={14} />} Save and Start</button></>}>
      <form id="new-terminal-form" className="form-grid" onSubmit={submit}>
        <fieldset className="field full-width segmented-field">
          <legend>Environment</legend>
          <div className="segmented-control">
            {isMacos ? <button type="button" className="active">macOS</button> : <><button type="button" disabled={workspace.rootDirectory.kind === "wsl"} className={environment === "windows" ? "active" : ""} onClick={() => changeEnvironment("windows")}>Windows</button><button type="button" disabled={wslDistributions.length === 0} className={environment === "wsl" ? "active" : ""} onClick={() => changeEnvironment("wsl")}>WSL</button></>}
          </div>
        </fieldset>
        {environment === "wsl" && <label className="field full-width"><span>Distribution</span><select value={distribution} onChange={(event) => changeDistribution(event.target.value)}>{wslDistributions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>}
        <label className="field full-width"><span>Shell</span><select value={shellId} disabled={loadingShells} onChange={(event) => setShellId(event.target.value)}>{loadingShells && <option>Detecting shells…</option>}{!loadingShells && availableShells.length === 0 && <option>No supported shell found</option>}{availableShells.map((shell) => <option key={shell.id} value={shell.id}>{shell.name}</option>)}{isMacos && <option value={CUSTOM_SHELL_ID}>Custom shell…</option>}</select></label>
        {isMacos && shellId === CUSTOM_SHELL_ID && <><label className="field"><span>Shell executable</span><input value={customShellPath} placeholder="/opt/homebrew/bin/fish" onChange={(event) => setCustomShellPath(event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={customLoginShell} onChange={(event) => setCustomLoginShell(event.target.checked)} /><span><strong>Login shell</strong><small>Pass -l before interactive mode.</small></span></label></>}
        <label className="field"><span>Profile</span><select value={profile} onChange={(event) => setProfile(event.target.value as TerminalProfileKind)}><option value="shell">Shell</option><option value="claudeCode">Claude Code</option><option value="codex">Codex</option><option value="custom">Custom command</option></select></label>
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <div className="field full-width"><label htmlFor="new-terminal-working-directory">Working directory</label><div className="input-with-action"><input id="new-terminal-working-directory" value={workingDirectory.value} placeholder={environment === "wsl" ? "~/projects/app or C:\\Projects\\App" : environment === "macos" ? "~/Projects/App" : "C:\\Projects\\App"} onChange={(event) => changeWorkingDirectory(event.target.value)} /><button type="button" className="icon-button" onClick={() => void browseWorkingDirectory()} aria-label={environment === "wsl" ? "Browse WSL folders" : "Browse folders"} title="Browse folders"><FolderOpen size={15} /></button></div>{(environment === "wsl" || environment === "macos") && <small>Saved for this terminal. If the folder disappears later, Turtorge starts it in ~ and shows a notice.</small>}</div>
        {profile === "custom" && <label className="field full-width"><span>Startup command</span><input value={command} placeholder="pnpm dev" onChange={(event) => setCommand(event.target.value)} /></label>}
        <LauncherProfileSelect launcherProfiles={launcherProfiles} value={launcherProfileId} globalDefaultProfileId={globalDefaultLauncherId} onChange={setLauncherProfileId} label="Open with (optional)" helper="Leave blank to inherit the global launcher. This does not open anything when the terminal starts." />
        <label className="checkbox-field full-width"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /><span><strong>Auto Start</strong><small>Start this terminal when the workspace is restored.</small></span></label>
        <details className="advanced-section full-width"><summary>Terminal environment variables</summary><p>Values are stored as plain text. Do not store secrets.</p><EnvironmentEditor value={variables} onChange={setVariables} /></details>
        {loadingShells && <div className="form-status full-width" role="status" aria-live="polite"><LoaderCircle className="spin" size={15} /><span><strong>Detecting WSL shells…</strong><small>Starting {distribution} if needed and checking its available login shells.</small></span></div>}
        {saving && <div className="form-status full-width" role="status" aria-live="polite"><LoaderCircle className="spin" size={15} /><span><strong>Preparing terminal…</strong><small>Validating the working directory and saving this terminal.</small></span></div>}
        {error && <div className="form-error full-width">{error}</div>}
      </form>
    </Modal>
  );
}

function initialWorkingDirectory(
  rootDirectory: WorkspacePath,
  environment: TerminalEnvironment,
  distribution: string,
): WorkspacePath {
  if (environment === "macos") {
    return rootDirectory.kind === "native"
      ? { ...rootDirectory, distribution: null }
      : { kind: "native", value: "~", distribution: null };
  }
  if (environment === "windows" || rootDirectory.kind === "windows") {
    return { ...rootDirectory };
  }
  if (!rootDirectory.distribution || rootDirectory.distribution === distribution) {
    return { ...rootDirectory, distribution };
  }
  return { kind: "wsl", value: "~", distribution };
}

function inferPathKind(value: string, current: PathKind): PathKind {
  const trimmed = value.trim();
  if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("/")) return "wsl";
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) return "windows";
  return current;
}
