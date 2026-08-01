# Turtorge Development History

Last updated: 2026-08-01
Current stage: Workspace terminal navigation and visible overflow scrolling are implemented and verified in an isolated production build; the active standard standalone release was intentionally not replaced

This document preserves the product and engineering context of the first Turtorge implementation cycle so future work can continue without reconstructing decisions from chat history.

## 1. Starting point

The repository initially contained product documents under `docs/` and the supplied turtle logo under `images/`.

The implementation was based on:

- `PRD.md`
- `ARCHITECTURE.md`
- `UI_SPEC.md`
- `ROADMAP.md`
- `images/logo.png`

The product direction was stress-tested with the user before implementation. The approved product is a Windows-first, workspace-oriented terminal manager—not an IDE and not a wrapper that opens external terminal windows.

## 2. Confirmed product decisions

- Every terminal must remain inside the Turtorge application layout.
- Turtorge controls terminal tabs, labels, panes, and nested split layouts.
- The desktop window uses a custom borderless title bar.
- Windows 10 and 11 are the first supported platforms.
- React, TypeScript, xterm.js, Tauri v2, and Rust form the initial stack.
- Rust owns PTYs, child processes, storage, resizing, shutdown, and runtime state.
- PowerShell defaults to the highest installed version while keeping every detected version selectable.
- WSL distributions are detected dynamically; Docker-managed distributions are hidden.
- After choosing a WSL distribution, Turtorge detects supported bash and zsh executables.
- WSL shell priority is the distribution login shell, then zsh, then bash.
- A selected WSL shell runs as a real interactive login shell under the distribution's default user.
- Shell or path failures are shown explicitly; Turtorge never silently falls back.
- Non-interactive Windows shell and WSL capability probes do not open console windows; their progress and failures are presented as readable application UI instead.
- A previously saved WSL terminal working directory that later disappears falls back to the distribution default user's `~` and prints a visible terminal notice. Newly selected invalid directories still fail validation instead of falling back.
- Windows, UNC, WSL-mounted, and WSL-native paths are supported through typed path models.
- Switching workspaces keeps Rust-managed terminal processes alive.
- Quitting Turtorge terminates all managed processes after one confirmation.
- Initial terminal creation starts immediately but persists `autoStart: false` unless explicitly enabled.
- Terminal input, output, and scrollback are not written to disk.
- A bounded in-memory scrollback is retained only while a process is running.
- Multi-line paste requires confirmation.
- Closing a running terminal requires confirmation, with session-only suppression.
- Leaf panes can be deleted, but the final pane in a workspace is protected. Deleting a non-empty pane always requires a bulk confirmation and collapses its parent split by promoting the sibling subtree.
- Terminal tabs can be reordered within a pane and moved between panes in the same workspace. Cross-workspace drag-and-drop and keyboard tab movement remain deferred.
- Workspace rows can be expanded independently to show every saved terminal in pane/tab layout order. Selecting a child switches workspaces, activates its pane tab, and focuses xterm without starting an inactive terminal.
- Sidebar terminal activity uses three states: green for starting/running/stopping, gray for never started or normal exit, and red for startup/runtime failure, disconnection errors, or non-zero exit. Workspace badges count only green states.
- Workspace expansion is session-only. Selecting a workspace automatically expands it, multiple workspaces may remain expanded, and only the active workspace starts expanded after restart.
- Overflowing terminal tab strips and the workspace list use thin visible scrollbars. A vertical mouse wheel over the tab strip navigates horizontally toward the beginning or end; native horizontal touchpad input remains unchanged.
- Pane deletion waits for terminal start/stop transitions. Runtime or persistence failures keep the pane and terminal definitions visible so failed WSL terminals can be retried without losing the layout.
- Claude Code and Codex are terminal profiles rather than separate domain models.
- Environment variables are plaintext in this MVP and the UI warns users accordingly.
- The initial UI language is English and supports system, light, and dark themes.

## 3. Design phase

An interactive Superdesign exploration was created and approved before frontend implementation.

