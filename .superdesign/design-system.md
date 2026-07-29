# Turtorge Design System

## Product context

Turtorge is a Windows-first desktop workspace terminal manager for AI-native developers. The product helps developers reopen a complete development workspace instead of reconstructing terminal windows. It embeds every terminal inside one application and owns workspace navigation, per-pane tab groups, nested split layouts, terminal labels, shell selection, runtime status, and restore behavior.

Primary users are backend, DevOps, platform, SRE, and AI-native developers. Their jobs-to-be-done are: find a project in one second; restore its working layout in five seconds; move between Windows PowerShell and WSL bash/zsh without losing interactive fidelity; identify every terminal by purpose; and safely understand which processes remain running.

The initial desktop surface includes: a custom title bar, workspace sidebar, workspace header, terminal layout area, per-pane tab strips, terminal panels, status bar, quick-create menus, create-workspace dialog, close-process confirmation, missing-shell/path recovery, shell detection, and theme controls.

## Visual direction

Use the selected Neural Noir interface prompt only as the structural style source: layered near-black surfaces, subtle translucency, precise borders, restrained depth, and calm high contrast. Adapt it strictly to Turtorge's existing brand. Do not use its gold palette, serif typography, landing-page composition, large radii, decorative neural lines, or marketing effects.

The application must feel like a focused professional developer tool: compact, quiet, technical, durable, and native to Windows. The terminal canvas is always the visual priority. Avoid oversized headers, excessive whitespace, neon cyberpunk effects, purple/blue SaaS gradients, ornamental illustration, or card-heavy dashboard styling.

## Brand assets

Use the real `images/logo.png` asset. It is a wide Turtorge wordmark with a turtle mark. The full wordmark belongs in the expanded custom title bar; the turtle mark is used for compact identity and eventual application icons. Never redraw or replace it with a generic terminal icon.

Logo-derived brand colors:

- Deep teal: `#004060`
- Ocean teal: `#005060`
- Dark teal: `#003040`
- Mint cyan: `#80E0D0`
- Bright mint: `#80F0E0`

Brand cyan is an accent, never a large background fill.

## Typography

- UI: `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Terminal: `ui-monospace, "Cascadia Mono", "Consolas", monospace`
- No downloaded fonts, serif display faces, or decorative typography.
- Application title: 13px, 600 weight.
- Workspace title: 17px, 650 weight.
- Body: 13px, 400-500 weight.
- Compact labels: 11px, 600 weight, moderate letter spacing only for status/meta text.
- Terminal output: 13px by default, user-adjustable later.

## Core tokens

### Dark theme

- App background: `#071014`
- Title bar: `#09171C`
- Sidebar: `#0B181D`
- Surface primary: `#0E1D22`
- Surface secondary: `#12252B`
- Surface hover: `#173039`
- Surface active: `#173740`
- Terminal background: `#061014`
- Terminal foreground: `#D8E7E8`
- Border default: `rgba(143, 205, 204, 0.14)`
- Border strong: `rgba(143, 224, 214, 0.28)`
- Text primary: `#E7F0F1`
- Text secondary: `#A4B8BA`
- Text muted: `#71878A`
- Accent: `#72D8C9`
- Accent hover: `#8BE7D9`
- Accent muted: `rgba(114, 216, 201, 0.13)`
- Success: `#6FD6A4`
- Warning: `#E7B866`
- Danger: `#EF7D84`
- Info: `#79B8E8`
- Focus ring: `0 0 0 2px rgba(114, 216, 201, 0.52)`

### Light theme

- App background: `#EAF0EF`
- Title bar: `#F7FAF9`
- Sidebar: `#F0F5F4`
- Surface primary: `#F8FBFA`
- Surface secondary: `#E7EFED`
- Surface hover: `#DDE9E7`
- Surface active: `#D3E6E2`
- Terminal background: `#0B171B`
- Terminal foreground: `#D8E7E8`
- Border default: `rgba(25, 69, 76, 0.14)`
- Border strong: `rgba(0, 80, 96, 0.30)`
- Text primary: `#10262B`
- Text secondary: `#405B60`
- Text muted: `#718589`
- Accent: `#087F79`
- Accent hover: `#066A66`
- Accent muted: `rgba(8, 127, 121, 0.11)`
- Success: `#25835C`
- Warning: `#A66B13`
- Danger: `#B94550`
- Info: `#326FA4`

