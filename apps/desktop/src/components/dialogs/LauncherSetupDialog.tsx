import { LoaderCircle, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { LauncherProfileStatus } from "../../types";
import { LauncherLogo } from "../ui/LauncherLogo";
import { Modal } from "../ui/Modal";

export function LauncherSetupDialog({ launcherProfiles, path, onSaveAndOpen, onManage, onClose }: {
  launcherProfiles: LauncherProfileStatus[];
  path: string;
  onSaveAndOpen: (profileId: string) => Promise<void>;
  onManage: () => void;
  onClose: () => void;
}) {
  const availableDefault = useMemo(
    () => launcherProfiles.find(({ profile, available }) => ["builtin-finder", "builtin-explorer"].includes(profile.id) && available)
      ?? launcherProfiles.find(({ available }) => available),
    [launcherProfiles],
  );
  const [selectedId, setSelectedId] = useState(availableDefault?.profile.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (!selectedId) return;
    setSaving(true);
    setError("");
    try {
      await onSaveAndOpen(selectedId);
      onClose();
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Open working directory"
      description="Choose the global default. You can override it for individual terminals later."
      onClose={onClose}
      width="large"
      footer={
        <>
          <button className="secondary-button" onClick={onManage}><Settings2 size={13} /> Manage profiles</button>
          <button className="secondary-button" onClick={onClose}>Cancel</button>
          <button className="primary-button" disabled={!selectedId || saving} onClick={() => void save()}>
            {saving && <LoaderCircle className="spin" size={13} />} Save &amp; Open
          </button>
        </>
      }
    >
      <div className="launcher-setup">
        <div className="launcher-setup-path"><span>Working directory</span><code title={path}>{path}</code></div>
        <div className="launcher-setup-options" role="radiogroup" aria-label="Launcher profile">
          {launcherProfiles.map((status) => (
            <label key={status.profile.id} className={`${selectedId === status.profile.id ? "selected" : ""} ${status.available ? "" : "unavailable"}`}>
              <input
                type="radio"
                name="launcher-profile"
                value={status.profile.id}
                checked={selectedId === status.profile.id}
                disabled={!status.available || saving}
                onChange={() => setSelectedId(status.profile.id)}
              />
              <span className="launcher-logo-frame"><LauncherLogo icon={status.profile.icon} accent={status.profile.accent} size={26} /></span>
              <span>
                <strong>{status.profile.name}</strong>
                <small>{status.available ? status.resolvedProgram : status.unavailableReason}</small>
              </span>
              <i>{status.available ? "Available" : "Locate in Settings"}</i>
            </label>
          ))}
        </div>
        <p className="launcher-setup-note">Turtorge passes the folder as a structured argument and does not evaluate a shell command.</p>
        {error && <div className="form-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function messageFromReason(reason: unknown) {
  if (typeof reason === "object" && reason && "message" in reason) return String((reason as { message: unknown }).message);
  return String(reason);
}
