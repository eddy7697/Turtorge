# Extractable components

## TitleBar
- Source: `apps/desktop/src/components/shell/TitleBar.tsx`
- Category: layout
- Description: Borderless desktop title bar with brand, quick open, global actions, and Windows controls.
- Extractable props: `sidebarCollapsed`
- Hardcoded: Turtorge logo, labels, Lucide icons, keyboard hints, CSS classes

## WorkspaceSidebar
- Source: `apps/desktop/src/components/shell/WorkspaceSidebar.tsx`
- Category: layout
- Description: Workspace-first navigation with pinned/recent sections and runtime counts.
- Extractable props: `activeWorkspaceId`, `collapsed`
- Hardcoded: section labels, Lucide icons, footer actions, CSS classes

## WorkspaceHeader
- Source: `apps/desktop/src/components/shell/WorkspaceHeader.tsx`
- Category: layout
- Description: Active workspace identity, path, shell, running status, and primary actions.
- Extractable props: workspace name/path/environment, running count
- Hardcoded: action labels, Lucide icons, CSS classes

## StatusBar
- Source: `apps/desktop/src/components/shell/StatusBar.tsx`
- Category: layout
- Description: Compact workspace, shell, and running-terminal status surface.
- Extractable props: workspace name, shell name, running count
- Hardcoded: Ready label, Lucide icons, CSS classes

## TerminalPane
- Source: `apps/desktop/src/components/terminals/TerminalPane.tsx`
- Category: basic
- Description: Terminal tab strip, pane actions, xterm surface, runtime overlays, and terminal dialogs.
- Extractable props: active terminal, tab list, runtime states, empty state
- Hardcoded: toolbar icons, action labels, dialog copy, CSS classes

## Modal
- Source: `apps/desktop/src/components/ui/Modal.tsx`
- Category: basic
- Description: Shared modal shell with title, description, scrollable body, and footer.
- Extractable props: `title`, `description`, `width`
- Hardcoded: close icon and CSS classes
