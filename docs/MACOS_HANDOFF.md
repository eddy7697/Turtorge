# macOS Handoff

Status: planning and investigation only
Last reviewed: 2026-08-08
Implementation baseline before this documentation audit: `db18dac`

Turtorge has been cloned successfully on macOS, but the current product remains a Windows 10/11 MVP. The clone proves only that the source is available on the Mac. Native macOS build, terminal use, packaging, signing, and delivery have not been implemented or verified.

## 1. Source-of-truth order

Use the repository documents in this order when they disagree:

1. `docs/DEVELOPMENT_HISTORY.md` for confirmed decisions, completed work, verification, and deferred scope.
2. `docs/MVP_IMPLEMENTATION.md` for the implemented Windows MVP boundary.
3. `README.md` for current setup and repository orientation.
4. `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/UI_SPEC.md`, and `docs/ROADMAP.md` for the original product vision and future direction.

The fourth group remains useful design input, but it contains aspirational features and must not be treated as an implementation inventory.

## 2. Verified baseline

The current source was most recently verified on Windows. During the 2026-08-08 documentation audit, the existing checkout passed:

- Frontend Vitest: 42/42 tests.
- Rust default suite: 18 passed, 1 Windows/WSL integration test ignored.
- TypeScript project compilation.

No macOS native result is recorded. A frontend-only Vite preview is not evidence that native shells, PTYs, dialogs, launchers, window behavior, application lifecycle, or packaging work on macOS.

## 3. Known macOS blockers

The current implementation is structurally Windows-specific:

- `PathKind` contains only `windows` and `wsl`.
- `ShellKind` contains only `powerShell` and `wsl`.
- Bootstrap discovers `pwsh.exe`, `powershell.exe`, and `wsl.exe` and exposes `windowsShells` and `wslDistributions` to React.
- Terminal startup constructs only PowerShell or WSL commands.
- Workspace and terminal dialogs offer only Windows and WSL environments.
- Built-in launchers use File Explorer and Windows installation paths. Launcher validation and process creation use Windows executable conventions.
- The custom title bar supplies Windows-style minimize, maximize, and close controls.
- Application shortcuts use `Ctrl`; macOS `Cmd` mappings have not been implemented or accepted.
- The only isolated release helper is `build-latest.bat`.
- There is no macOS CI, `.app` delivery, universal-binary decision, signing, or notarization workflow.

The presence of macOS icon assets is packaging preparation only; it does not indicate macOS runtime support.

Even if `pnpm tauri:dev` opens a window on macOS, the application must not be described as usable until native shell discovery, path modeling, PTY startup, terminal lifecycle, platform UI, and launchers have passed native acceptance.

## 4. Local state is not transferred by Git

Cloning the repository does not transfer Turtorge workspaces or settings. Runtime configuration is stored through Tauri's operating-system application-data directory in:

- `workspaces.json`
- `settings.json`

The `.turtorge.yml` import/export and repository-trust flow remains deferred. Do not manually copy Windows workspace JSON to macOS without an explicit migration design: saved path kinds, drive paths, WSL distributions, shell executables, and launcher profiles are platform-specific.

Terminal input, output, and scrollback must remain excluded from persistence and migration.

## 5. Toolchain information to record

The repository pins `pnpm@11.9.0`, but it does not currently pin Node.js through `.nvmrc` or `.node-version`, Rust through `rust-toolchain.toml`, or an Xcode toolchain version.

Every macOS investigation should record:

- branch and commit;
- macOS version;
- Apple Silicon or Intel architecture;
- `node -v`;
- `pnpm -v`;
- `rustc -Vv`;
- `cargo -V`;
- `xcode-select -p`;
- the exact command attempted and whether the failure occurred during dependency installation, compilation, application startup, or native use.

Install the locked dependencies before interpreting frontend failures:

```sh
pnpm install --frozen-lockfile
```

If the requested pnpm version is not already available, its first activation may require network access. A package-manager activation or dependency-installation failure is not a Turtorge test failure.

## 6. Scope decision required before implementation

Do not begin a broad platform port until one of these targets is explicitly selected:

1. Frontend-only development on a Mac.
2. A native compile-and-launch feasibility spike.
3. A usable native macOS product.

The third target requires, at minimum:

- native zsh, bash, and optionally fish discovery;
- a POSIX/native path and shell model with a migration strategy for persisted JSON;
- Unix PTY startup, cwd, environment, resize, exit, shutdown, and recovery coverage;
- Finder and macOS application-launcher behavior;
- macOS title-bar, traffic-light, shortcut, theme, folder-picker, and minimum-size acceptance;
- an Apple Silicon, Intel, or universal-binary delivery decision;
- `.app` packaging, signing, notarization, and macOS CI decisions;
- native acceptance for terminal switching and stateful TUI applications.

## 7. Non-negotiable boundaries

The macOS work must preserve the existing product constraints:

- All terminals remain embedded in the Turtorge application layout.
- Turtorge owns tabs, labels, panes, and nested splits.
- Rust owns PTYs, child processes, storage, and lifecycle management.
- Terminal input, output, and scrollback are not persisted to disk.
- Shell and working-directory failures remain visible; there is no silent fallback.
- macOS work extends the completed Windows MVP instead of redefining it.
