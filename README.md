# Turtorge

![Turtorge logo](images/logo.png)

Turtorge is a Windows-first, workspace-oriented terminal manager. It keeps PowerShell, WSL shells, development commands, and AI CLI profiles inside one application-controlled layout.

The current implementation is a working Windows MVP built from the product documents in [`docs/`](docs/). It uses a native PTY rather than opening Windows Terminal or external console windows.

## Implemented

- Embedded xterm.js terminals with application-owned tabs and nested horizontal/vertical splits.
- Rust-owned PTY, process lifecycle, resize, input/output streaming, and graceful-then-forced termination.
- PowerShell detection with the highest installed version selected by default and all detected versions available.
- WSL distribution discovery, excluding Docker-managed distributions.
- Per-distribution bash/zsh detection, default-shell preference, and explicit shell selection.
- Native interactive WSL login shells (`zsh -l -i` and `bash -l -i`) under the distribution's default user.
- Windows, UNC, mounted-drive, and WSL-native working-directory validation without silent fallback.
- Workspace JSON persistence, last-workspace restore, nested layout persistence, pinned/favorite metadata, and per-terminal environment variables.
- Shell, Claude Code, Codex, and custom terminal profiles.
- In-memory scrollback only; terminal input and output are never persisted to disk.
- Multi-line paste warning, running-terminal close confirmation, and app-quit confirmation that prevents orphan processes.
- Custom borderless title bar, responsive 900×600 minimum layout, and system/light/dark themes.

## Stack

- Tauri v2 and Rust 2024
- `portable-pty` 0.9 / Windows ConPTY
- React 19, TypeScript, Vite, Zustand
- xterm.js 6 with fit and web-links addons
- Vitest and Rust unit/integration tests

## Run locally

Prerequisites:

- Windows 10 or 11 with WebView2
- Rust stable with the MSVC toolchain
- Node.js and pnpm 11
- WSL only if WSL profiles are required

```powershell
pnpm install
pnpm tauri:dev
```

Frontend-only preview:

```powershell
pnpm dev
```

The browser preview uses a mock terminal stream. Use `pnpm tauri:dev` to exercise real PowerShell and WSL PTYs.

## Build a standalone release

Run [`build-latest.bat`](build-latest.bat) from File Explorer or a terminal. It synchronizes the locked pnpm dependencies, builds the current source through the Tauri CLI with `--no-bundle`, and writes the standalone executable to a unique date-stamped directory:

```text
artifacts/YYYY-MM-DD_HH-mm-ss_fff/release/turtorge.exe
```

Each build uses an isolated Cargo target directory, so it does not replace the standard release or any previously built executable that may still be running.

## Verify

```powershell
pnpm test
pnpm build
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
```

The opt-in native PTY test launches installed shells and requires a local WSL distribution:

```powershell
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml real_wsl_login_shells_round_trip_through_a_pty -- --ignored --nocapture
```

It exercises PowerShell plus every detected bash/zsh profile through a real ConPTY, including input, output, login-shell startup, and clean exit.

## Architecture

- [`apps/desktop/src/`](apps/desktop/src/) owns presentation, xterm instances, interaction state, and typed IPC calls.
- [`apps/desktop/src-tauri/src/terminal.rs`](apps/desktop/src-tauri/src/terminal.rs) owns PTYs, child processes, in-memory scrollback, and runtime events.
- [`apps/desktop/src-tauri/src/platform.rs`](apps/desktop/src-tauri/src/platform.rs) isolates Windows, PowerShell, WSL, shell, and path detection.
- [`apps/desktop/src-tauri/src/storage.rs`](apps/desktop/src-tauri/src/storage.rs) performs atomic JSON persistence in the application data directory.
- [`apps/desktop/src/lib/layout.ts`](apps/desktop/src/lib/layout.ts) contains the immutable split/tree layout operations.

Configuration and runtime are deliberately separate. Switching workspaces detaches the xterm view but leaves its Rust-owned process running; quitting Turtorge terminates every managed process after one confirmation.

## Current MVP boundary

Installer packaging, auto-update, macOS/Linux builds, manifest import, secure secret storage, tags/groups, and the full settings matrix remain deferred. Environment-variable values are currently stored as plaintext configuration and the UI warns users accordingly.

See [`docs/MVP_IMPLEMENTATION.md`](docs/MVP_IMPLEMENTATION.md) for the decisions confirmed during product grilling and the implementation boundary.

## Design

The UI follows the approved Superdesign exploration and the local design tokens in [`.superdesign/design-system.md`](.superdesign/design-system.md). The generated app icon is a deterministic transparent crop of the supplied turtle artwork; [`images/logo.png`](images/logo.png) remains unchanged.
