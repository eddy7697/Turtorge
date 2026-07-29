import { LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { detectWslShells, validatePath } from "../../lib/api";
import { createId } from "../../lib/ids";
import type { EnvironmentVariable, ShellProfile, TerminalDefinition, TerminalProfileKind, Workspace, WslDistribution } from "../../types";
import { EnvironmentEditor } from "../ui/EnvironmentEditor";
import { Modal } from "../ui/Modal";

export function NewTerminalDialog({
  workspace,
  windowsShells,
  wslDistributions,
  onClose,
  onCreate,
}: {
  workspace: Workspace;
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  onClose: () => void;
  onCreate: (definition: TerminalDefinition) => Promise<void>;
}) {
  const defaultKind = workspace.defaultShellProfile.kind;
  const [environment, setEnvironment] = useState<"windows" | "wsl">(defaultKind === "wsl" ? "wsl" : "windows");
  const [distribution, setDistribution] = useState(workspace.defaultShellProfile.distribution ?? wslDistributions.find((item) => item.isDefault)?.name ?? "");
  const [wslShells, setWslShells] = useState<ShellProfile[]>(defaultKind === "wsl" ? [workspace.defaultShellProfile] : []);
  const [shellId, setShellId] = useState(workspace.defaultShellProfile.id);
  const [profile, setProfile] = useState<TerminalProfileKind>("shell");
  const [name, setName] = useState("Terminal");
  const [command, setCommand] = useState("");
  const [variables, setVariables] = useState<EnvironmentVariable[]>([]);
  const [autoStart, setAutoStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (environment !== "wsl" || !distribution) return;
    let cancelled = false;
    setLoading(true);
    detectWslShells(distribution)
      .then((result) => {
        if (cancelled) return;
        setWslShells(result.shells);
        const matching = result.shells.find((shell) => shell.id === workspace.defaultShellProfile.id);
        setShellId((matching ?? result.shells[0])?.id ?? "");
      })
      .catch((reason) => !cancelled && setError(String(reason?.message ?? reason)))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [distribution, environment, workspace.defaultShellProfile.id]);

  const availableShells = environment === "wsl" ? wslShells : windowsShells;
  const selectedShell = availableShells.find((shell) => shell.id === shellId);
  const suggestedName = useMemo(() => {
    if (profile === "claudeCode") return "Claude Code";
    if (profile === "codex") return "Codex";
    if (profile === "custom") return "Custom Command";
    if (selectedShell?.shell?.endsWith("zsh")) return "WSL zsh";
    if (selectedShell?.shell?.endsWith("bash")) return "WSL bash";
    return selectedShell?.name ?? "Terminal";
  }, [profile, selectedShell]);

  useEffect(() => setName(suggestedName), [suggestedName]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!selectedShell || !name.trim()) {
      setError("Select an available shell and enter a terminal name.");
      return;
    }
    if (selectedShell.kind === "powerShell" && workspace.rootDirectory.kind === "wsl") {
      setError("A Windows shell cannot start directly in a WSL-native path. Choose WSL or a Windows-mounted workspace.");
      return;
    }
    setLoading(true);
    try {
      if (!(await validatePath(workspace.rootDirectory))) {
        setError("The workspace directory is missing. Edit the workspace path before starting a terminal.");
        return;
      }
      await onCreate({
        id: createId("terminal"),
        name: name.trim(),
        profile,
        shellProfile: selectedShell,
        workingDirectory: workspace.rootDirectory,
        startupCommand: profile === "custom" ? command.trim() || null : null,
        environmentVariables: variables.filter((item) => item.key.trim()),
        autoStart,
      });
      onClose();
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="New Terminal" description="Start now; Auto Start only controls the next workspace restore." onClose={onClose} width="medium" footer={<><button className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" form="new-terminal-form" disabled={loading}>{loading && <LoaderCircle className="spin" size={14} />} Save and Start</button></>}>
      <form id="new-terminal-form" className="form-grid" onSubmit={submit}>
        <fieldset className="field full-width segmented-field">
          <legend>Environment</legend>
          <div className="segmented-control">
            <button type="button" disabled={workspace.rootDirectory.kind === "wsl"} className={environment === "windows" ? "active" : ""} onClick={() => { setEnvironment("windows"); setShellId(windowsShells[0]?.id ?? ""); }}>Windows</button>
            <button type="button" disabled={wslDistributions.length === 0} className={environment === "wsl" ? "active" : ""} onClick={() => setEnvironment("wsl")}>WSL</button>
          </div>
        </fieldset>
        {environment === "wsl" && <label className="field full-width"><span>Distribution</span><select value={distribution} onChange={(event) => setDistribution(event.target.value)}>{wslDistributions.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}</select></label>}
        <label className="field full-width"><span>Shell</span><select value={shellId} onChange={(event) => setShellId(event.target.value)}>{availableShells.map((shell) => <option key={shell.id} value={shell.id}>{shell.name}</option>)}</select></label>
        <label className="field"><span>Profile</span><select value={profile} onChange={(event) => setProfile(event.target.value as TerminalProfileKind)}><option value="shell">Shell</option><option value="claudeCode">Claude Code</option><option value="codex">Codex</option><option value="custom">Custom command</option></select></label>
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
        {profile === "custom" && <label className="field full-width"><span>Startup command</span><input value={command} placeholder="pnpm dev" onChange={(event) => setCommand(event.target.value)} /></label>}
        <label className="checkbox-field full-width"><input type="checkbox" checked={autoStart} onChange={(event) => setAutoStart(event.target.checked)} /><span><strong>Auto Start</strong><small>Start this terminal when the workspace is restored.</small></span></label>
        <details className="advanced-section full-width"><summary>Terminal environment variables</summary><p>Values are stored as plain text. Do not store secrets.</p><EnvironmentEditor value={variables} onChange={setVariables} /></details>
        {error && <div className="form-error full-width">{error}</div>}
      </form>
    </Modal>
  );
}