## Spacing and geometry

- Base spacing unit: 4px.
- Common gaps: 4, 6, 8, 12, 16, 20px.
- Custom title bar height: 40px.
- Workspace header height: 56px.
- Status bar height: 24px.
- Expanded sidebar width: 236px; compact width: 52px.
- Terminal tab strip/header: 34px.
- Button heights: 28px compact, 32px normal, 36px dialog primary.
- Input height: 34px.
- Corner radii: 4px for controls, 6px for menus/dialog fields, 8px for dialogs and empty states. Never use pill shapes except compact status chips.
- Borders are usually 1px. Shadows are restrained: dialogs and floating menus only.
- Minimum window: 900x600. Primary design viewport: 1440x900.

## Application layout

Use a borderless custom Windows title bar. The left side contains the real compact wordmark and a sidebar toggle; the center contains a Quick Open trigger; the right contains global actions and custom minimize, maximize/restore, and close buttons. The draggable region must never overlap interactive controls.

Below it, the sidebar occupies the full height down to the status bar. The main column contains a compact workspace header and the terminal layout. The status bar spans the bottom. Workspaces are grouped only as Pinned and Recent in this initial vertical slice; do not show fake groups, Git dashboards, or Docker dashboards.

The terminal layout is a recursive split tree. Every pane owns its own tab strip. The active terminal has a restrained accent border and visible focus state. Terminal headers show meaningful names first and shell/runtime metadata second. Runtime output must visually dominate chrome.

Use realistic content in the draft: workspaces `Turtorge`, `Wallet API`, `Infrastructure`; panes with tabs `Codex`, `PowerShell 7`, `API Server`, and `WSL zsh`; runtime states Running and Ready; WSL distribution `Ubuntu-20.04`; workspace path `E:\\Projects\\Turtorge`.

## Components

- Workspace item: 32px row, turtle/folder initial icon, name, optional running count, pin marker, and active accent bar. Active state uses accent-muted background plus a non-color marker.
- Terminal pane: low-radius bordered surface with tab strip and full-bleed terminal canvas. Avoid placing terminal content in floating cards.
- Per-pane tabs: compact flat tabs; active tab has stronger text and bottom accent; inactive tabs remain legible. Each tab includes label, runtime indicator, and close action on hover/focus.
- Buttons: icon plus label for important actions; icon-only buttons require tooltip and accessible label. Primary buttons use dark text on mint accent. Secondary buttons use surface and border.
- Dialogs: centered, maximum 520px wide, clear title/description, compact form groups, left-aligned content, right-aligned actions.
- Menus: dense 30px rows, keyboard focus, shortcuts right-aligned, restrained elevation.
- Status: always combine color with text or icon shape.
- Empty state: real turtle brand mark, short product line, Create Workspace primary action, Open Folder secondary action.

## Interaction and motion

- Motion duration: 100-160ms for hover/focus, 160-220ms for dialogs and sidebar collapse.
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`.
- No animation on terminal output and no large workspace transitions.
- Respect reduced motion by switching to immediate state changes or short fades.
- Keyboard focus is always visible.
- Theme changes update chrome and xterm colors without reconstructing Terminal instances or processes.

## Accessibility

Meet WCAG AA contrast where possible. Do not communicate runtime, selection, trust, warnings, or failure only through color. All custom window controls, tabs, split actions, close actions, and icon buttons require names and visible focus. Preserve logical keyboard order across sidebar, workspace header, pane tabs, and terminal canvas.

## Hard constraints

- Every terminal remains embedded inside the application.
- The app controls all tabs, labels, splits, focus, and layout persistence.
- No native OS title bar decoration.
- No external terminal windows.
- English UI for the first release.
- System, Light, and Dark theme support.
- Use ONLY the fonts, colors, spacing, and component styles defined here. Do not introduce unlisted fonts, colors, gradients, or visual styles.
