# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required reading first

`AGENTS.md` requires reading `docs/DEVELOPMENT_HISTORY.md` in full before planning, implementing, reviewing, or testing. It is the authoritative record of confirmed requirements, architecture decisions, resolved failures (section 5, "Important engineering discoveries"), verification state, and deferred scope. Update it when a phase completes, a confirmed requirement changes, a major decision is made, or a significant failure yields a reusable lesson. Never store secrets, terminal content, env-var values, or machine identifiers in it.

Other docs: `MVP_IMPLEMENTATION.md` (confirmed MVP decisions), `MACOS_HANDOFF.md` (native macOS record). `PRD.md`, `ARCHITECTURE.md`, `UI_SPEC.md`, `ROADMAP.md` are original drafts; some proposed modules were never adopted, so the history wins over them.

## Non-negotiable boundaries

- All terminals stay embedded in the Turtorge layout; never open external console windows.
- Turtorge (React) owns tabs, labels, panes, and nested splits.
- Rust owns PTYs, child processes, storage, and lifecycle.
- Terminal input, output, and scrollback are never persisted to disk (in-memory scrollback is capped at 1 MiB per running terminal).
- Shell and working-directory failures must remain visible. No silent fallback to another shell or directory.
- The completed Windows MVP and its deferred scope (history section 8) are not redefined without explicit user approval.

## Commands

Toolchain is pinned: Node 22.16.0 (`.node-version`), pnpm 11.9.0 (`packageManager`), Rust 1.97.1 (`rust-toolchain.toml`). Root `package.json` scripts proxy to `apps/desktop`.

```sh
pnpm install --frozen-lockfile
pnpm tauri:dev        # full native app (real PTYs, dialogs, launchers, window behavior)
pnpm dev              # frontend-only at :1420 with in-memory mock API; add ?demo for seeded data
pnpm test             # vitest run (frontend)
pnpm --dir apps/desktop test:watch
pnpm --dir apps/desktop exec vitest run src/lib/layout.test.ts   # single test file
pnpm --dir apps/desktop exec vitest run -t "name pattern"        # single test by name
pnpm build            # tsc -b && vite build (type-checks the frontend)

cargo test   --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo test   --manifest-path apps/desktop/src-tauri/Cargo.toml <test_name>
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo fmt    --manifest-path apps/desktop/src-tauri/Cargo.toml --all -- --check
```

CI (`.github/workflows/windows-regression.yml`, `windows-latest`) runs exactly: `pnpm test`, `pnpm build`, `cargo fmt --check`, `cargo test`, `cargo clippy -D warnings`, `pnpm tauri:build --no-bundle`. Run that set locally before claiming work is verified.

Opt-in real-PTY integration tests (need locally installed shells; run after any terminal-layer change):

```sh
# Windows: PowerShell + WSL bash/zsh through real ConPTY
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml real_wsl_login_shells_round_trip_through_a_pty -- --ignored --nocapture
# macOS: native zsh/bash/fish
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml real_native_login_shells_round_trip_through_a_pty -- --ignored --nocapture
```

Release builds: `build-latest.bat` (Windows, `tauri build --no-bundle`) and `build-latest-macos.sh` (Apple Silicon only, `.app` + `hdiutil` DMG). Both use a timestamped `CARGO_TARGET_DIR` under `artifacts/` so a running exe is never overwritten. The Windows deliverable is three files in one folder: `turtorge.exe` plus `conpty.dll` and `OpenConsole.exe`, which `src-tauri/build.rs` stages from `src-tauri/vendor/conpty/win-x64` (see its README for provenance and how to update). Without them the exe silently uses the Windows-inbox ConPTY, which corrupts full-width TUI redraws (k9s, Claude Code, Codex); `build-latest.bat` fails if either file is missing and startup logs which host is active. Never ship a bare `cargo build --release`: it skips Tauri CLI production config and the binary may still point at the Vite dev server. The macOS-only window/bundle overrides live in `tauri.macos.conf.json` (native traffic lights, `bundle.active: true`); the shared `tauri.conf.json` has `decorations: false` for the Windows custom title bar and `bundle.active: false`.

## Architecture

Single pnpm workspace package `apps/desktop` (`@turtorge/desktop`): React 19 + TypeScript + Vite + Zustand frontend, Tauri v2 + Rust 2024 backend, xterm.js 6 for rendering, `portable-pty` over ConPTY/Unix PTYs.

### Two-process boundary and IPC contract

- `src-tauri/src/lib.rs` registers every command in `generate_handler!`; `commands.rs` are thin wrappers over `AppState { repository: Repository, terminals: TerminalManager }`.
- `src/lib/api.ts` is the only frontend module that calls `invoke`. Every exported function branches on `isTauri()` and falls back to an in-memory mock (workspaces, runtimes, scrollback, settings) so `pnpm dev` and jsdom tests run without Rust. Add a mock branch whenever you add a command.
- `src-tauri/src/models.rs` and `src/types.ts` are the two halves of the wire contract and must stay in sync. Every Rust struct/enum uses `#[serde(rename_all = "camelCase")]`; internally tagged enums (`LayoutNode`, `TerminalEvent`) also need `rename_all_fields = "camelCase"`, which was the cause of a past production bug. Errors cross as `{ code, message }` (`error.rs` -> `ApiError`).
- Rust -> frontend: only one Tauri event exists, `turtorge://quit-requested` (macOS Cmd+Q interception). Terminal output does not use events; it uses `Channel`.