- Project ID: `4bc1eb85-7010-4c75-8f24-1215dc7f1951`
- Approved draft ID: `c238d761-321c-4023-9a4a-a41c2b006fa3`
- Design system: `.superdesign/design-system.md`
- Canvas: <https://superdesign.dev/teams/3889d334-835f-4a3a-8a99-6e4ec990fe72/projects/4bc1eb85-7010-4c75-8f24-1215dc7f1951>
- Preview: <https://p.superdesign.dev/draft/c238d761-321c-4023-9a4a-a41c2b006fa3>

The final UI follows the approved dark teal visual system, workspace sidebar, top command surface, terminal grid, compact status indicators, responsive modal layout, and supplied turtle branding.

The layout-management follow-up was also explored in Superdesign. The approved drag-and-drop and pane-deletion variants are `f549317d-6f61-47f1-803e-e8dc974a9702` and `1729b034-16f6-4503-915c-ca44123afa3d`. Pane actions use a fixed right-side strip so large panes do not leave the controls visually detached from the right edge.

The workspace-terminal navigation and overflow follow-up was finalized in Superdesign draft `0180969e-f94e-4e29-ad07-1fd2841d2463`. It preserves the existing Pinned/Recent structure and separates the disclosure chevron, workspace folder, and row-level pin icon.

The source logo was not altered. `images/app-icon.png` and the Tauri platform icons were generated as deterministic transparent crops of the supplied artwork.

## 4. Implementation phase

### Frontend

- React 19 and TypeScript
- Vite 8
- Zustand application state
- xterm.js 6
- Fit and web-links addons
- Application-controlled terminal tabs
- Native mouse/trackpad tab drag-and-drop with exact insertion markers, pane drop highlighting, horizontal tab scrolling, and same-workspace cross-pane moves
- Persisted terminal label rename from either the pane action or a tab double-click
- Nested horizontal and vertical split tree
- Leaf-pane deletion with final-pane protection, transition blocking, bulk process confirmation, sibling-tree promotion, and visible persistence errors
- Draggable split ratios
- Workspace sidebar and quick open
- Independently expandable workspace rows with all-terminal child navigation, layout-order traversal, active-pane highlighting, ellipsis tooltips, and accessible three-state runtime lights
- Thin visible sidebar and terminal-tab scrollbars, including vertical-wheel-to-horizontal tab navigation and native horizontal gesture preservation
- Custom-title-bar drag coverage across the empty action area while preserving interactive buttons
- Create Workspace and New Terminal flows
- Per-terminal working-directory selection and Windows/WSL native folder browsing in New Terminal
- Settings, light/dark/system theme selection, and responsive dialogs
- Readable in-app bootstrap, WSL shell-detection, directory-validation, and workspace/terminal preparation status
- Shell, Claude Code, Codex, and custom terminal profiles
- Environment-variable editor and plaintext warning
- Multi-line paste and terminal-close safeguards

### Rust and Tauri

- Tauri v2 command boundary
- Typed Serde request, response, and Channel event contracts
- `portable-pty` 0.9 over Windows ConPTY
- Rust-owned terminal registry and process lifecycle
- Input, resize, graceful close, forced termination, and exit monitoring
- Bounded 1 MiB in-memory byte scrollback per running terminal
- Atomic JSON workspace and settings persistence
- Windows PowerShell discovery and semantic version selection
- Centralized no-console execution for non-interactive Windows capability and path probes
- WSL distribution discovery and Docker-distribution filtering
- Per-distribution bash/zsh detection
- WSL home-directory and working-directory resolution
- `\\wsl.localhost` / `\\wsl$` folder-picker path conversion back to WSL-native paths
- Missing saved WSL working-directory fallback to the default user's home with an in-terminal notice
- Native `zsh -l -i` and `bash -l -i` startup
- Redacted error model that does not persist terminal content or environment values

### Branding and release assets

- Original logo retained at `images/logo.png`
- Application icon generated at `images/app-icon.png`
- Windows, macOS, iOS, and Android Tauri icon assets generated for future packaging compatibility

## 5. Important engineering discoveries

### Camel-case IPC contracts

The first native Create Workspace attempt exposed a Serde mismatch: TypeScript sent `terminalIds` and `activeTerminalId`, while Rust enum variant fields still expected snake_case.

