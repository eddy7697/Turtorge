# Theme context

## Compact token summary

- Framework: React 19 + Vite 8; custom CSS, no component library or Tailwind.
- Typography: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`; base UI size 13px, compact terminal chrome 9–11px.
- Shape: 4px controls and pane corners, 8px dialogs, pill status chips.
- Layout: 40px title bar, 56px workspace header, 24px status bar, 236px sidebar, 34px terminal tab bar.
- Light surfaces: app `#eaf0ef`, title `#f7faf9`, sidebar `#f0f5f4`, primary `#f8fbfa`, terminal `#0b171b`.
- Dark surfaces: app `#071014`, title `#09171c`, sidebar `#0b181d`, primary `#0e1d22`, terminal `#061014`.
- Accent: light `#087f79`; dark `#72d8c9`.
- Semantic: success, warning, danger, and info all have light/dark tokens. Destructive UI uses `--danger` and `--danger-muted`.
- Motion: 100–160ms UI transitions; reduced-motion media query collapses animations.
- Responsive breakpoint: 1050px; product minimum window is 900×600.

## Raw `apps/desktop/src/styles/tokens.css`

~~~css
:root {
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text-primary);
  background: var(--app-bg);
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  --app-bg: #eaf0ef;
  --title-bar: #f7faf9;
  --sidebar: #f0f5f4;
  --surface-primary: #f8fbfa;
  --surface-secondary: #e7efed;
  --surface-hover: #dde9e7;
  --surface-active: #d3e6e2;
  --terminal-bg: #0b171b;
  --border-default: rgba(25, 69, 76, 0.14);
  --border-strong: rgba(0, 80, 96, 0.3);
  --text-primary: #10262b;
  --text-secondary: #405b60;
  --text-muted: #718589;
  --accent: #087f79;
  --accent-hover: #066a66;
  --accent-on: #f4fffd;
  --accent-muted: rgba(8, 127, 121, 0.11);
  --success: #25835c;
  --warning: #a66b13;
  --danger: #b94550;
  --danger-muted: rgba(185, 69, 80, 0.11);
  --info: #326fa4;
  --shadow-dialog: 0 24px 70px rgba(17, 42, 46, 0.23), 0 4px 16px rgba(17, 42, 46, 0.16);
}

:root[data-theme="dark"] {
  --app-bg: #071014;
  --title-bar: #09171c;
  --sidebar: #0b181d;
  --surface-primary: #0e1d22;
  --surface-secondary: #12252b;
  --surface-hover: #173039;
  --surface-active: #173740;
  --terminal-bg: #061014;
  --border-default: rgba(143, 205, 204, 0.14);
  --border-strong: rgba(143, 224, 214, 0.28);
  --text-primary: #e7f0f1;
  --text-secondary: #a4b8ba;
  --text-muted: #71878a;
  --accent: #72d8c9;
  --accent-hover: #8be7d9;
  --accent-on: #071014;
  --accent-muted: rgba(114, 216, 201, 0.13);
  --success: #6fd6a4;
  --warning: #e7b866;
  --danger: #ef7d84;
  --danger-muted: rgba(239, 125, 132, 0.12);
  --info: #79b8e8;
  --shadow-dialog: 0 24px 70px rgba(0, 0, 0, 0.5), 0 4px 16px rgba(0, 0, 0, 0.36);
}
~~~

## Raw `apps/desktop/src/styles/terminal.css`

~~~css
.terminal-workspace { flex: 1; min-width: 0; min-height: 0; padding: 6px; overflow: hidden; background: var(--app-bg); }
.split-container { width: 100%; height: 100%; display: flex; min-width: 0; min-height: 0; }
.split-container.horizontal { flex-direction: row; }
.split-container.vertical { flex-direction: column; }
.split-child { min-width: 0; min-height: 0; flex-grow: 0; flex-shrink: 0; }
.split-handle { position: relative; flex: 0 0 6px; z-index: 3; }
.horizontal > .split-handle { cursor: col-resize; }
.vertical > .split-handle { cursor: row-resize; }
.split-handle::after { content: ""; position: absolute; border-radius: 2px; background: transparent; transition: background 100ms ease; }
.horizontal > .split-handle::after { top: 0; bottom: 0; left: 2px; width: 2px; }
.vertical > .split-handle::after { left: 0; right: 0; top: 2px; height: 2px; }
.split-handle:hover::after, .split-handle:active::after { background: var(--accent); }

