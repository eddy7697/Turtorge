# Turtorge Development History

Last updated: 2026-08-15
Current stage: Terminal mouse selection now copies text directly to the system clipboard across profiles; Windows production build and terminal regression verification pass, while the previously recorded Clippy dead-code failure remains

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
- Unity launching is supported from Windows and native macOS paths, requires both `Assets` and `ProjectSettings`, reads the required editor version from `ProjectVersion.txt`, and stops with an actionable error if that exact installed version cannot be found. Direct WSL project launching remains unsupported.
- Externally launched file managers and editors are detached from Turtorge: they are not treated as terminal processes, counted in running badges, or terminated on application exit.
- Finder has the same built-in file-manager role on macOS that File Explorer has on Windows and opens a terminal's saved directory through `/usr/bin/open {path}`.
- Native macOS is implemented as a shared-codebase extension of the Windows product. The supported Mac target is Apple Silicon on macOS 12 or newer; Intel/x86 artifacts and acceptance are excluded.
- The macOS feature target preserves the implemented Windows application surface while translating platform semantics: native zsh, bash, fish, and custom shells; Finder and macOS launchers; native traffic lights and Command/Option shortcuts; and a single restorable application window whose close action keeps managed terminals alive while Command+Q confirms termination.
- macOS uses independent platform application-data settings. Existing Windows JSON remains backward compatible, but automatic Windows-to-Mac migration and `.turtorge.yml` portability remain deferred.
- The current macOS release target is version 0.2.2 with Apple Silicon `.app` and `.dmg` artifacts. Ad-hoc signing is the available local delivery gate; Developer ID signing and notarization must be wired for credentialed execution without storing credentials in the repository.
- A saved macOS working directory that disappears may fall back to the user's home only with a visible terminal notice. Newly selected invalid directories and missing configured shells fail visibly without silent substitution.
- `DEVELOPMENT_HISTORY.md` and `MVP_IMPLEMENTATION.md` govern confirmed implementation state. `PRD.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, and `ROADMAP.md` preserve draft vision and future direction where they describe capabilities outside that state.
- Edit Terminal now owns the full terminal definition. Label and launcher changes apply immediately; shell, working directory, startup command, environment, and auto-start changes apply on the next start. A running terminal receives an explicit Restart Now or Later choice when process configuration changes. Tab double-click remains the quick-rename path.
- Terminal tabs and sidebar terminal entries use the same custom context menu for launcher access, start or confirmed force restart, rename, full editing, and confirmed deletion. Right-clicking does not change the active workspace or terminal; actions target the item that opened the menu.
- The visible tab-close, pane-edit, and pane-delete buttons are removed. The high-frequency external-launcher button remains visible, while pane creation, splitting, and deletion move to the pane action-area context menu; native xterm right-click behavior remains untouched.
- Workspace context menus provide New Terminal and Rename Workspace. Creating a terminal from an inactive workspace first activates that workspace and inserts the terminal into its first pane. Workspace names are trimmed, limited to 80 characters, and may duplicate existing names.
- Context menus are theme-aware, keyboard accessible through Shift+F10 or the Menu key, and use a 248 px width with 30 px single-line rows. Empty-pane deletion is immediate, non-empty pane deletion is confirmed, and the final pane remains protected.
- Duplicate Terminal is a one-click tab/sidebar context action on both platforms. It copies the saved terminal-owned configuration into a new independent definition, inserts and selects it immediately after the source in the same pane, switches to an inactive source workspace when needed, and starts a fresh PTY without copying live process, screen, scrollback, or live-cwd state.
- Duplicate names use `Copy`, `Copy 2`, and subsequent case-insensitive collision-free suffixes within the 80-character label limit. Orphan definitions cannot be duplicated, persistence is completed before activation/start, and a failed save leaves no partial definition or runtime request.
- Release bundles must explicitly reference the generated turtle `.icns` and `.ico`; merely keeping icon files in the Tauri icon directory is not sufficient evidence that macOS embeds or displays them.
- Terminal renderer padding is platform-specific. Windows keeps the established spacing on the xterm host so the renderer itself has no visible frame; macOS keeps the padding on `.xterm` so FitAddon includes it in row calculations and avoids bottom clipping.
- Completing a mouse selection in any terminal copies the selected text directly to the system clipboard. This behavior belongs to the shared xterm layer rather than the Claude Code profile because AI tools may also be launched from ordinary shell terminals. Turtorge requests clipboard text-write permission only and does not read clipboard contents for this behavior.

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
- Cross-profile copy-on-select through xterm's completed-selection event and the native system clipboard
- Shared custom context menus for terminal tabs, sidebar terminals, workspaces, and pane action areas, with viewport clamping, disabled-state explanations, keyboard navigation, and Escape focus restoration
- Cross-platform Duplicate Terminal action with saved-setting snapshots, adjacent insertion, fresh runtime startup, deterministic Copy naming, orphan protection, and visible persistence failures
- Context-targeted rename and full editor flows, confirmed terminal deletion, and confirmed force restart through a freshly attached PTY
- Workspace rename dialog and context-targeted New Terminal flow for active or inactive workspaces
- Platform-aware Create Workspace, New Terminal, Edit Terminal, Settings, launcher, title-bar, and shortcut flows for native macOS shells and paths
- Native traffic-light spacing and Command shortcut labels without rendering the Windows minimize/maximize/close controls on macOS
- Close-to-hide, Dock-reopen, and confirmed Command+Q application lifecycle integration

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
- Native macOS zsh/bash/fish discovery, exact custom-shell validation, GUI login-PATH discovery, native path expansion, and missing-saved-cwd fallback notices
- Unix PTY command construction for interactive/login native shells with the Windows ConPTY cursor handshake kept Windows-only
- Finder and macOS `.app` discovery and detached launching, including exact Unity Hub editor-version resolution
- Platform bootstrap data and macOS close, reopen, quit, and managed-process termination event handling
- Native clipboard plugin registration with least-privilege text-write capability

### Branding and release assets

- Original logo retained at `images/logo.png`
- Application icon generated at `images/app-icon.png`
- Windows, macOS, iOS, and Android Tauri icon assets generated for future packaging compatibility
- Apple Silicon macOS 0.2.2 configuration with native title-bar overlay, macOS 12 deployment target, explicit `.icns` bundling, ad-hoc signing, and `.app`/`.dmg` release output
- Root macOS release helper with isolated artifacts and optional Developer ID signing/notarization driven only by external credentials

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

### macOS GUI applications need login-shell PATH discovery

A Tauri application launched from Finder or the Dock does not inherit the interactive shell PATH. Relying only on the GUI process environment would make Homebrew-installed launchers and AI command-line tools appear unavailable.

Resolution:

- Read the configured macOS login shell and ask it for its login PATH without persisting the result.
- Merge those directories into launcher discovery while continuing to pass native terminal startup through an interactive login shell.
- Keep missing configured shell executables visible instead of silently substituting zsh or bash.

### Finder is a LaunchServices operation, not an executable rename

Replacing `explorer.exe` with `Finder.app` would not preserve the existing launcher contract. A terminal launcher targets a directory, while Finder application activation alone does not identify that directory.

Resolution:

- Model Finder as the built-in `/usr/bin/open` launcher with `{path}` as a separate argument.
- Reserve `open -R` for a future reveal-file action; terminal working directories use plain `open {path}`.
- Treat `.app` bundles as trusted program targets and launch them through `open -a`, while native executable launchers remain direct detached processes.

### Non-interactive DMG builds cannot depend on Finder scripting

The Tauri `.app` bundle completed successfully, but its generated DMG helper stalled and failed while asking Finder to arrange icons through AppleScript. The application, signature, and disk-image tooling were otherwise healthy.

Resolution:

- Build the `.app` through the Tauri CLI and construct the DMG from a staging directory with `hdiutil`.
- Include the application and an `/Applications` symbolic link without relying on Finder cosmetic automation.
- Verify the app signature and DMG checksum on every release-helper invocation.
- Keep Developer ID signing and `notarytool` submission conditional on complete external credential sets.

### A Rust target alone is not a Windows Tauri build environment

Adding `x86_64-pc-windows-msvc` to rustup on macOS allowed dependency compilation to begin, but Tauri's Windows resource build correctly stopped because the host has no `llvm-rc`/Windows SDK resource toolchain. This is an environment boundary, not a Turtorge source failure.

Resolution:

- Do not describe a macOS cross-check as Windows native verification.
- Run the Windows frontend, Rust, lint, and Tauri production-build gate on `windows-latest` through the checked-in GitHub Actions workflow.
- Keep the macOS release target Apple Silicon-only and avoid installing an unrelated cross-compilation stack solely to imitate the Windows runner.

### Tauri icon assets are not macOS bundle declarations

The repository already contained a complete `icon.icns`, but every retained 0.2.0 `.app` lacked `Contents/Resources`, `CFBundleIconFile`, and sealed icon resources. Tauri did not infer a macOS bundle icon merely because the generated file existed under `src-tauri/icons`.

Resolution:

- Declare the generated desktop PNG, `.icns`, and `.ico` files explicitly through `bundle.icon` in the shared Tauri configuration.
- Keep the original horizontal `images/logo.png` unchanged and use the existing square transparent turtle crop as the icon source.
- Inspect the built `.app`, `Info.plist`, signed resource set, and read-only mounted DMG rather than treating source asset presence as delivery evidence.
- Ask AppKit `NSWorkspace` to resolve the built application icon so the Finder/Dock-facing system result is verified without launching a second application instance against live workspace data.

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

The Apple Silicon macOS 0.2.0 implementation additionally passed:

- Frontend Vitest: 44/44 tests, including native terminal creation and macOS title-bar behavior
- Rust default suite: 22 passed with the real native-shell PTY test ignored by default
- Opt-in real native zsh and bash PTY integration test, including login environment, input/output, and clean exit
- Rust formatting and Clippy with `-D warnings`
- TypeScript compilation and Vite production build
- Apple Silicon Tauri `.app` production build with macOS 12 as the minimum system version and an ad-hoc signature that passes `codesign --verify --deep --strict`
- Isolated `.dmg` creation, checksum verification, read-only mount, signed application validation, and `/Applications` link validation
- LaunchServices startup as a foreground application with the main arm64 process and WebView helper processes running without crash or fault logs
- Local macOS-mode UI acceptance for Command shortcut labels, native title-bar spacing, workspace creation, native/custom shell fields, Finder selection, `.app` launcher editing, and terminal startup; the browser console remained free of warnings and errors
- A Windows GitHub Actions regression gate covering frontend tests/build, Rust format/test/Clippy, and a Tauri Windows production build; execution begins after the changes are pushed

The macOS terminal-input compatibility follow-up additionally passed:

- A deterministic regression reproduced the Finder/GUI launch condition in which the native child command inherited `TERM=dumb` instead of the xterm-compatible capabilities rendered by Turtorge
- Native macOS child processes now receive application-owned `TERM=xterm-256color`, `COLORTERM=truecolor`, `TERM_PROGRAM=Turtorge`, and the current package version after user environment merging
- Frontend byte-preservation coverage for Up, Down, Backspace/Delete, and forward Delete control sequences
- Frontend Vitest: 45/45 tests
- Rust default suite: 23 passed with 2 real native-shell PTY tests ignored by default
- Opt-in real zsh PTY coverage for previous/next history navigation, Backspace/Delete, forward Delete, cursor movement, login environment, input/output, and clean exit
- Rust formatting and Clippy with `-D warnings`, TypeScript compilation, Vite production build, ad-hoc application signature verification, and DMG checksum verification

Reusable lesson: a macOS application launched through Finder or LaunchServices does not have a trustworthy terminal environment. PTY hosts must advertise the capabilities of their own renderer explicitly instead of inheriting `TERM` or allowing workspace variables to replace it. Existing terminals must be restarted before a corrected child environment takes effect.

The macOS force-restart and native-title-bar alignment follow-up additionally passed:

- A real `TerminalManager` regression reproduced Force Restart writing `exit\r` into the PTY, where it appeared as terminal output instead of being a process-lifecycle operation
- Terminal close now signals the managed child directly, waits up to two seconds for the waiter to confirm exit, reports a visible termination failure on timeout, and never injects a shell command
- A foreground-process regression confirms that close returns only after the old process stops producing output
- A new runtime generation resets the retained xterm emulator, clears stale runtime and queued-input references, and starts with a fresh screen instead of stacking new output over the prior process
- Native screenshot measurement found the macOS traffic lights approximately five logical pixels above the 40 px custom title-bar center; the overlay inset changed from `y: 13` to `y: 18` and a newly built bundle was visually reaccepted at the centered position
- Frontend Vitest: 47/47 tests; Rust default suite: 23 passed with 4 real native PTY/process tests ignored by default; all 4 opt-in tests passed when explicitly enabled
- Rust formatting and Clippy with `-D warnings`, TypeScript compilation, Vite production build, ad-hoc application signature verification, and DMG checksum verification

Reusable lesson: terminal shutdown is a process-control operation and must never be simulated by writing commands to the PTY. A forced restart also changes emulator identity even when the saved terminal definition is unchanged, so the runtime generation owns xterm reset and pending-input cleanup.

The Duplicate Terminal and application-icon follow-up additionally passed:

- TDD red/green coverage at the agreed layout, app-store, and shared-action-menu seams
- Frontend Vitest: 56/56 tests, including adjacent insertion, active selection, orphan detection, full terminal-owned configuration copying, independent IDs, case-insensitive Copy numbering, the 80-character label limit, inactive-workspace activation, persistence failure atomicity, shared-menu invocation, disabled explanations, and readable failure UI
- Browser-mode acceptance with isolated mock data: `Codex Copy` and `Codex Copy 2` appeared immediately after their sources, became selected/running, synchronized to the sidebar, and produced no console warnings or errors
- TypeScript compilation and Vite production build; the known non-blocking chunk-size warning remains
- Rust formatting, 23 default tests, all 4 opt-in real native PTY/process tests, and Clippy with warnings denied
- Apple Silicon 0.2.1 `.app` production build with macOS 12 minimum version, arm64 executable, and strict ad-hoc signature verification
- Explicit signed `Contents/Resources/icon.icns` plus `CFBundleIconFile=icon.icns`; AppKit `NSWorkspace` resolved the built application to the turtle artwork used by Finder and Dock surfaces
- Read-only 0.2.1 DMG mount with the same signed application/icon and the `/Applications` drop-link, followed by clean unmount

Reusable lesson: terminal duplication is definition cloning, not runtime cloning. Resolve the latest stored workspace at action time, assign a new definition ID, persist the definition and layout atomically, then request a fresh runtime only after persistence succeeds.

The terminal-bottom clipping follow-up additionally passed:

- A deterministic browser geometry reproduction showed xterm text layers extending up to 7 px beyond their own fitted element and reaching the clipped terminal-surface edge
- FitAddon was confirmed to measure the host height but subtract padding only from the `.xterm` element; padding on `.xterm-host` therefore inflated the proposed row count
- The unchanged `8px 9px 6px` terminal padding now lives on `.xterm`, preserving the intended visual inset while making it part of FitAddon's row calculation
- Browser acceptance at 1024×640, 1280×720, and 1440×900, including vertically split panes, retained positive bottom clearance and produced no console warnings or errors
- Frontend Vitest remained 56/56; TypeScript/Vite production build, Rust formatting, 23 default tests, all 4 opt-in real native PTY/process tests, and Clippy with warnings denied passed
- Apple Silicon 0.2.2 `.app` and `.dmg` passed arm64, version, strict ad-hoc signature, bundled-icon, checksum, read-only mount, and `/Applications` drop-link verification

Reusable lesson: xterm FitAddon derives available rows from the parent height and the terminal element's own padding. Visual padding outside `.xterm` is invisible to its sizing algorithm and can place the final rendered row on or beyond a clipped boundary.

The 2026-08-12 native Windows regression verification of the macOS 0.2.2 source at `c767dd5` confirmed:

- Locked dependency synchronization completed with pnpm 11.9.0, and the pinned Rust 1.97.1 MSVC toolchain was active. The local Node.js version was 22.13.1 rather than the repository-pinned 22.16.0.
- Frontend Vitest passed 56/56 tests, and the TypeScript/Vite production build completed with only the known non-blocking chunk-size warning.
- Rust formatting passed. The default Rust suite passed 19 tests with the real WSL test ignored by default, and the opt-in real PowerShell/WSL ConPTY round trip passed 1/1.
- The Tauri CLI `--no-bundle` production build succeeded through `build-latest.bat` and produced an isolated standalone Windows executable.
- The Windows Clippy gate with `-D warnings` failed because `platform::login_shell_path_entries` is compiled but unused on Windows while its launcher caller is `cfg(not(windows))`. This is the only observed source-level regression; it does not prevent the tested Windows executable from compiling.
- Tauri also emitted its existing non-blocking warning that bundle identifier `dev.turtorge.app` ends in `.app`. Native GUI startup acceptance was not part of this compile-focused verification.

The 2026-08-13 Windows terminal-frame follow-up additionally passed:

- Terminal padding moved back to `.xterm-host` for Windows, restoring the pre-macOS-fix layout, while `.platform-macos` keeps the FitAddon-aware padding on `.xterm`.
- Two CSS contract regressions cover the Windows and macOS selector split; the complete frontend suite passed 58/58 tests.
- TypeScript compilation and the Vite production build passed with only the known non-blocking chunk-size warning.
- Browser-mode Windows acceptance confirmed `platform-windows`, `8px 9px 6px` host padding, `0px` xterm padding, no visible extra black frame, and no console warnings or errors.
- An isolated Windows Tauri CLI `--no-bundle` production build completed successfully. Native macOS rendering was not reverified on the Windows host; its required selector and padding remain protected by the regression test.

The 2026-08-15 terminal copy-on-select follow-up additionally passed:

- A red/green xterm regression proving that a completed selection writes the exact selected text to the system clipboard
- Frontend Vitest: 59/59 tests
- TypeScript compilation and Vite production build, with only the known non-blocking chunk-size warning
- Rust formatting, 19 default tests, and the opt-in real PowerShell/WSL ConPTY round trip
- Tauri capability generation and a Windows CLI `--no-bundle` production build with the official clipboard plugin and only `clipboard-manager:allow-write-text`
- Windows Clippy still fails only on the previously recorded unused macOS login-PATH helper; this follow-up introduced no additional warning
- Automated native mouse dragging was not performed because the available Windows UI automation policy excludes terminal applications

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

The previous verified Apple Silicon macOS 0.2.0 artifacts remain at `artifacts/2026-08-08_06-10-31/release/bundle/macos/Turtorge.app` and `artifacts/2026-08-08_06-10-31/release/bundle/dmg/Turtorge_0.2.0_aarch64.dmg` as the terminal-capability, Force Restart, fresh-emulator, and centered-traffic-light baseline.

The verified Apple Silicon macOS 0.2.1 artifacts remain at `artifacts/2026-08-09_11-18-17/release/bundle/macos/Turtorge.app` and `artifacts/2026-08-09_11-18-17/release/bundle/dmg/Turtorge_0.2.1_aarch64.dmg` as the Duplicate Terminal and correctly bundled application-icon baseline.

The current verified Apple Silicon macOS 0.2.2 artifacts are `artifacts/2026-08-10_00-27-07/release/bundle/macos/Turtorge.app` and `artifacts/2026-08-10_00-27-07/release/bundle/dmg/Turtorge_0.2.2_aarch64.dmg`. They add the terminal-bottom clipping fix while retaining the complete 0.2.1 feature set. The DMG SHA-256 is `0de50dd21efb9cf9f85368e84e97d2f84c98c22b488568b7ef04daed5262dbe1`; the bundled arm64 executable SHA-256 is `4cfe21927977ffd7c66f73175824f0a58ffaa6afeb7734c2d31929b277e51b74`; and the bundled `icon.icns` SHA-256 is `b756c6d9eb907437589457dad65b7dea2d741993bd3fea2a5a3f61365dd08418`. The current machine has no Developer ID identity or complete Xcode installation, so these artifacts are ad-hoc signed. The same helper accepts externally supplied signing and notarization credentials without committing secrets.

The Windows verification of the same 0.2.2 source produced `artifacts/2026-08-12_06-35-30_874/release/turtorge.exe`, size 5,182,976 bytes, SHA-256 `F6919B2B2DF542E8962E49F098C996B84D8CCFD07E8BAB0505BDD503F1EDF66F`. The executable compiled successfully through the Tauri CLI with embedded production frontend assets; the Windows regression workflow remains red locally at its stricter Clippy step until the macOS-only login-PATH helper is target-gated.

The Windows terminal-frame follow-up produced `artifacts/2026-08-13_08-31-12_203/release/turtorge.exe`, size 5,182,976 bytes, SHA-256 `3730C10106EA2E017BF0FCF14303822F9CCBFF7755AF690331492932FC8A7138`. It embeds the platform-specific terminal padding and supersedes the previous local Windows verification artifact for this source tree.

The Windows terminal copy-on-select follow-up produced `artifacts/2026-08-16_02-34-47_405/release/turtorge.exe`, size 5,416,448 bytes, SHA-256 `DFD1ACECCC7592D4529ED906EFC2AA5B608C57F4035BFA9EDF12D8E7F0BA1058`. It embeds native clipboard text-write support without replacing the standard release executable.

## 8. Deferred scope

The following work was deliberately excluded from this MVP:

- Windows installer packaging and signing, macOS Developer ID credentials, and auto-update
- Linux native builds
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
6. Run the default test matrix and the platform-appropriate opt-in real WSL or native macOS PTY test after terminal-layer changes.
7. Update this history when a phase is completed or a major architectural decision changes.