Resolution:

- Added `rename_all_fields = "camelCase"` to tagged Rust enums.
- Added regression tests for layout deserialization and terminal event serialization.

### WSL `~` working directory

`wsl.exe --cd` cannot rely on the Windows process to expand `~` correctly for the selected distribution.

Resolution:

- Resolve the distribution default user's home directory in Rust.
- Validate and pass the resulting absolute Linux path to WSL.
- Preserve visible failure instead of falling back to another directory.

### ConPTY cursor-status handshake

PowerShell and WSL initially appeared to be running but showed a blank terminal. Real PTY diagnostics revealed that ConPTY first emits a cursor-position request (`DSR`) and waits for a terminal response.

Resolution:

- Complete the initial cursor-status handshake during PTY bootstrap.
- Consume the bootstrap query before forwarding the remaining stream.
- Keep later terminal protocol traffic flowing normally through xterm.js.
- Add an opt-in integration test using real PowerShell, WSL zsh, and WSL bash.

### React Channel detach/attach race

Rust was receiving terminal output, but the UI still showed zero bytes. The runtime ID update caused the React connection effect to rerun. The old asynchronous detach could execute after the new attach and clear the valid Channel subscriber.

Resolution:

- Keep one Channel for the entire terminal connection generation.
- Reconnect only when the terminal, workspace, or explicit restart generation changes.
- Return in-memory scrollback with attach responses so reattached views receive a reliable snapshot.

This correction produced the expected native WSL zsh prompt inside Turtorge.

### WSL folder browsing and stale working directories

The Windows folder picker can browse a distribution through `\\wsl.localhost\<distribution>`, but it returns a Windows UNC path rather than the Linux path required by `wsl.exe --cd`.

Resolution:

- Open WSL browsing at the selected distribution root.
- Convert `\\wsl.localhost` and `\\wsl$` selections to absolute Linux paths in Rust before persisting the terminal definition.
- Validate the selected directory when the terminal is created.
- Revalidate it at process start; if it disappeared later, use the resolved WSL home directory and print a visible fallback notice.

### Background shell-probe console flashes

Direct `std::process::Command` probes for PowerShell, `where.exe`, and `wsl.exe` can briefly create visible console windows when launched by a Windows GUI application.

Resolution:

- Centralize background command execution and apply the Windows `CREATE_NO_WINDOW` creation flag.
- Route version discovery, executable checks, WSL distribution and shell detection, and directory validation through that helper.
- Keep interactive terminal startup on ConPTY unchanged.
- Surface detection and validation progress inside Turtorge instead of relying on transient console output.

### Tauri production builds must use the Tauri CLI

A direct `cargo build --release` produces a Rust release binary but does not apply the Tauri CLI production configuration. The resulting executable can still open the development URL and show a localhost connection error when no Vite server is running.

Resolution:

- Build the frontend production assets first.
- Produce standalone Windows executables through `tauri build --no-bundle`, not bare Cargo.
- Verify the executable with the development server stopped and confirm that the embedded Turtorge UI loads.

### Tauri file-drop handling blocks frontend tab dragging on Windows

The layout tests correctly exercised React drag/drop handlers, but the native Tauri window still did not deliver HTML5 drag events. Tauri enables its own WebView2 drag/drop handler by default, which replaces frontend HTML5 drag/drop handling on Windows.

Resolution:

- Set `dragDropEnabled: false` on the Tauri window because Turtorge does not currently accept native file drops.
- Keep the existing HTML5 terminal-tab drag/drop implementation.
- Treat jsdom or regular-browser drag tests as event-wiring coverage only; native WebView2 drag acceptance must be verified separately.

### Tauri drag regions do not inherit through child layout elements

The custom title bar itself had `data-tauri-drag-region`, but the right-side flex container covered the visible gap between Quick Open and New Terminal. Tauri's normal drag-region attribute applies only to the directly marked element, so clicks on that child container did not move the window.

Resolution:

- Mark the right-side action container itself as a drag region.
- Leave its buttons unmarked so New Terminal, Settings, and the window controls remain interactive.
- Add a structural regression test for the container and button attributes; native window dragging still requires native acceptance.

