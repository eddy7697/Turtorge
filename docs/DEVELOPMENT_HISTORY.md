# Turtorge Development History

Last updated: 2026-08-08
Current stage: The completed Windows feature baseline remains unchanged; repository documentation now distinguishes the verified implementation from the original draft vision, and a macOS handoff records the current porting blockers and evidence requirements

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
- Switching terminal tabs or workspaces also keeps each running xterm.js emulator instance mounted. Hidden views retain their dimensions and emulator state; the selected view is fitted, refreshed, and focused when it becomes visible.
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
- Post-MVP work may now optimize the actively used product without redefining the completed Windows MVP or its architectural boundaries.
- Every terminal may inherit the global external-launcher default or override it. The launcher always targets the terminal definition's saved working directory, not the live shell directory or workspace root.
- The pane launcher button sits immediately left of Edit Terminal. Its first unconfigured use opens setup with File Explorer selected; subsequent uses launch directly. The former disabled workspace-level Open Editor action is removed.
- Launcher profiles use a structured executable plus argument-token model, never a raw shell command or launcher-specific environment variables. Direct `.exe` and `.com` programs are allowed, `.cmd` and `.bat` use a controlled command invocation, and PowerShell scripts are rejected.
- Built-in launcher profiles cover File Explorer, Visual Studio Code, Cursor, Antigravity, Zed, IntelliJ IDEA, Rider, WebStorm, PyCharm, and Unity. Unavailable tools remain visible but cannot be activated until their executable is located. Built-ins are read-only and may be cloned for customization.
- Launcher templates support `{path}`, `{wslPath}`, `{distribution}`, and `{projectRoot}`. WSL-aware launchers may use dedicated WSL arguments; generic Windows launchers receive a `\\wsl.localhost` path. Missing WSL paths remain visible failures.
- Unity launching is Windows-only, requires both `Assets` and `ProjectSettings`, reads the required editor version from `ProjectVersion.txt`, and stops with an actionable error if that exact installed version cannot be found.
- Externally launched file managers and editors are detached from Turtorge: they are not treated as terminal processes, counted in running badges, or terminated on application exit.
- A future macOS implementation should give Finder the same built-in file-manager role that File Explorer has on Windows.
- Cloning the source repository on macOS does not constitute native macOS support. Native build, PTY behavior, platform UI, launchers, packaging, signing, and delivery remain unimplemented and unverified.
- `DEVELOPMENT_HISTORY.md` and `MVP_IMPLEMENTATION.md` govern confirmed implementation state. `PRD.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, and `ROADMAP.md` preserve draft vision and future direction where they describe capabilities outside that state.
- Edit Terminal now owns the full terminal definition. Label and launcher changes apply immediately; shell, working directory, startup command, environment, and auto-start changes apply on the next start. A running terminal receives an explicit Restart Now or Later choice when process configuration changes. Tab double-click remains the quick-rename path.
- Terminal tabs and sidebar terminal entries use the same custom context menu for launcher access, start or confirmed force restart, rename, full editing, and confirmed deletion. Right-clicking does not change the active workspace or terminal; actions target the item that opened the menu.
- The visible tab-close, pane-edit, and pane-delete buttons are removed. The high-frequency external-launcher button remains visible, while pane creation, splitting, and deletion move to the pane action-area context menu; native xterm right-click behavior remains untouched.
- Workspace context menus provide New Terminal and Rename Workspace. Creating a terminal from an inactive workspace first activates that workspace and inserts the terminal into its first pane. Workspace names are trimmed, limited to 80 characters, and may duplicate existing names.
- Context menus are theme-aware, keyboard accessible through Shift+F10 or the Menu key, and use a 248 px width with 30 px single-line rows. Empty-pane deletion is immediate, non-empty pane deletion is confirmed, and the final pane remains protected.

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

The external-launcher and full terminal-edit follow-up was explored through the baseline draft `d3a4ace0-5722-4609-a67d-4c352fef56fd` and approved launcher setup, settings, terminal editor, and profile editor drafts `5f2561b1-bee8-4e55-8a90-861086289970`, `6e9311e1-6b5b-4fbd-91b6-d96e019da74e`, `b9cc79bc-6d8a-4d00-b271-a716fd94389f`, and `5eb2e6ef-73ae-4b5e-bc0d-beabf1b03f3a`.

The context-menu interaction follow-up was explored from baseline draft `fbfc8c65-aa1a-47be-91c2-473af2ea9010` and finalized in approved draft `7b3de1c6-107c-4b6d-b7c9-6a93e4220df5`. Its 248 px menu width keeps destructive labels on one line while preserving the compact 30 px row rhythm.

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
- Full Edit Terminal flow for label, shell/profile, working directory, startup command, environment variables, auto-start, and external-launcher override; tab double-click remains quick rename
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
- Launcher settings with a global default, availability-aware built-in preset grid, branded marks, clone-to-custom behavior, structured profile editing, reference-safe deletion, and executable selection
- Dynamic pane launcher action, first-use Save & Open setup, persistent actionable launch errors, and optional launcher selection in Create Workspace and New Terminal
- Readable in-app bootstrap, WSL shell-detection, directory-validation, and workspace/terminal preparation status
- Shell, Claude Code, Codex, and custom terminal profiles
- Environment-variable editor and plaintext warning
- Multi-line paste and terminal-close safeguards
- Shared custom context menus for terminal tabs, sidebar terminals, workspaces, and pane action areas, with viewport clamping, disabled-state explanations, keyboard navigation, and Escape focus restoration
- Context-targeted rename and full editor flows, confirmed terminal deletion, and confirmed force restart through a freshly attached PTY
- Workspace rename dialog and context-targeted New Terminal flow for active or inactive workspaces

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
- Serde-default launcher fields that preserve compatibility with existing settings and terminal definitions
- External-launcher discovery from PATH and trusted stable install locations without executing candidate tools
- Typed launcher validation and argument expansion, Windows/WSL path translation, Unity project/version resolution, and detached process creation

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

### A clean parallel Cargo build may encounter a transient silent MSVC linker failure

A date-stamped clean build once failed while linking the `serde_core` build script. Cargo recorded `link.exe` exit code 1 without linker diagnostics and suggested repairing Visual Studio, but VS 2022 reported a complete MSVC x64 workload and Windows SDK, and an independent Rust link smoke test succeeded.

Resolution:

- Do not attribute this summary error to `serde_core` itself.
- Confirm the MSVC workload, Windows SDK, disk space, and a minimal Rust link before repairing Visual Studio.
- Retry the same isolated target with `CARGO_BUILD_JOBS=1`; the complete Tauri release subsequently built successfully, confirming the original failure was transient rather than a missing toolchain component.

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

### TUI switching must preserve terminal-emulator state

Claude Code and k9s could render with displaced input or screen regions after switching away from their terminal and back. Resizing the application repaired the display because xterm.js then performed a fit and repaint. The deeper issue was that routine tab and workspace switches disposed the current xterm.js instance and tried to reconstruct a stateful TUI from the Rust byte snapshot. Alternate-screen, cursor, and incremental redraw state should remain in the emulator that received it.

The durable fix is:

- Keep every terminal's xterm.js instance mounted while its definition remains in the layout, including across workspace switches.
- Hide inactive terminal and workspace layers with CSS visibility while retaining measurable layout dimensions.
- On reveal, run `FitAddon.fit()`, refresh the complete visible row range, and focus only the newly visible terminal.
- Keep Rust snapshot replay for genuine attachment and recovery, not as the normal mechanism for switching views.
- Avoid reconnecting merely because the stored runtime snapshot object changed.

### External launchers need typed arguments and separate path semantics

File managers, CLI editor shims, native IDE executables, WSL-aware editors, and Unity do not share one safe command-line shape. Treating launcher configuration as a raw command string would introduce quoting ambiguity and shell injection risk, while treating Windows and WSL paths as interchangeable would open the wrong location.

Resolution:

- Store the executable and every argument as separate values and expand only an allowlisted placeholder set.
- Require at least one path-bearing placeholder and validate file extensions before a profile can become active.
- Resolve WSL-aware arguments separately from generic Windows UNC paths, without silently falling back to the WSL home directory.
- Resolve Unity projects and their exact editor version before process creation.
- Consider only successful detached process creation part of Turtorge's responsibility; external application lifecycle remains outside the terminal registry.

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

The external-launcher and full terminal-edit follow-up additionally passed:

- Frontend Vitest suite: 34/34 tests, including launcher settings, first-use setup, pane launching, launcher-only edits, and running-terminal restart decisions
- TypeScript application compilation and Vite production build
- Rust default suite: 18 passed, 1 real-WSL integration test ignored by default
- Rust formatting and Clippy with `-D warnings`
- Browser QA at 1280×720 for the pane action strip, launcher setup, settings preset grid, cloned profile editor, and full Edit Terminal dialog; the console remained free of warnings and errors
- Tauri CLI `--no-bundle` production build succeeded at `target/codex-launcher-verification/release/turtorge.exe`
- Native acceptance that opens each available external application remains pending because launching user applications was intentionally not included in automated or browser QA

The date-stamped standalone build helper additionally passed:

- Locked pnpm dependency synchronization in a non-interactive invocation
- Tauri CLI `--no-bundle` production build at `artifacts/2026-08-04_15-56-54_096/release/turtorge.exe`
- SHA-256 `F5BD1012796F8B94A5D9B657FD41DB705C288B07890AF2E5AA08F80A11559A48`
- Confirmation that the actively running standard executable retained its prior timestamp and SHA-256

The persistent TUI-rendering follow-up additionally passed:

- Frontend Vitest suite: 37/37 tests, including persistent xterm instances across terminal and workspace switches, reveal-time refresh/focus, and hidden-terminal output handling
- TypeScript application compilation and Vite production build
- Rust default suite: 18 passed, 1 real-WSL integration test ignored by default
- Opt-in real WSL PTY integration test: 1/1 passed
- Rust Clippy with `-D warnings`
- Tauri CLI `--no-bundle` production build at `artifacts/2026-08-04_23-12-18_596/release/turtorge.exe`, SHA-256 `383A6AC5AE63867F29E75542AFC1A7F52DEC8223EC6A659131F3B62BBF0DF10B`
- Native Claude Code and k9s switch-away/switch-back acceptance remains pending because interactive terminal applications are not automated

The context-menu interaction follow-up additionally passed:

- Frontend Vitest suite: 42/42 tests, including menu keyboard navigation and focus restoration, terminal force restart, confirmed deletion, and updated pane/sidebar interaction coverage
- TypeScript application compilation and Vite production build
- Browser QA at 1280×720 for terminal, workspace, and pane menus; the menu measured 248 px wide with 30 px rows, `Delete Terminal` remained on one line, the right edge stayed 6 px inside the viewport, xterm right-click remained native, and the console contained no warnings or errors
- Tauri CLI `--no-bundle` production build at `artifacts/2026-08-05_00-41-03_056/release/turtorge.exe`, recovered from one transient silent MSVC linker failure by retrying the same isolated target with one Cargo job; SHA-256 `C511FD412791A214412FBEF3CEDDA379D8B6157D9957F3278ED533A4E206AB4F`

The production frontend currently emits a non-blocking warning that the main JavaScript chunk is larger than 500 kB. Code splitting is a future optimization, not an MVP blocker.

The 2026-08-08 documentation and macOS handoff audit additionally confirmed:

- The implementation baseline before the documentation update was `db18dac` on `develop` with a clean worktree.
- Frontend Vitest remained 42/42, the Rust default suite remained 18 passed with 1 Windows/WSL integration test ignored, and TypeScript project compilation succeeded.
- The current path and shell enums expose only Windows/WSL and PowerShell/WSL variants; native macOS workspace creation and terminal startup therefore require domain and IPC changes, not only a new build target.
- Frontend bootstrap copy, environment selection, window controls, and shortcuts remain Windows-oriented.
- External-launcher discovery, validation, and detached process creation remain Windows-oriented; Finder and macOS application launching are not implemented.
- User workspace and settings JSON live in the platform application-data directory and are not transferred by Git. `.turtorge.yml` import/export and cross-platform migration remain deferred.
- The repository pins pnpm 11.9.0 but not Node.js, Rust, or Xcode versions. Tool activation and dependency-install failures must be distinguished from application test failures in future handoffs.
- `docs/MACOS_HANDOFF.md` now defines the evidence to record, the scope decision required before implementation, and the existing non-negotiable product boundaries.

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

The 2026-08-01 external-launcher implementation was delivered in staged commits:

```text
70a364c feat: add external launcher core
0db75cc feat: add launcher profile settings
0aee6e5 feat: integrate launchers into terminal workflows
```

The final verified executable is `target/codex-launcher-verification/release/turtorge.exe`, SHA-256 `BF77E49FF25DC611F588FC535E82008163B0A85FA8A0BB160D414862EF367402`. The standard release executable was intentionally not replaced.

The root `build-latest.bat` script synchronizes locked pnpm dependencies, then builds the current source with the Tauri CLI and `--no-bundle`. Every invocation assigns an isolated `artifacts/YYYY-MM-DD_HH-mm-ss_fff` Cargo target directory, so an active standard release or earlier dated build is never overwritten. The resulting standalone executable is under that directory's `release` folder.

The 2026-08-04 persistent TUI-rendering fix was built at `artifacts/2026-08-04_23-12-18_596/release/turtorge.exe`. Its SHA-256 is `383A6AC5AE63867F29E75542AFC1A7F52DEC8223EC6A659131F3B62BBF0DF10B`; native Claude Code and k9s acceptance remains pending.

## 8. Deferred scope

The following work was deliberately excluded from this MVP:

- Installer packaging, signing, and auto-update
- macOS and Linux native builds
- `.turtorge.yml` manifest import/export and repository trust flow
- Tags, groups, and the full workspace management surface
- Settings areas beyond the implemented appearance and launcher-profile controls
- Secure secret storage
- Diagnostic export archive
- Git Bash, SSH, container, and remote adapters
- Bundle code splitting and performance tuning beyond the MVP target
- Keyboard commands for moving terminal tabs and cross-workspace tab drag-and-drop
- Command-palette or keyboard-shortcut access to external launchers

These are future phases, not incomplete items from the approved Windows MVP.

## 9. Continuation guidance

Before beginning the next phase:

1. Read this file and `MVP_IMPLEMENTATION.md`.
2. Treat the confirmed external-launcher work as a post-MVP optimization; confirm unrelated scope expansions with the user.
3. Preserve Rust ownership of PTY/process/storage responsibilities.
4. Preserve in-app terminal tabs and layouts; do not open external console windows.
5. Keep terminal content out of persistent logs and storage.
6. Run the default test matrix and the opt-in real WSL PTY test after terminal-layer changes.
7. Update this history when a phase is completed or a major architectural decision changes.
