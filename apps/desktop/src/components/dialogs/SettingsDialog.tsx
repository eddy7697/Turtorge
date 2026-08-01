import { AlertCircle, Check, Copy, FileSearch, Pencil, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { chooseLauncherProgram, validateLauncherProfile } from "../../lib/api";
import type {
  AppSettings,
  LauncherDetectionMode,
  LauncherIcon,
  LauncherProfile,
  LauncherProfileStatus,
  ShellProfile,
  ThemePreference,
  Workspace,
  WslDistribution,
} from "../../types";
import { LauncherLogo } from "../ui/LauncherLogo";
import { Modal } from "../ui/Modal";

interface SettingsDialogProps {
  settings: AppSettings;
  launcherProfiles: LauncherProfileStatus[];
  workspaces: Workspace[];
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  onChange: (settings: AppSettings) => Promise<void>;
  onDeleteProfile: (profileId: string, settings: AppSettings) => Promise<void>;
  onClose: () => void;
}

export function SettingsDialog({
  settings,
  launcherProfiles,
  workspaces,
  windowsShells,
  wslDistributions,
  onChange,
  onDeleteProfile,
  onClose,
}: SettingsDialogProps) {
  const [editingProfile, setEditingProfile] = useState<LauncherProfile | null>(null);
  const [deleteProfileId, setDeleteProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customStatuses = launcherProfiles.filter(({ profile }) => !profile.builtIn);
  const referencedCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const workspace of workspaces) {
      for (const terminal of workspace.terminals) {
        if (terminal.launcherProfileId) {
          counts.set(terminal.launcherProfileId, (counts.get(terminal.launcherProfileId) ?? 0) + 1);
        }
      }
    }
    return counts;
  }, [workspaces]);

  if (editingProfile) {
    return (
      <LauncherProfileEditor
        profile={editingProfile}
        onCancel={() => setEditingProfile(null)}
        onSave={async (profile) => {
          setSaving(true);
          setError(null);
          try {
            const nextProfiles = settings.launcherProfiles.some((item) => item.id === profile.id)
              ? settings.launcherProfiles.map((item) => (item.id === profile.id ? profile : item))
              : [...settings.launcherProfiles, profile];
            await onChange({ ...settings, launcherProfiles: nextProfiles });
            setEditingProfile(null);
          } catch (reason) {
            setError(messageFromReason(reason));
          } finally {
            setSaving(false);
          }
        }}
        saving={saving}
        externalError={error}
      />
    );
  }

  const saveSettings = async (next: AppSettings) => {
    setSaving(true);
    setError(null);
    try {
      await onChange(next);
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  const cloneProfile = (profile: LauncherProfileStatus) => {
    setEditingProfile({
      ...profile.profile,
      id: `launcher-${crypto.randomUUID()}`,
      name: `${profile.profile.name} (Custom)`,
      program: profile.resolvedProgram ?? profile.profile.program,
      detectionMode: profile.resolvedProgram ? "manual" : profile.profile.detectionMode,
      builtIn: false,
    });
  };

  const createCustomProfile = () => {
    setEditingProfile({
      id: `launcher-${crypto.randomUUID()}`,
      name: "Custom launcher",
      program: "",
      arguments: ["{path}"],
      wslArguments: null,
      detectionMode: "manual",
      icon: "appWindow",
      accent: "#72d8c9",
      builtIn: false,
    });
  };

  const deleteProfile = async (profileId: string) => {
    setSaving(true);
    setError(null);
    try {
      await onDeleteProfile(profileId, {
        ...settings,
        defaultLauncherProfileId:
          settings.defaultLauncherProfileId === profileId
            ? null
            : settings.defaultLauncherProfileId,
        launcherProfiles: settings.launcherProfiles.filter((profile) => profile.id !== profileId),
      });
      setDeleteProfileId(null);
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Settings"
      description="Application appearance, shells, and external launcher profiles."
      onClose={onClose}
      width="wide"
      footer={<button className="primary-button" onClick={onClose}>Done</button>}
    >
      <div className="settings-sections">
        <section>
          <h3>Appearance</h3>
          <p>System follows the current Windows appearance setting.</p>
          <div className="theme-options">
            {(["system", "light", "dark"] as ThemePreference[]).map((theme) => (
              <label key={theme} className={settings.theme === theme ? "active" : ""}>
                <input
                  type="radio"
                  name="theme"
                  checked={settings.theme === theme}
                  onChange={() => void saveSettings({ ...settings, theme })}
                />
                <span>{theme[0].toUpperCase() + theme.slice(1)}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <div className="section-title-row">
            <div>
              <h3>Open working directory with</h3>
              <p>The pane action uses this profile unless a terminal overrides it.</p>
            </div>
            <button className="secondary-button" onClick={createCustomProfile}>
              <Plus size={13} /> Custom
            </button>
          </div>
          <div className="launcher-preset-grid" role="radiogroup" aria-label="Default launcher">
            {launcherProfiles.filter(({ profile }) => profile.builtIn).map((status) => (
              <LauncherPresetCard
                key={status.profile.id}
                status={status}
                selected={settings.defaultLauncherProfileId === status.profile.id}
                disabled={saving}
                onSelect={() => void saveSettings({ ...settings, defaultLauncherProfileId: status.profile.id })}
                onClone={() => cloneProfile(status)}
              />
            ))}
          </div>
        </section>

        <section>
          <div className="section-title-row">
            <div>
              <h3>Custom launcher profiles</h3>
              <p>Each argument is passed directly. Shell command strings are never evaluated.</p>
            </div>
          </div>
          {customStatuses.length === 0 ? (
            <button className="launcher-empty" onClick={createCustomProfile}>
              <Plus size={15} /> Create a profile for another editor or tool
            </button>
          ) : (
            <div className="launcher-custom-list">
              {customStatuses.map((status) => {
                const deleting = deleteProfileId === status.profile.id;
                const references = referencedCounts.get(status.profile.id) ?? 0;
                return (
                  <div className="launcher-custom-row" key={status.profile.id}>
                    <LauncherLogo icon={status.profile.icon} accent={status.profile.accent} size={25} />
                    <span className="launcher-profile-copy">
                      <strong>{status.profile.name}</strong>
                      <small>{status.resolvedProgram ?? (status.profile.program || "Program not configured")}</small>
                    </span>
                    {settings.defaultLauncherProfileId === status.profile.id && <span className="availability">Default</span>}
                    <span className={`launcher-availability ${status.available ? "available" : "unavailable"}`}>
                      {status.available ? "Available" : "Needs attention"}
                    </span>
                    {settings.defaultLauncherProfileId !== status.profile.id && (
                      <button
                        className="text-button launcher-set-default"
                        disabled={saving || !status.available}
                        onClick={() => void saveSettings({ ...settings, defaultLauncherProfileId: status.profile.id })}
                      >
                        Set default
                      </button>
                    )}
                    {deleting ? (
                      <span className="launcher-delete-confirm">
                        <small>{references > 0 ? `${references} terminal${references === 1 ? "" : "s"} will inherit the global default.` : "Delete this profile?"}</small>
                        <button className="text-button" onClick={() => setDeleteProfileId(null)}>Cancel</button>
                        <button className="danger-button" disabled={saving} onClick={() => void deleteProfile(status.profile.id)}>Delete</button>
                      </span>
                    ) : (
                      <span className="launcher-row-actions">
                        <button className="icon-button" title="Edit profile" aria-label={`Edit ${status.profile.name}`} onClick={() => setEditingProfile(status.profile)}><Pencil size={14} /></button>
                        <button className="icon-button danger-subtle" title="Delete profile" aria-label={`Delete ${status.profile.name}`} onClick={() => setDeleteProfileId(status.profile.id)}><Trash2 size={14} /></button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div className="section-title-row">
            <div><h3>Shells</h3><p>PowerShell uses the highest installed version by default.</p></div>
            <button className="secondary-button" disabled><RefreshCw size={13} /> Refresh</button>
          </div>
          <div className="detection-list">
            {windowsShells.map((shell, index) => <div key={shell.id}><span><strong>{shell.name}</strong><small>{shell.executable}</small></span><span className="availability">{index === 0 ? "Default" : "Available"}</span></div>)}
            {wslDistributions.map((distribution) => <div key={distribution.name}><span><strong>{distribution.name}</strong><small>WSL {distribution.version} · Shells detected on selection</small></span><span className="availability">{distribution.isRunning ? "Running" : "Available"}</span></div>)}
          </div>
        </section>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function LauncherPresetCard({ status, selected, disabled, onSelect, onClone }: {
  status: LauncherProfileStatus;
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
  onClone: () => void;
}) {
  return (
    <div className={`launcher-preset-card ${selected ? "selected" : ""} ${!status.available ? "unavailable" : ""}`}>
      <button
        className="launcher-preset-select"
        role="radio"
        aria-checked={selected}
        aria-label={`${status.profile.name}${status.available ? "" : " unavailable"}`}
        disabled={disabled || !status.available}
        onClick={onSelect}
      >
        <span className="launcher-logo-frame"><LauncherLogo icon={status.profile.icon} accent={status.profile.accent} size={27} /></span>
        <span>
          <strong>{status.profile.name}</strong>
          <small>{status.available ? status.resolvedProgram : status.unavailableReason}</small>
        </span>
        {selected && <Check className="launcher-card-check" size={14} />}
      </button>
      <button className="launcher-clone-button" title={`Clone ${status.profile.name}`} aria-label={`Clone ${status.profile.name}`} onClick={onClone}><Copy size={12} /></button>
    </div>
  );
}

function LauncherProfileEditor({ profile, saving, externalError, onSave, onCancel }: {
  profile: LauncherProfile;
  saving: boolean;
  externalError: string | null;
  onSave: (profile: LauncherProfile) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);

  const updateArguments = (key: "arguments" | "wslArguments", index: number, value: string) => {
    const current = key === "arguments" ? draft.arguments : draft.wslArguments ?? [];
    setDraft({ ...draft, [key]: current.map((item, itemIndex) => itemIndex === index ? value : item) });
  };
  const removeArgument = (key: "arguments" | "wslArguments", index: number) => {
    const current = key === "arguments" ? draft.arguments : draft.wslArguments ?? [];
    setDraft({ ...draft, [key]: current.filter((_, itemIndex) => itemIndex !== index) });
  };
  const addArgument = (key: "arguments" | "wslArguments") => {
    const current = key === "arguments" ? draft.arguments : draft.wslArguments ?? [];
    setDraft({ ...draft, [key]: [...current, ""] });
  };
  const save = async () => {
    setValidating(true);
    const validation = await validateLauncherProfile(draft).catch((reason) => ({
      valid: false,
      errors: [messageFromReason(reason)],
      resolvedProgram: null,
    }));
    setValidating(false);
    setErrors(validation.errors);
    if (validation.valid) await onSave(draft);
  };
  const browse = async () => {
    const program = await chooseLauncherProgram();
    if (program) setDraft({ ...draft, program, detectionMode: "manual" });
  };

  return (
    <Modal
      title="Launcher profile"
      description="Build a safe program-and-arguments template for opening a working directory."
      onClose={onCancel}
      width="large"
      footer={<><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="primary-button" disabled={saving || validating} onClick={() => void save()}>{saving || validating ? "Validating…" : "Save profile"}</button></>}
    >
      <div className="launcher-editor">
        <div className="launcher-editor-heading">
          <span className="launcher-logo-frame large"><LauncherLogo icon={draft.icon} accent={draft.accent} size={32} /></span>
          <label className="field"><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} autoFocus /></label>
        </div>
        <fieldset className="segmented-field">
          <legend>Program resolution</legend>
          <div className="segmented-control">
            {(["auto", "manual"] as LauncherDetectionMode[]).map((mode) => <button type="button" key={mode} className={draft.detectionMode === mode ? "active" : ""} onClick={() => setDraft({ ...draft, detectionMode: mode })}>{mode === "auto" ? "Auto-detect" : "Manual path"}</button>)}
          </div>
        </fieldset>
        <label className="field">
          <span>Program</span>
          <div className="input-with-action">
            <input value={draft.program} placeholder={draft.detectionMode === "auto" ? "code" : "C:\\Path\\Editor.exe"} onChange={(event) => setDraft({ ...draft, program: event.target.value })} />
            <button className="icon-button" title="Locate executable" aria-label="Locate executable" onClick={() => void browse()}><FileSearch size={15} /></button>
          </div>
          <small>Allowed: .exe, .com, .cmd, and .bat. Auto-detect checks PATH and trusted install locations.</small>
        </label>

        <ArgumentEditor title="Arguments" arguments={draft.arguments} onChange={(index, value) => updateArguments("arguments", index, value)} onRemove={(index) => removeArgument("arguments", index)} onAdd={() => addArgument("arguments")} />

        <label className="checkbox-field">
          <input type="checkbox" checked={draft.wslArguments != null} onChange={(event) => setDraft({ ...draft, wslArguments: event.target.checked ? ["{path}"] : null })} />
          <span><strong>Use different arguments for WSL paths</strong><small>Use {"{wslPath}"} and {"{distribution}"} for tools with native WSL support.</small></span>
        </label>
        {draft.wslArguments && <ArgumentEditor title="WSL arguments" arguments={draft.wslArguments} onChange={(index, value) => updateArguments("wslArguments", index, value)} onRemove={(index) => removeArgument("wslArguments", index)} onAdd={() => addArgument("wslArguments")} />}

        <div className="launcher-appearance-editor">
          <div><strong>Profile icon</strong><small>Clones keep the original product mark. Custom profiles can use a generic mark and accent.</small></div>
          <div className="launcher-icon-options">
            {(["appWindow", "terminal", "code"] as LauncherIcon[]).map((icon) => <button key={icon} className={draft.icon === icon ? "active" : ""} aria-label={`Use ${icon} icon`} onClick={() => setDraft({ ...draft, icon })}><LauncherLogo icon={icon} accent={draft.accent} size={21} /></button>)}
            <input type="color" aria-label="Profile accent color" value={draft.accent ?? "#72d8c9"} onChange={(event) => setDraft({ ...draft, accent: event.target.value })} />
          </div>
        </div>

        <div className="launcher-placeholder-help">
          <strong>Placeholders</strong>
          <span><code>{"{path}"}</code> Windows path or WSL UNC path</span>
          <span><code>{"{wslPath}"}</code> Linux path inside the selected distribution</span>
          <span><code>{"{distribution}"}</code> WSL distribution name</span>
          <span><code>{"{projectRoot}"}</code> Nearest detected project root</span>
        </div>
        <div className="launcher-command-preview"><strong>Preview</strong><code>{commandPreview(draft)}</code></div>
        {(errors.length > 0 || externalError) && <div className="form-error" role="alert"><AlertCircle size={14} /> <span>{[...errors, ...(externalError ? [externalError] : [])].join(" ")}</span></div>}
      </div>
    </Modal>
  );
}

function ArgumentEditor({ title, arguments: values, onChange, onRemove, onAdd }: {
  title: string;
  arguments: string[];
  onChange: (index: number, value: string) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div className="launcher-argument-editor">
      <div className="section-title-row"><strong>{title}</strong><button className="text-button" onClick={onAdd}><Plus size={12} /> Add argument</button></div>
      <div className="launcher-argument-list">
        {values.map((value, index) => (
          <label key={`${title}-${index}`}><span>{index + 1}</span><input value={value} aria-label={`${title} ${index + 1}`} onChange={(event) => onChange(index, event.target.value)} /><button className="icon-button" title="Remove argument" aria-label={`Remove ${title.toLowerCase()} ${index + 1}`} onClick={() => onRemove(index)}><X size={13} /></button></label>
        ))}
      </div>
    </div>
  );
}

function commandPreview(profile: LauncherProfile) {
  const quote = (value: string) => value.includes(" ") ? `"${value}"` : value;
  return [profile.program || "<program>", ...profile.arguments].map(quote).join(" ");
}

function messageFromReason(reason: unknown): string {
  if (typeof reason === "object" && reason && "message" in reason) return String((reason as { message: unknown }).message);
  return String(reason);
}
