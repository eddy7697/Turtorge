import { Minus, PanelLeftClose, PanelLeftOpen, Plus, Search, Settings, Square, X } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "../../lib/api";
import type { DesktopPlatform } from "../../types";

interface TitleBarProps {
  platform?: DesktopPlatform;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onQuickOpen: () => void;
  onNewTerminal: () => void;
  onSettings: () => void;
  onRequestQuit: () => void;
}

export function TitleBar({
  platform = "windows",
  sidebarCollapsed,
  onToggleSidebar,
  onQuickOpen,
  onNewTerminal,
  onSettings,
  onRequestQuit,
}: TitleBarProps) {
  const isMacos = platform === "macos";
  const minimize = () => isTauri() && void getCurrentWindow().minimize();
  const maximize = () => isTauri() && void getCurrentWindow().toggleMaximize();

  return (
    <header className="title-bar" data-tauri-drag-region>
      <div className="title-bar-brand" data-tauri-drag-region>
        <button className="icon-button" onClick={onToggleSidebar} aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"} title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
        <div className="brand-crop" data-tauri-drag-region>
          <img src="/logo.png" alt="Turtorge" draggable={false} />
        </div>
      </div>

      <button className="quick-open-trigger" onClick={onQuickOpen}>
        <Search size={13} />
        <span>Quick Open…</span>
        <kbd>{isMacos ? "⌘ P" : "Ctrl P"}</kbd>
      </button>

      <div className="title-bar-actions" data-tauri-drag-region>
        <button className="icon-button" onClick={onNewTerminal} aria-label="New terminal" title={`New terminal (${isMacos ? "⌘" : "Ctrl"}+Shift+T)`}>
          <Plus size={16} />
        </button>
        <button className="icon-button" onClick={onSettings} aria-label="Settings" title={`Settings (${isMacos ? "⌘" : "Ctrl"}+,)`}>
          <Settings size={16} />
        </button>
        {!isMacos && <div className="window-controls">
          <button onClick={minimize} aria-label="Minimize" title="Minimize"><Minus size={15} /></button>
          <button onClick={maximize} aria-label="Maximize or restore" title="Maximize or restore"><Square size={12} /></button>
          <button className="window-close" onClick={onRequestQuit} aria-label="Close" title="Close"><X size={16} /></button>
        </div>}
      </div>
    </header>
  );
}
