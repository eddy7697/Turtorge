import { FolderOpen, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { chooseWindowsDirectory, detectWslShells, validatePath } from "../../lib/api";
import { createId } from "../../lib/ids";
import { createPane } from "../../lib/layout";
import type {
  EnvironmentVariable,
  PathKind,
  ShellProfile,
  TerminalProfileKind,
  Workspace,
  WslDistribution,
} from "../../types";
import { EnvironmentEditor } from "../ui/EnvironmentEditor";
import { Modal } from "../ui/Modal";

export function CreateWorkspaceDialog({
  windowsShells,
  wslDistributions,
  onClose,
  onCreate,
}: {
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  onClose: () => void;
  onCreate: (workspace: Workspace) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [environment, setEnvironment] = useState<"windows" | "wsl">(
    wslDistributions.length > 0 ? "wsl" : "windows",
  );
  const [pathKind, setPathKind] = useState<PathKind>(environment === "wsl" ? "wsl" : "windows");
  const [path, setPath] = useState(environment === "wsl" ? "~" : "");
  const [distribution, setDistribution] = useState(
    wslDistributions.find((item) => item.isDefault)?.name ?? wslDistributions[0]?.name ?? "",
  );
  const [wslShells, setWslShells] = useState<ShellProfile[]>([]);
  const [shellId, setShellId] = useState(windowsShells[0]?.id ?? "");
  const [profile, setProfile] = useState<TerminalProfileKind>("shell");
  const [terminalName, setTerminalName] = useState("Shell");
  const [environmentVariables, setEnvironmentVariables] = useState<EnvironmentVariable[]>([]);
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
        setShellId(result.shells[0]?.id ?? "");
      })
      .catch((reason) => !cancelled && setError(String(reason?.message ?? reason)))
      .finally(() => !cancelled && setLoadingShells(false));
    return () => {
      cancelled = true;
    };
  }, [distribution, environment]);

  const availableShells = environment === "wsl" ? wslShells : windowsShells;
  const selectedShell = availableShells.find((shell) => shell.id === shellId);
  const terminalNames: Record<TerminalProfileKind, string> = {
    shell: selectedShell?.shell?.endsWith("zsh") ? "WSL zsh" : selectedShell?.name ?? "Shell",
    claudeCode: "Claude Code",
    codex: "Codex",
    custom: "Custom Terminal",
  };

  useEffect(() => {
    setTerminalName(terminalNames[profile]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, shellId]);

  const suggestedName = useMemo(() => {
    const normalized = path.replace(/[\\/]+$/, "");
    if (!normalized || normalized === "~") return "";
    return normalized.split(/[\\/]/).pop() ?? "";
  }, [path]);

  const browse = async () => {
    const selected = await chooseWindowsDirectory();
    if (selected) {
      setPath(selected);
      if (!name) setName(selected.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? "");
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (!name.trim() || !path.trim() || !selectedShell) {
      setError("Workspace name, directory, and an available shell are required.");
      return;
    }
    const rootDirectory = {
      kind: pathKind,
      value: path.trim(),
      distribution: pathKind === "wsl" ? distribution : null,
    } as const;
    setSaving(true);
    try {
      if (!(await validatePath(rootDirectory))) {
        setError("The selected directory does not exist. Locate it or edit the path.");
        return;
      }
      const now = new Date().toISOString();
      const terminalId = createId("terminal");
      const workspace: Workspace = {
        id: createId("workspace"),
        name: name.trim(),
        description: null,
        color: "#72d8c9",
        rootDirectory,
        defaultShellProfile: selectedShell,
        environmentVariables: environmentVariables.filter((item) => item.key.trim()),
        terminals: [
          {
            id: terminalId,
            name: terminalName.trim() || terminalNames[profile],
            profile,
            shellProfile: selectedShell,
            workingDirectory: rootDirectory,
            environmentVariables: [],
            startupCommand: null,
            autoStart: false,
          },
        ],
        layout: createPane([terminalId]),
        pinned: true,
        favorite: false,
        createdAt: now,
        updatedAt: now,
        lastOpenedAt: now,
        openCount: 1,
      };
      await onCreate(workspace);
      onClose();
    } catch (reason) {
      setError(String((reason as { message?: string })?.message ?? reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Create Workspace"
      description="Define the environment once. Turtorge will restore it from the workspace."
      onClose={onClose}
      width="large"
      footer={
        <>
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" form="create-workspace-form" disabled={saving || loadingShells}>
            {saving && <LoaderCircle className="spin" size={14} />} Create and Open
          </button>
        </>
      }
    >
      <form id="create-workspace-form" className="form-grid" onSubmit={submit}>
        <label className="field full-width">
          <span>Workspace name</span>
          <input autoFocus value={name} placeholder={suggestedName || "My workspace"} onChange={(event) => setName(event.target.value)} />
        </label>

        <fieldset className="field full-width segmented-field">
          <legend>Environment</legend>
          <div className="segmented-control">
            <button type="button" className={environment === "windows" ? "active" : ""} onClick={() => { setEnvironment("windows"); setPathKind("windows"); setPath(""); setShellId(windowsShells[0]?.id ?? ""); }}>Windows</button>
            <button type="button" disabled={wslDistributions.length === 0} className={environment === "wsl" ? "active" : ""} onClick={() => { setEnvironment("wsl"); setPathKind("wsl"); setPath("~"); }}>WSL</button>
          </div>
        </fieldset>

        {environment === "wsl" && (
          <>
            <label className="field">
              <span>Distribution</span>
              <select value={distribution} onChange={(event) => setDistribution(event.target.value)}>
                {wslDistributions.map((item) => <option key={item.name} value={item.name}>{item.name}{item.isDefault ? " (default)" : ""}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Project location</span>
              <select value={pathKind} onChange={(event) => { const kind = event.target.value as PathKind; setPathKind(kind); setPath(kind === "wsl" ? "~" : ""); }}>
                <option value="wsl">WSL filesystem</option>
                <option value="windows">Windows-mounted folder</option>
              </select>
            </label>
          </>
        )}

        <label className="field full-width">
          <span>{pathKind === "wsl" ? "Linux path" : "Windows folder"}</span>
          <div className="input-with-action">
            <input value={path} placeholder={pathKind === "wsl" ? "/home/user/projects/app" : "E:\\Projects\\App"} onChange={(event) => setPath(event.target.value)} />
            {pathKind === "windows" && <button type="button" className="icon-button" onClick={browse} aria-label="Browse folders"><FolderOpen size={15} /></button>}
          </div>
        </label>

        <label className="field full-width">
          <span>Shell</span>
          <select value={shellId} disabled={loadingShells} onChange={(event) => setShellId(event.target.value)}>
            {loadingShells && <option>Detecting shells…</option>}
            {!loadingShells && availableShells.length === 0 && <option>No supported shell found</option>}
            {availableShells.map((shell) => <option key={shell.id} value={shell.id}>{shell.name}</option>)}
          </select>
          {selectedShell?.kind === "wsl" && <small>Interactive login shell · default WSL user</small>}
        </label>

        <label className="field">
          <span>Initial profile</span>
          <select value={profile} onChange={(event) => setProfile(event.target.value as TerminalProfileKind)}>
            <option value="shell">Shell</option>
            <option value="claudeCode">Claude Code</option>
            <option value="codex">Codex</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label className="field">
          <span>Terminal name</span>
          <input value={terminalName} onChange={(event) => setTerminalName(event.target.value)} />
        </label>

        <details className="advanced-section full-width">
          <summary>Workspace environment variables</summary>
          <p>Values are stored as plain text. Do not store secrets.</p>
          <EnvironmentEditor value={environmentVariables} onChange={setEnvironmentVariables} />
        </details>
        {error && <div className="form-error full-width">{error}</div>}
      </form>
    </Modal>
  );
}