### Terminal lifecycle (the hard part)

Two identities per terminal: a persisted `TerminalDefinition.id` (in the workspace JSON) and a runtime id (a live PTY in `TerminalManager`). `terminal_start` creates a PTY and returns a `TerminalRuntimeSnapshot`; `terminal_attach`/`terminal_detach` add or remove a subscriber on an existing runtime.

- Each subscriber is a `tauri::ipc::Channel<TerminalEvent>` (`snapshot | output | status | exited | error`) identified by a frontend-generated **connection ID**. Detach removes only the matching connection so a late detach from an old view cannot clear a newer attach. Attach returns the in-memory scrollback as the `snapshot`; live events are queued until the snapshot is replayed.
- Frontend: `XtermView.tsx` keeps one Channel for a whole "connection generation" and reconnects only when the definition, workspace, or an explicit restart (`startRequests` counter in the store) changes, never merely because the runtime snapshot object changed.
- `PersistentTerminalDeck.tsx` mounts an `XtermView` for every terminal in every workspace layout and keeps them mounted across tab and workspace switches, hiding inactive ones with CSS visibility. On reveal it runs `FitAddon.fit()` and refreshes. This preserves alternate-screen/TUI state (Claude Code, k9s). Do not dispose xterm instances on routine switching; Rust snapshot replay is for genuine attach/recovery only.
- `terminalKeymap.ts` encodes Shift+Enter as CSI-u `ESC [ 13 ; 2 u` at the emulator layer so Claude Code can tell it from Enter.
- Rust PTY bootstrap completes ConPTY's initial cursor-position (DSR) handshake before forwarding output; without it PowerShell/WSL appear blank.
- On Windows, `portable-pty` prefers a `conpty.dll` found next to the exe over `kernel32.dll`. Turtorge relies on that to ship a newer console host; a TUI "shifted one column / border at the far right" glitch that a window resize fixes means the inbox ConPTY is being used.
- Background probes (PowerShell version, `where.exe`, `wsl.exe`, path validation) go through the centralized helper in `platform.rs` that sets `CREATE_NO_WINDOW`; do not spawn `std::process::Command` directly for probes.
- Quitting terminates every managed process (after confirmation). External launcher processes (`launcher.rs`) are detached and never enter the terminal registry.

### Layout and workspace model

- `Workspace.layout` is a recursive `LayoutNode`: `{ type: "pane", id, terminalIds, activeTerminalId }` or `{ type: "split", direction, ratio, children }`. `src/lib/layout.ts` holds the immutable tree operations (split, remove, promote sibling on delete, move terminal between panes); `terminalDrag.ts` holds HTML5 drag state. Structural workspace mutations that must be transactional with live runtimes (`workspace_move_terminal`, `workspace_reorder`) run in Rust (`storage.rs` + `TerminalManager::move_definition_transaction`).
- `storage.rs` persists `workspaces.json` and `settings.json` under the Tauri app-data dir via write-to-`.tmp`, backup, rename. Only definitions and settings are stored.
- `stores/appStore.ts` is the single Zustand store: workspaces, settings, detected shells/WSL distributions, launcher statuses, `runtimes` keyed by definition id, plus `startRequests`/`pendingStarts`/`pendingConnections` for connection bookkeeping.

### Paths and shells

`WorkspacePath { kind: windows | wsl | native, value, distribution }` (UNC paths are `windows`-kind values). WSL paths must be absolute Linux paths; `platform_resolve_wsl_path` converts `\\wsl.localhost\...`/`\\wsl$\...` picker results and resolves `~` to the distribution's real home in Rust. `ShellProfile.kind` is `powerShell | wsl | native`; WSL and macOS shells start as interactive login shells (`zsh -l -i`). macOS launcher discovery reads the login-shell PATH because GUI apps don't inherit it.

### Launchers

`launcher.rs` uses a structured program + argument-token model with allowlisted placeholders `{path}`, `{wslPath}`, `{distribution}`, `{projectRoot}`; never build a raw command string. Finder is `/usr/bin/open {path}`; `.app` bundles launch via `open -a`. Availability detection must not execute candidate applications.

## Frontend conventions

- Tests sit beside sources (`*.test.ts(x)`). Component tests need `// @vitest-environment jsdom` as the first line; there is no vitest config file, so pure logic tests default to node.
- Tauri window `dragDropEnabled: false` is required for HTML5 tab dragging on Windows; jsdom drag tests only cover event wiring, not native WebView2 acceptance.
- `data-tauri-drag-region` applies only to the element it is on, not children. Mark containers explicitly and leave buttons unmarked.
- Styling is plain CSS with tokens in `src/styles/tokens.css`; design direction follows `.superdesign/design-system.md`.
- Production build warns that the main chunk exceeds 500 kB; that is known and non-blocking.
