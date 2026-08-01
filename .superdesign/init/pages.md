# Page dependency trees

## Desktop application

Entry: `apps/desktop/src/App.tsx`

Dependencies:

- `apps/desktop/src/app/ThemeProvider.tsx`
- `apps/desktop/src/components/dialogs/ConfirmQuitDialog.tsx`
  - `apps/desktop/src/components/ui/Modal.tsx`
- `apps/desktop/src/components/dialogs/CreateWorkspaceDialog.tsx`
  - `apps/desktop/src/components/ui/EnvironmentEditor.tsx`
  - `apps/desktop/src/components/ui/Modal.tsx`
  - `apps/desktop/src/lib/api.ts`
  - `apps/desktop/src/lib/ids.ts`
  - `apps/desktop/src/lib/layout.ts`
  - `apps/desktop/src/types.ts`
- `apps/desktop/src/components/dialogs/NewTerminalDialog.tsx`
  - `apps/desktop/src/components/ui/EnvironmentEditor.tsx`
  - `apps/desktop/src/components/ui/Modal.tsx`
  - `apps/desktop/src/lib/api.ts`
  - `apps/desktop/src/types.ts`
- `apps/desktop/src/components/dialogs/QuickOpenDialog.tsx`
  - `apps/desktop/src/components/ui/Modal.tsx`
- `apps/desktop/src/components/dialogs/SettingsDialog.tsx`
  - `apps/desktop/src/components/ui/Modal.tsx`
- `apps/desktop/src/components/shell/TitleBar.tsx`
  - `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/components/shell/WorkspaceSidebar.tsx`
- `apps/desktop/src/components/shell/WorkspaceHeader.tsx`
- `apps/desktop/src/components/shell/StatusBar.tsx`
- `apps/desktop/src/components/terminals/TerminalWorkspace.tsx`
  - `apps/desktop/src/components/terminals/TerminalPane.tsx`
    - `apps/desktop/src/components/terminals/XtermView.tsx`
    - `apps/desktop/src/components/ui/Modal.tsx`
    - `apps/desktop/src/lib/api.ts`
    - `apps/desktop/src/stores/appStore.ts`
    - `apps/desktop/src/types.ts`
- `apps/desktop/src/lib/api.ts`
- `apps/desktop/src/lib/layout.ts`
- `apps/desktop/src/stores/appStore.ts`
- `apps/desktop/src/types.ts`

Styles loaded by `apps/desktop/src/main.tsx`:

- `apps/desktop/src/styles/tokens.css`
- `apps/desktop/src/styles/globals.css`
- `apps/desktop/src/styles/terminal.css`
- `@xterm/xterm/css/xterm.css`
