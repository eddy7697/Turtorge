# macOS Handoff

Status: implemented and locally verified for Apple Silicon
Last reviewed: 2026-08-08
Release version: 0.2.0

Turtorge now has a native macOS 12+ route in the same codebase as the completed Windows MVP. The supported Mac target is Apple Silicon only. Intel/x86 and universal artifacts are intentionally excluded.

## 1. Source-of-truth order

Use the repository documents in this order when they disagree:

1. `docs/DEVELOPMENT_HISTORY.md` for confirmed decisions, completed work, verification, and deferred scope.
2. `docs/MVP_IMPLEMENTATION.md` for the implemented Windows MVP boundary.
3. `README.md` for current setup and repository orientation.
4. `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/UI_SPEC.md`, and `docs/ROADMAP.md` for the original vision and future direction.

## 2. Supported native Mac product

The macOS implementation provides:

- native zsh and bash discovery, optional Homebrew/local fish discovery, and validated custom shell executables;
- real Unix PTYs with interactive/login startup, cwd, environment, input/output, resize, exit, shutdown, and in-memory scrollback behavior;
- explicit xterm-compatible child capabilities for Finder/LaunchServices launches, including true color and terminal program metadata;
- process-signal-based terminal shutdown and Force Restart without injecting `exit` or other commands into the PTY, plus a fresh emulator screen for every runtime generation;
- a typed native path and shell model while retaining the Windows and WSL wire formats;
- visible fallback to the user's home when a previously saved working directory disappears, while newly entered invalid paths and unavailable shells fail validation;
- Finder as the built-in file manager through `/usr/bin/open {path}`;
- macOS discovery and detached launch behavior for Visual Studio Code, Cursor, Antigravity, Zed, IntelliJ IDEA, Rider, WebStorm, PyCharm, and exact-version Unity editors;
- vertically centered native traffic lights and title-bar overlay, Command-based shortcuts, close-to-hide behavior, Dock reopen, and confirmed Command+Q process termination;
- independent macOS application-data storage with backward-compatible JSON parsing and no automatic Windows-to-Mac migration;
- Apple Silicon `.app` and `.dmg` artifacts with macOS 12 as the minimum system version.

WSL has no simulated macOS equivalent. SSH, Docker/container terminals, remote adapters, `.turtorge.yml` migration, auto-update, and Linux delivery remain separate future work.

## 3. Pinned development environment

- Node.js: 22.16.0 through `.node-version`
- pnpm: 11.9.0 through the root `packageManager` field
- Rust: 1.97.1 with rustfmt and Clippy through `rust-toolchain.toml`
- Tauri CLI: locked in `pnpm-lock.yaml`
- macOS: 12.0 or newer
- architecture: `arm64` only

The 2026-08-08 local release was built on Apple Silicon macOS 26.5.1. Command Line Tools were sufficient for compilation and ad-hoc `.app` packaging. A complete Xcode installation is required when `notarytool` is needed for Developer ID distribution.

## 4. Development and verification

Install the locked JavaScript dependencies and start the native application:

```sh
pnpm install --frozen-lockfile
pnpm tauri:dev
```

Run the repeatable checks:

```sh
pnpm test
pnpm build
cargo fmt --manifest-path apps/desktop/src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --manifest-path apps/desktop/src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml terminal::macos_integration_tests -- --ignored --nocapture
```

The latest local verification passed 47 frontend tests, 23 default Rust tests, all 4 ignored native PTY/process tests when explicitly enabled, Rust formatting, Clippy with warnings denied, TypeScript compilation, and the Vite production build. The real zsh line-editor test covers previous/next history navigation, Backspace/Delete, forward Delete, cursor movement, and clean exit. Force-close tests cover command-free shutdown and a continuously emitting foreground process. Frontend coverage proves that xterm control sequences reach the Rust boundary byte-for-byte and that every restart generation resets the retained emulator.

Native child processes always receive `TERM=xterm-256color`, `COLORTERM=truecolor`, and Turtorge program metadata after user environment merging. This is application-owned capability data: GUI applications launched by Finder do not inherit a reliable `TERM`, and existing terminal processes must be restarted to receive a corrected environment.

The release application was also accepted by LaunchServices as an Apple Silicon foreground app. Its main process and WebView helper processes stayed running without crash/fault logs, and the bundled executable, identifier, version, deployment target, and ad-hoc signature were inspected directly. A fresh-bundle screenshot confirmed that the native traffic-light center matches the 40 px custom title-bar center after changing the overlay inset from `y: 13` to `y: 18`.

## 5. Release packaging

Run the root release helper on Apple Silicon:

```sh
./build-latest-macos.sh
```

It creates an isolated target and produces:

```text
artifacts/YYYY-MM-DD_HH-MM-SS/release/bundle/macos/Turtorge.app
artifacts/YYYY-MM-DD_HH-MM-SS/release/bundle/dmg/Turtorge_0.2.0_aarch64.dmg
```

The application is ad-hoc signed when no Apple signing identity is supplied. The DMG is built without Finder-driven cosmetic positioning because the Finder AppleScript stage is unreliable in non-interactive build contexts; the image still contains the signed application and an `/Applications` drop-link. The release helper verifies both the application signature and DMG checksum before reporting success.

The verified 2026-08-08 DMG is `artifacts/2026-08-08_06-10-31/release/bundle/dmg/Turtorge_0.2.0_aarch64.dmg`, SHA-256 `3ee503a9ec32091de8a65688ab4009ba1894842e9dd9d6aec2082dedb491874d`. It includes the terminal-input, Force Restart, fresh-emulator, and centered traffic-light fixes and supersedes every earlier local 0.2.0 artifact.

For a credentialed release, set `APPLE_SIGNING_IDENTITY` to an installed Developer ID Application certificate. Notarization is enabled when one complete authentication set is available:

- `APPLE_API_KEY`, `APPLE_API_ISSUER`, and `APPLE_API_KEY_PATH`;
- `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID`; or
- `APPLE_KEYCHAIN_PROFILE` for a profile already stored with `notarytool`.

The helper rejects partial credential sets and never writes credentials into the repository. It signs the DMG, submits it with `notarytool`, waits for completion, and staples the result. No Developer ID identity is installed on the current machine, so the credentialed branch is wired but not locally executable yet.

## 6. Persistence and compatibility

Runtime configuration remains in Tauri's operating-system application-data directory as `workspaces.json` and `settings.json`. Git does not transfer these files. macOS and Windows use their own application-data locations.

Serde defaults and the retained Windows/WSL variants keep existing JSON readable, but Windows paths, WSL distributions, and Windows launcher executables are not automatically converted into Mac definitions. `.turtorge.yml` import/export remains the future portability mechanism.

Terminal input, output, and scrollback remain excluded from persistence and migration.

## 7. Remaining release gates

- Developer ID signing and notarization require the user's Apple Developer certificate and credentials plus complete Xcode tooling.
- The Windows regression workflow runs on GitHub Actions after the changes are pushed; it does not claim a Windows result from a Mac host.
- The production frontend still emits the known non-blocking warning for a JavaScript chunk larger than 500 kB.

## 8. Non-negotiable boundaries

- All terminals remain embedded in the Turtorge application layout.
- Turtorge owns tabs, labels, panes, and nested splits.
- Rust owns PTYs, child processes, storage, and lifecycle management.
- Terminal input, output, and scrollback are not persisted to disk.
- Shell and working-directory failures remain visible; there is no silent shell substitution.
- macOS extends the completed Windows MVP instead of redefining it.
