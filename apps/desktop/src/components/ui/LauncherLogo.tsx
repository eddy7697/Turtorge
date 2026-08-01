import { AppWindow, Code2, FolderOpen, TerminalSquare } from "lucide-react";
import { useId } from "react";
import type { LauncherIcon } from "../../types";

interface LauncherLogoProps {
  icon: LauncherIcon;
  accent?: string | null;
  size?: number;
}

export function LauncherLogo({ icon, accent, size = 24 }: LauncherLogoProps) {
  const gradientId = useId().replaceAll(":", "");
  const style = { width: size, height: size, color: accent || undefined };

  if (icon === "explorer") return <FolderOpen className="launcher-logo explorer" style={style} />;
  if (icon === "appWindow") return <AppWindow className="launcher-logo custom" style={style} />;
  if (icon === "terminal") return <TerminalSquare className="launcher-logo custom" style={style} />;
  if (icon === "code") return <Code2 className="launcher-logo custom" style={style} />;

  if (icon === "vsCode") {
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#23a8f2" d="M17.55 2.15 8.9 10.04 4.18 6.47 2 8.05l4.48 3.95L2 15.95l2.18 1.58 4.72-3.57 8.65 7.89L22 19.68V4.32l-4.45-2.17Zm.06 5.05v9.6l-6.33-4.8 6.33-4.8Z" />
      </svg>
    );
  }

  if (icon === "cursor") {
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="m12 1.8 9 5.1v10.2l-9 5.1-9-5.1V6.9l9-5.1Zm0 2.3L5.1 8v8l6.9 3.9 6.9-3.9V8L12 4.1Z" />
        <path fill="currentColor" d="m7.2 8.9 4.8-2.7 4.8 2.7-4.8 2.8-4.8-2.8Zm0 2.6 3.7 2.1v4.3l-3.7-2.1v-4.3Zm9.6 0v4.3l-3.7 2.1v-4.3l3.7-2.1Z" opacity=".72" />
      </svg>
    );
  }

  if (icon === "antigravity") {
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <defs><linearGradient id={gradientId} x1="3" y1="3" x2="21" y2="21"><stop stopColor="#4285f4"/><stop offset=".34" stopColor="#a142f4"/><stop offset=".68" stopColor="#fbbc04"/><stop offset="1" stopColor="#34a853"/></linearGradient></defs>
        <path fill={`url(#${gradientId})`} d="M12 1.8c1.8 3.7 3.1 5 6.8 6.8-3.7 1.8-5 3.1-6.8 6.8-1.8-3.7-3.1-5-6.8-6.8C8.9 6.8 10.2 5.5 12 1.8Zm6.3 11.4c.8 1.8 1.5 2.5 3.3 3.3-1.8.8-2.5 1.5-3.3 3.3-.8-1.8-1.5-2.5-3.3-3.3 1.8-.8 2.5-1.5 3.3-3.3ZM6.1 15c.6 1.3 1.1 1.8 2.4 2.4-1.3.6-1.8 1.1-2.4 2.4-.6-1.3-1.1-1.8-2.4-2.4 1.3-.6 1.8-1.1 2.4-2.4Z" />
      </svg>
    );
  }

  if (icon === "zed") {
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="5" fill="#1348dc" />
        <path fill="white" d="M5.2 5.5h13.6v3l-8.3 7h8.3v3H5.2v-3l8.3-7H5.2v-3Z" />
      </svg>
    );
  }

  const jetBrains = {
    intelliJ: ["IJ", "#ff318c", "#6b57ff"],
    rider: ["RD", "#ff4f5e", "#8b5cf6"],
    webStorm: ["WS", "#00c4f4", "#00d48a"],
    pyCharm: ["PC", "#20d58a", "#d7ef34"],
  } as const;
  if (icon in jetBrains) {
    const [label, from, to] = jetBrains[icon as keyof typeof jetBrains];
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <defs><linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22"><stop stopColor={from}/><stop offset="1" stopColor={to}/></linearGradient></defs>
        <rect width="24" height="24" rx="3" fill={`url(#${gradientId})`} />
        <rect x="4" y="4" width="16" height="16" fill="#09090b" />
        <text x="6" y="12.5" fill="white" fontSize="6.5" fontWeight="800" fontFamily="Segoe UI, sans-serif">{label}</text>
        <rect x="6" y="16.3" width="6" height="1" fill="white" />
      </svg>
    );
  }

  if (icon === "unity") {
    return (
      <svg className="launcher-logo" style={style} viewBox="0 0 24 24" aria-hidden="true">
        <path fill="currentColor" d="m15.5 2 6.2 10-6.2 10-3.2-3.4 4.1-6.6-4.1-6.6L15.5 2ZM11 5.8l4 6.2-4 6.2-7.8-.3-1.5-4.3h7.8l1-1.6-1-1.6H1.7l1.5-4.3 7.8-.3Z" />
      </svg>
    );
  }

  return <AppWindow className="launcher-logo custom" style={style} />;
}