### Modified Enter keys require explicit terminal encoding

xterm.js 6 sends the same carriage return for Enter and Shift+Enter by default. Claude Code therefore cannot distinguish a requested newline from prompt submission without terminal-specific key encoding.

Resolution:

- Encode Shift+Enter at the terminal-emulator layer, independently of the terminal's startup profile, because a normal shell terminal may launch Claude Code or Codex later.
- Send the CSI-u sequence `ESC [ 13 ; 2 u` directly to the PTY so supporting foreground applications can distinguish it from Enter.
- Leave ordinary Enter and other modified Enter chords under xterm.js default handling.

### Workspace reattachment needs subscriber identity

Switching workspaces keeps the Rust PTY alive but recreates the visible xterm.js view. An asynchronous detach from an older view could arrive after a newer attach and clear the valid Channel subscriber, leaving a black terminal until another tab switch forced reattachment.

Resolution:

- Give every frontend terminal connection a unique connection ID.
- Allow Rust detach operations to clear only the matching subscriber.
- Key xterm.js views by workspace and terminal definition so React does not reuse stale view state across workspaces.
- Queue live terminal events until the attach snapshot has been replayed, then preserve their original order.
- Avoid reconnecting merely because the stored runtime snapshot object changed.

## 6. Verification history

The completed MVP passed:

- Frontend Vitest suite: 3/3 tests
- Rust default suite: 7 passed, 1 environment-dependent test intentionally ignored by default
- Rust Clippy with `-D warnings`
- TypeScript production compilation
- Vite production build
- Tauri release build with embedded frontend resources
- Real ConPTY PowerShell test
- Real WSL zsh interactive login-shell test
- Real WSL bash interactive login-shell test
- PTY input, output, and clean exit round trip
- Native Create Workspace flow using a detected WSL distribution
- Native WSL zsh prompt rendering inside the application layout
- Quit confirmation and managed-process termination
- Browser visual QA at 1440×900 and the required 900×600 minimum
- Settings modal, light theme, responsive Create Workspace scrolling, terminal creation, and close confirmation
- Standalone release startup with the Vite development server stopped

The WSL terminal usability and silent background-probe follow-ups additionally passed:

- Frontend Vitest suite: 6/6 tests, including WSL directory selection, terminal rename, and readable pending detection status
- Rust default suite: 8 passed, 1 real-WSL integration test ignored by default
- Rust Clippy with `-D warnings`
- TypeScript application compilation and Vite production build
- Real PowerShell, WSL zsh, and WSL bash PTY integration test
- Real missing-directory fallback assertion that `$PWD` equals `$HOME`
- Native WSL folder browsing from `\\wsl.localhost\Ubuntu-20.04` and conversion of the selected folder to `/home/eddy`
- Native terminal rename, persistence across application restart, and test-data restoration
- Repeated native-window polling during standalone startup and WSL workspace detection, with zero new `cmd.exe`, PowerShell, `wsl.exe`, or `conhost.exe` windows observed
- Standalone production executable startup with embedded frontend resources and no development server

The layout-management optimization additionally passed:

- Frontend Vitest suite: 15/15 tests, covering layout-tree collapse, adjacent active-tab selection, same-pane reorder, cross-pane movement, pane deletion guards, and native drag/drop event forwarding
- TypeScript application compilation and Vite production build
- Rust default suite: 8 passed, 1 real-WSL integration test ignored by default
- Rust Clippy with `-D warnings`
- Opt-in real WSL zsh PTY integration test
- Browser QA of fixed-right pane actions, non-empty pane confirmation, immediate empty-pane deletion, and final-pane protection
- Tauri CLI standalone production build and native-window verification with no development server; the embedded UI loaded without a localhost request

The terminal interaction and workspace-reattachment follow-up passed:

- Frontend Vitest suite: 21/21 tests, including Claude Code Shift+Enter encoding, snapshot-before-live-output ordering, stable single attachment, and xterm remount on workspace identity changes
- TypeScript application compilation and Vite production build
- Rust default suite: 10 passed, 1 real-WSL integration test ignored by default
- Rust subscriber-identity regression tests proving stale detach cannot clear a newer Channel
- Rust Clippy with `-D warnings`
- Opt-in real PowerShell, WSL zsh, WSL bash, and missing-directory fallback PTY integration test
- Tauri CLI release build with the updated WebView2 drag/drop configuration and embedded production frontend, written to an isolated verification target
- Native interactive acceptance for tab dragging, Shift+Enter, and workspace round trips remains pending because the existing standalone process was intentionally left running with active terminals

