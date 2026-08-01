import type { LauncherProfileStatus } from "../../types";
import { useId } from "react";
import { LauncherLogo } from "./LauncherLogo";

interface LauncherProfileSelectProps {
  launcherProfiles: LauncherProfileStatus[];
  value: string | null;
  globalDefaultProfileId?: string | null;
  onChange: (profileId: string | null) => void;
  label?: string;
  helper?: string;
}

export function LauncherProfileSelect({
  launcherProfiles,
  value,
  globalDefaultProfileId,
  onChange,
  label = "Open with",
  helper = "Leave blank to inherit the global launcher.",
}: LauncherProfileSelectProps) {
  const selectId = useId();
  const selected = value
    ? launcherProfiles.find(({ profile }) => profile.id === value)
    : launcherProfiles.find(({ profile }) => profile.id === globalDefaultProfileId);
  const inheritedName = selected?.profile.name;

  return (
    <div className="field full-width launcher-profile-select-field">
      <label htmlFor={selectId}>{label}</label>
      <div className="launcher-profile-select">
        <span className="launcher-logo-frame compact">
          {selected ? <LauncherLogo icon={selected.profile.icon} accent={selected.profile.accent} size={21} /> : <span className="launcher-later-mark">—</span>}
        </span>
        <select id={selectId} value={value ?? ""} onChange={(event) => onChange(event.target.value || null)}>
          <option value="">{inheritedName ? `Use global default (${inheritedName})` : "Choose later (use global default)"}</option>
          {launcherProfiles.map((status) => (
            <option key={status.profile.id} value={status.profile.id} disabled={!status.available}>
              {status.profile.name}{status.available ? "" : " — unavailable"}
            </option>
          ))}
        </select>
      </div>
      <small>{helper}</small>
    </div>
  );
}
