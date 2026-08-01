import { FolderOpen, LoaderCircle, RotateCw } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { chooseWindowsDirectory, chooseWslDirectory, detectWslShells, validatePath } from "../../lib/api";
import type {
  EnvironmentVariable,
  LauncherProfileStatus,
  PathKind,
  ShellProfile,
  TerminalDefinition,
  TerminalProfileKind,
  Workspace,
  WorkspacePath,
  WslDistribution,
} from "../../types";
import { EnvironmentEditor } from "../ui/EnvironmentEditor";
import { LauncherProfileSelect } from "../ui/LauncherProfileSelect";
import { Modal } from "../ui/Modal";

export function EditTerminalDialog({
  definition,
  workspace,
  windowsShells,
  wslDistributions,
  launcherProfiles,
  globalDefaultLauncherId,
  running,
  onSave,
  onRestart,
  onClose,
}: {
  definition: TerminalDefinition;
  workspace: Workspace;
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  launcherProfiles: LauncherProfileStatus[];
  globalDefaultLauncherId?: string | null;
  running: boolean;
  onSave: (definition: TerminalDefinition) => Promise<void>;
  onRestart: () => Promise<void>;
  onClose: () => void;
}) {
  const initialEnvironment = definition.shellProfile.kind === "wsl" ? "wsl" : "windows";
  const [environment, setEnvironment] = useState<"windows" | "wsl">(initialEnvironment);
  const [distribution, setDistribution] = useState(
    definition.shellProfile.distribution
      ?? definition.workingDirectory.distribution
      ?? wslDistributions.find((item) => item.isDefault)?.name
      ?? "",
  );
  const [wslShells, setWslShells] = useState<ShellProfile[]>(
    initialEnvironment === "wsl" ? [definition.shellProfile] : [],
  );
  const [shellId, setShellId] = useState(definition.shellProfile.id);
  const [name, setName] = useState(definition.name);
  const [profile, setProfile] = useState(definition.profile);
  const [workingDirectory, setWorkingDirectory] = useState<WorkspacePath>(definition.workingDirectory);
  const [startupCommand, setStartupCommand] = useState(definition.startupCommand ?? "");
  const [variables, setVariables] = useState<EnvironmentVariable[]>(definition.environmentVariables);
  const [autoStart, setAutoStart] = useState(definition.autoStart);
  const [launcherProfileId, setLauncherProfileId] = useState(definition.launcherProfileId ?? null);
  const [loadingShells, setLoadingShells] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartPrompt, setRestartPrompt] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (environment !== "wsl" || !distribution) return;
    let cancelled = false;
    setLoadingShells(true);
    detectWslShells(distribution)
      .then((result) => {
        if (cancelled) return;
        setWslShells(result.shells);
        setShellId((current) => result.shells.some((shell) => shell.id === current)
          ? current
          : result.shells[0]?.id ?? "");
      })
      .catch((reason) => !cancelled && setError(messageFromReason(reason)))
      .finally(() => !cancelled && setLoadingShells(false));
    return () => { cancelled = true; };
  }, [distribution, environment]);

  const availableShells = environment === "wsl" ? wslShells : windowsShells;
  const selectedShell = availableShells.find((shell) => shell.id === shellId);

  const changeEnvironment = (next: "windows" | "wsl") => {
    setEnvironment(next);
    if (next === "windows") {
      setShellId(windowsShells[0]?.id ?? "");
      if (workingDirectory.kind === "wsl") {
        setWorkingDirectory(workspace.rootDirectory.kind === "windows"
          ? workspace.rootDirectory
          : { kind: "windows", value: "", distribution: null });
      }
      return;
    }
    if (workingDirectory.kind === "wsl") {
      setWorkingDirectory({ ...workingDirectory, distribution });
    }
  };

  const changeDistribution = (next: string) => {
    setDistribution(next);
    if (workingDirectory.kind === "wsl") {
      setWorkingDirectory({
        kind: "wsl",
        value: workingDirectory.distribution === next ? workingDirectory.value : "~",
        distribution: next,
      });
    }
  };

  const changeWorkingDirectory = (value: string) => {
    const kind = environment === "windows" ? "windows" : inferPathKind(value, workingDirectory.kind);
    setWorkingDirectory({ kind, value, distribution: kind === "wsl" ? distribution : null });
  };

  const browse = async () => {
    setError("");
    try {
      if (environment === "wsl") {
        const selected = await chooseWslDirectory(distribution);
        if (selected) setWorkingDirectory(selected);
      } else {
        const selected = await chooseWindowsDirectory();
        if (selected) setWorkingDirectory({ kind: "windows", value: selected, distribution: null });
      }
    } catch (reason) {
      setError(messageFromReason(reason));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!selectedShell || !name.trim()) {
      setError("Select an available shell and enter a terminal name.");
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
      setError("A Windows shell cannot start directly in a WSL-native path.");
      return;
    }

    setSaving(true);
    try {
      if (!(await validatePath(terminalDirectory))) {
        setError("The selected working directory does not exist. Locate it or edit the path.");
        return;
      }
      const next: TerminalDefinition = {
        ...definition,
        name: name.trim(),
        profile,
        shellProfile: selectedShell,
        workingDirectory: terminalDirectory,
        startupCommand: startupCommand.trim() || null,
        environmentVariables: variables.filter((item) => item.key.trim()),
        autoStart,
        launcherProfileId,
      };
      const restartRequired = startupSignature(definition) !== startupSignature(next);
      await onSave(next);
      if (running && restartRequired) setRestartPrompt(true);
      else onClose();
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  const restart = async () => {
    setRestarting(true);
    setError("");
    try {
      await onRestart();
      onClose();
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setRestarting(false);
    }
  };

  if (restartPrompt) {
    return (
      <Modal
        title="Restart terminal?"
        description="The saved process settings take effect the next time this terminal starts."
        onClose={onClose}
        width="small"
        footer={<><button className="secondary-button" disabled={restarting} onClick={onClose}>Later</button><button className="primary-button" disabled={restarting} onClick={() => void restart()}>{restarting && <LoaderCircle className="spin" size={13} />} Restart Now</button></>}
      >
        <div className="terminal-restart-summary"><RotateCw size={17} /><span><strong>Your changes are saved.</strong><small>Restarting will stop the current process and immediately start this terminal with the new configuration.</small></span></div>
        {error && <div className="form-error terminal-edit-error">{error}</div>}
      </Modal>
    );
  }

  return (
    <Modal
      title="Edit Terminal"
      description="Labels and Open with update immediately. Process settings apply on the next start."
      onClose={onClose}
      width="large"
      footer={<><button className="secondary-button" disabled={saving} onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="edit-terminal-form" disabled={saving || loadingShells}>{saving && <LoaderCircle className="spin" size={13} />} Save Changes</button></>}
    >
      <form id="edit-terminal-form" className="form-grid" onSubmit={submit}>
        <label className="field full-width"><span>Name</span><input autoFocus value={name} maxLength={80} onChange={(event) => setName(event.target.value)} /></label>
        <fieldset className="field full-width segmented-field">
          <legend>Environment</legend>
          <div className="segmented-control">
            <button type="button" disabled={workspace.rootDirectory.kind === "wsl"} className={environment === "windows" ? "active" : ""} onClick={() => changeEnvironment("windows")}>Windows</button>
            <button type="button" disabled={wslDistributions.length === 0} className={environment === "wsl" ? "active" : ""} onClick={() => changeEnvironment("wsl")}>WSL</button>
          </div>
        </fieldset>
        {environment === "wsl" && <label className="field full-width"><span>Distribution</span><select value={distribution} onChange={(event) => changeDistribution(event.target.value)}>{wslDistributions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>}
        <label className="field full-width"><span>Shell</span><select value={shellId} disabled={loadingShells} onChange={(event) => setShellId(event.target.value)}>{loadingShells && <option>Detecting shells…</option>}{!loadingShells && availableShells.length === 0 && <option>No supported shell found</option>}{availableShells.map((shell) => <option key={shell.id} value={shell.id}>{shell.name}</option>)}</select></label>
        <label className="field"><span>Profile</span><select value={profile} onChange={(event) => setProfile(event.target.value as TerminalProfileKind)}><option value="shell">Shell</option><option value="claudeCode">Claude Code</option><option value="codex">Codex</option><option value="custom">Custom command</option></select></label>
        <div className="field"><label htmlFor="edit-terminal-startup-command">Startup command</label><input id="edit-terminal-startup-command" value={startupCommand} placeholder={profile === "claudeCode" ? "claude" : profile === "codex" ? "codex" : "Optional"} onChange={(event) => setStartupCommand(event.target.value)} /><small>Overrides the profile default when provided.</small></div>
        <div className="field full-width"><label htmlFor="edit-terminal-working-directory">Working directory</label><div className="input-with-action"><input id="edit-terminal-working-directory" value={workingDirectory.value} onChange={(event) => changeWorkingDirectory(event.target.value)} /><button type="button" className="icon-button" onClick={() => void browse()} aria-label={environment === "wsl" ? "Browse WSL folders" : "Browse folders"}><FolderOpen size={15} /></button></div></div>
        <LauncherProfileSelect launcherProfiles={launcherProfiles} value={launcherProfileId} globalDefaultProfileId={globalDefaultLauncherId} onChange={setLauncherProfileId} />
        <label className="checkbox-field full-width"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /><span><strong>Auto Start</strong><small>Start this terminal when the workspace is restored.</small></span></label>
        <details className="advanced-section full-width" open={variables.length > 0}><summary>Terminal environment variables</summary><p>Values are stored as plain text. Do not store secrets.</p><EnvironmentEditor value={variables} onChange={setVariables} /></details>
        {loadingShells && <div className="form-status full-width"><LoaderCircle className="spin" size={14} /><span><strong>Detecting WSL shells…</strong><small>Checking {distribution} for available login shells.</small></span></div>}
        {error && <div className="form-error full-width">{error}</div>}
      </form>
    </Modal>
  );
}

function startupSignature(definition: TerminalDefinition) {
  return JSON.stringify({
    profile: definition.profile,
    shellProfileId: definition.shellProfile.id,
    workingDirectory: definition.workingDirectory,
    startupCommand: definition.startupCommand ?? null,
    environmentVariables: definition.environmentVariables,
  });
}

function inferPathKind(value: string, current: PathKind): PathKind {
  const trimmed = value.trim();
  if (trimmed === "~" || trimmed.startsWith("~/") || trimmed.startsWith("/")) return "wsl";
  if (/^[a-zA-Z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) return "windows";
  return current;
}

function messageFromReason(reason: unknown) {
  if (typeof reason === "object" && reason && "message" in reason) return String((reason as { message: unknown }).message);
  return String(reason);
}
