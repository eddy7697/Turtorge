# Turtorge Development History

Last updated: 2026-07-29  
Current stage: Windows MVP completed

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
- Windows, UNC, WSL-mounted, and WSL-native paths are supported through typed path models.
- Switching workspaces keeps Rust-managed terminal processes alive.
- Quitting Turtorge terminates all managed processes after one confirmation.
- Initial terminal creation starts immediately but persists `autoStart: false` unless explicitly enabled.
- Terminal input, output, and scrollback are not written to disk.
- A bounded in-memory scrollback is retained only while a process is running.
- Multi-line paste requires confirmation.
- Closing a running terminal requires confirmation, with session-only suppression.
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

The source logo was not altered. `images/app-icon.png` and the Tauri platform icons were generated as deterministic transparent crops of the supplied artwork.

## 4. Implementation phase

### Frontend

- React 19 and TypeScript
- Vite 8
- Zustand application state
- xterm.js 6
- Fit and web-links addons
- Application-controlled terminal tabs
- Nested horizontal and vertical split tree
- Draggable split ratios
- Workspace sidebar and quick open
- Create Workspace and New Terminal flows
- Settings, light/dark/system theme selection, and responsive dialogs
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
- WSL distribution discovery and Docker-distribution filtering
- Per-distribution bash/zsh detection
- WSL home-directory and working-directory resolution
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

The release was verified without a running Vite server, then closed without leaving a Turtorge process running.

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
