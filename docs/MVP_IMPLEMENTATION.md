# MVP Implementation Record

Status: implemented and locally verified on Windows  
Scope: Windows 10/11 MVP

This record captures the product choices confirmed after reviewing `PRD.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, and `ROADMAP.md`.

## Product decisions

- Every terminal stays inside the Turtorge window. Turtorge owns all tabs, labels, panes, and split layout.
- The application uses a custom borderless title bar.
- A workspace stores configuration and layout, not terminal sessions or disk scrollback.
- Initial terminal creation starts immediately but persists `autoStart: false`; auto-start happens only when explicitly enabled.
- Switching workspaces keeps managed processes alive. Quitting terminates all managed processes after one confirmation.
- Closing a running terminal asks for confirmation, with a session-only suppression option.
- Multi-line paste requires confirmation.
- Environment variables are stored as plaintext for this MVP and are explicitly labelled as such.
- Claude Code and Codex use the same terminal-profile model as regular shells.

## Shell and environment decisions

- PowerShell defaults to the highest detected installed version while keeping every detected version selectable.
- Selecting WSL first discovers user distributions and hides Docker-managed distributions.
- Selecting a distribution starts it when needed and detects only supported bash/zsh executables.
- Shell priority is the distribution's configured login shell, then zsh, then bash.
- If the selected shell or working directory is unavailable, startup fails visibly; it never silently falls back.
- WSL shells run as the distribution's default user with real interactive login-shell semantics.
- `~` is resolved to the selected distribution default user's home before `wsl.exe --cd` is invoked.

## Runtime and privacy decisions

- Rust owns PTY handles, process handles, input writers, resize, exit status, and process cleanup.
- Tauri Channels carry live byte chunks directly to the matching xterm instance.
- A bounded 1 MiB byte ring is kept per running terminal only for in-memory reattachment.
- No terminal input, output, or scrollback is written to disk.
- Diagnostics may contain runtime IDs, durations, status, and error codes, but never terminal content or environment-variable values.
- Windows ConPTY startup performs the initial cursor-status handshake before interactive PowerShell/WSL output is attached. This prevents the child shell from stalling during the IPC startup window.

## Implemented UI surface

- Empty state and single-page Create Workspace flow.
- Workspace sidebar, quick open, settings, status bar, and workspace header.
- Terminal tabs, add terminal, close, restart, split right/down, and draggable split ratios.
- Shell/Claude Code/Codex/custom profiles, startup command, environment editor, and auto-start control.
- Responsive layout at the required 900×600 minimum size.
- English UI copy with system, light, and dark theme preferences.

## Deferred from this delivery

- `.turtorge.yml` import/export and repository trust workflow.
- Tags, groups, full workspace CRUD affordances, and full settings matrix.
- Installer, signing, auto-update, and release pipeline.
- Git Bash, SSH, containers, macOS, and Linux native adapters.
- Secure secret storage and diagnostic export archive.

The module boundaries preserve room for those additions without moving PTY or process ownership into React.