The custom-title-bar drag-region follow-up additionally passed:

- Frontend Vitest suite: 22/22 tests, including direct drag-region coverage on the right-side action container without marking its buttons
- TypeScript application compilation and Vite production build
- Tauri CLI `--no-bundle` release build to the standard standalone path with the latest frontend resources embedded
- Native window-drag acceptance remains pending

The workspace-terminal navigation and overflow follow-up additionally passed:

- Frontend Vitest suite: 26/26 tests, including workspace expansion, pane/tab ordering, three-state lights, child selection, mouse-wheel direction, and sidebar-to-xterm focus
- TypeScript application compilation and Vite production build
- Browser QA with 24 saved terminals: sidebar overflow measured `732px` against a `574px` viewport and scrolled to its `158px` limit; the tab strip measured `3087px` against `365px` and exposed its thin scrollbar
- Browser wheel acceptance: wheel-up moved the tab strip from `2722` to `2250`; wheel-down returned it to the `2722` end limit
- Browser stopped-terminal acceptance: selecting gray PowerShell activated its tab and focused the xterm input without starting it or increasing the 23-process running badge
- Browser console remained free of warnings and errors during the overflow, navigation, and focus checks
- Tauri CLI `--no-bundle` production build succeeded at `target/codex-sidebar-overflow-verification/release/turtorge.exe`

The production frontend currently emits a non-blocking warning that the main JavaScript chunk is larger than 500 kB. Code splitting is a future optimization, not an MVP blocker.

## 7. Delivery state

The first complete project commit is:

```text
c9aabdd feat: build Turtorge Windows terminal manager
```

Branch:

```text
develop
```

Standalone release executable:

```text
apps/desktop/src-tauri/target/release/turtorge.exe
```

The standalone release was rebuilt after the layout-management optimization with the production frontend embedded. It passed an independent startup and responsive-window check, then closed cleanly without leaving a Turtorge process running.

The 2026-07-31 interaction fixes were initially built under `target/codex-native-verification/release/turtorge.exe` to avoid replacing an active standalone process. After no Turtorge process remained, the standard `target/release/turtorge.exe` was rebuilt through the Tauri CLI with the terminal-interaction, workspace-reattachment, and custom-title-bar drag-region fixes embedded. Its SHA-256 is `456B461C4079ECF00691001F5BA0C792D2ABD46321D6D13FE260A01392B62CFB`; native interactive acceptance remains pending.

The 2026-08-01 workspace-terminal navigation and overflow changes were built under `target/codex-sidebar-overflow-verification/release/turtorge.exe`. The standard `target/release/turtorge.exe` remained active with running terminals and was intentionally not replaced.

## 8. Deferred scope

The following work was deliberately excluded from this MVP:

- Installer packaging, signing, and auto-update
- macOS and Linux native builds
- `.turtorge.yml` manifest import/export and repository trust flow
- Tags, groups, and the full workspace management surface
- Full settings matrix
- Secure secret storage
- Diagnostic export archive
- Git Bash, SSH, container, and remote adapters
- Bundle code splitting and performance tuning beyond the MVP target
- Keyboard commands for moving terminal tabs and cross-workspace tab drag-and-drop

These are future phases, not incomplete items from the approved Windows MVP.

## 9. Continuation guidance

Before beginning the next phase:

1. Read this file and `MVP_IMPLEMENTATION.md`.
2. Confirm the next scope boundary with the user.
3. Preserve Rust ownership of PTY/process/storage responsibilities.
4. Preserve in-app terminal tabs and layouts; do not open external console windows.
5. Keep terminal content out of persistent logs and storage.
6. Run the default test matrix and the opt-in real WSL PTY test after terminal-layer changes.
7. Update this history when a phase is completed or a major architectural decision changes.