.terminal-pane { width: 100%; height: 100%; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border-default); border-radius: 4px; background: var(--terminal-bg); }
.terminal-pane:focus-within { border-color: var(--border-strong); box-shadow: 0 0 0 1px var(--accent-muted); }
.terminal-tabs { flex: 0 0 34px; min-width: 0; height: 34px; display: flex; align-items: stretch; overflow: hidden; border-bottom: 1px solid var(--border-default); background: var(--surface-secondary); }
.terminal-tab { position: relative; flex: 0 1 auto; min-width: 90px; max-width: 190px; height: 34px; padding: 0 8px; border: 0; border-right: 1px solid var(--border-default); display: flex; align-items: center; gap: 7px; background: transparent; color: var(--text-secondary); cursor: pointer; }
.terminal-tab:hover { background: var(--surface-hover); color: var(--text-primary); }
.terminal-tab.active { color: var(--text-primary); background: var(--terminal-bg); }
.terminal-tab.active::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: var(--accent); }
.terminal-tab > span:nth-child(2) { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; font-weight: 580; }
.runtime-dot { flex: 0 0 6px; width: 6px; height: 6px; border-radius: 50%; background: var(--text-muted); }
.runtime-dot.running { background: var(--success); }
.runtime-dot.starting, .runtime-dot.stopping { background: var(--warning); }
.runtime-dot.failed { background: var(--danger); }
.tab-shell { margin-left: auto; color: var(--text-muted); font-size: 9px; text-transform: uppercase; }
.tab-close { width: 16px; height: 16px; display: inline-flex; align-items: center; justify-content: center; border-radius: 3px; opacity: 0; }
.terminal-tab:hover .tab-close, .terminal-tab:focus-visible .tab-close, .terminal-tab.active .tab-close { opacity: .68; }
.tab-close:hover { color: var(--danger); background: var(--danger-muted); opacity: 1 !important; }
.tab-action, .pane-actions button { flex: 0 0 28px; width: 28px; border: 0; background: transparent; color: var(--text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; }
.tab-action:hover, .pane-actions button:hover { color: var(--text-primary); background: var(--surface-hover); }
.pane-actions { margin-left: auto; display: flex; }
.terminal-surface { position: relative; flex: 1; min-height: 0; overflow: hidden; background: var(--terminal-bg); }
.xterm-host { position: absolute; inset: 0; padding: 8px 9px 6px; }
.xterm-host .xterm { height: 100%; }
.xterm-host .xterm-viewport { scrollbar-color: var(--border-strong) transparent; scrollbar-width: thin; }
.terminal-overlay { position: absolute; inset: 0; z-index: 4; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: var(--text-muted); background: color-mix(in srgb, var(--terminal-bg) 92%, transparent); text-align: center; }
.terminal-overlay p { margin: 0; display: grid; gap: 5px; }
.terminal-overlay p strong { color: var(--text-primary); font-size: 13px; }
.terminal-overlay p span { max-width: 430px; color: var(--danger); font-size: 11px; line-height: 1.45; }
.terminal-overlay.error > svg { color: var(--danger); }
.terminal-empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-muted); }
.terminal-empty p { margin: 0; }
.terminal-exit-banner { position: absolute; left: 8px; right: 8px; bottom: 8px; z-index: 3; min-height: 32px; padding: 5px 8px 5px 10px; border: 1px solid var(--border-default); border-radius: 4px; display: flex; align-items: center; justify-content: space-between; color: var(--text-secondary); background: var(--surface-primary); box-shadow: 0 5px 18px rgba(0,0,0,.24); font-size: 11px; }
.terminal-exit-banner button { height: 22px; border: 0; border-radius: 3px; display: flex; align-items: center; gap: 5px; color: var(--accent); background: transparent; cursor: pointer; }
.terminal-exit-banner button:hover { background: var(--accent-muted); }
.rename-error { margin-top: 10px; }

@media (max-width: 1050px) {
  .tab-shell { display: none; }
  .terminal-tab { min-width: 74px; }
}
~~~

## Raw theme provider

~~~tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ResolvedTheme, ThemePreference } from "../types";

const ThemeContext = createContext<ResolvedTheme>("dark");

export function ThemeProvider({ preference, children }: { preference: ThemePreference; children: ReactNode }) {
  const media = useMemo(() => window.matchMedia("(prefers-color-scheme: dark)"), []);
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(media.matches ? "dark" : "light");
  const resolvedTheme: ResolvedTheme = preference === "system" ? systemTheme : preference;

  useEffect(() => {
    const update = (event: MediaQueryListEvent) => setSystemTheme(event.matches ? "dark" : "light");
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [media]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  return <ThemeContext.Provider value={resolvedTheme}>{children}</ThemeContext.Provider>;
}

export const useResolvedTheme = (): ResolvedTheme => useContext(ThemeContext);
~~~

## Global CSS

The complete global stylesheet is `apps/desktop/src/styles/globals.css` (188 lines). It defines the app grid, title bar, workspace sidebar/header, status bar, shared buttons, dialogs, forms, bootstrap and empty states, the 1050px responsive breakpoint, and reduced-motion behavior. It is passed directly as a context file for design generation so the canonical source remains authoritative.
