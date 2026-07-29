import { RefreshCw } from "lucide-react";
import type { AppSettings, ShellProfile, ThemePreference, WslDistribution } from "../../types";
import { Modal } from "../ui/Modal";

export function SettingsDialog({ settings, windowsShells, wslDistributions, onChange, onClose }: { settings: AppSettings; windowsShells: ShellProfile[]; wslDistributions: WslDistribution[]; onChange: (settings: AppSettings) => void; onClose: () => void }) {
  const setTheme = (theme: ThemePreference) => onChange({ ...settings, theme });
  return (
    <Modal title="Settings" description="Application appearance and detected environments." onClose={onClose} width="large" footer={<button className="primary-button" onClick={onClose}>Done</button>}>
      <div className="settings-sections">
        <section><h3>Appearance</h3><p>System follows the current Windows appearance setting.</p><div className="theme-options">{(["system", "light", "dark"] as ThemePreference[]).map((theme) => <label key={theme} className={settings.theme === theme ? "active" : ""}><input type="radio" name="theme" checked={settings.theme === theme} onChange={() => setTheme(theme)} /><span>{theme[0].toUpperCase() + theme.slice(1)}</span></label>)}</div></section>
        <section><div className="section-title-row"><div><h3>Shells</h3><p>PowerShell uses the highest installed version by default.</p></div><button className="secondary-button" disabled><RefreshCw size={13} /> Refresh</button></div><div className="detection-list">{windowsShells.map((shell, index) => <div key={shell.id}><span><strong>{shell.name}</strong><small>{shell.executable}</small></span><span className="availability">{index === 0 ? "Default" : "Available"}</span></div>)}{wslDistributions.map((distribution) => <div key={distribution.name}><span><strong>{distribution.name}</strong><small>WSL {distribution.version} · Shells detected on selection</small></span><span className="availability">{distribution.isRunning ? "Running" : "Available"}</span></div>)}</div></section>
      </div>
    </Modal>
  );
}

