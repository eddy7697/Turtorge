# Routes

Turtorge is a single-window React application without a router.

| UI route | Entry | Root component | Shared layout |
| --- | --- | --- | --- |
| Desktop application | `apps/desktop/src/main.tsx` | `apps/desktop/src/App.tsx` | TitleBar, WorkspaceSidebar, WorkspaceHeader, TerminalWorkspace, StatusBar |

The root component switches between bootstrap, empty-workspace, and active-workspace render branches. The active-workspace branch is the target for terminal pane and tab layout work.
