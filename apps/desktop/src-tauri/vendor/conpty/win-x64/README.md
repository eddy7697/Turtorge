# Sideloaded ConPTY host (Windows x64)

Turtorge ships its own ConPTY implementation next to `turtorge.exe` instead of
relying on the ConPTY that is built into the installed Windows version.

`portable-pty` loads `conpty.dll` from the executable directory when it is
present and falls back to the `kernel32.dll` ConPTY otherwise. `conpty.dll`
starts the matching `OpenConsole.exe` from the same directory as the console
host process. Both files must therefore be deployed together, and
`build.rs` copies them into the Cargo profile directory on Windows builds so
`pnpm tauri:dev`, `pnpm tauri:build --no-bundle`, and `build-latest.bat` all
place them beside the produced executable.

## Why

The inbox ConPTY re-synthesizes terminal output from its own screen buffer.
On Windows 11 (conhost 10.0.26100) that re-synthesis corrupted full-width
TUI redraws in WSL: after k9s returned from a pod shell, or after Claude Code
or Codex redrew following a tab switch, the leftmost border character landed
in the last column of the previous row and the rest of the row shifted left by
one column. Windows Terminal and VS Code avoid the problem by bundling this
newer console host. An A/B test with the same `turtorge.exe`, with and without
these two files, reproduced and removed the corruption.

## Provenance

| File              | Size (bytes) | SHA-256                                                            |
| ----------------- | -----------: | ------------------------------------------------------------------ |
| `conpty.dll`      |      109,600 | `7c7430632052ff703540b68371ec43821820aa1335d8e11dfbcd9ff00e9daaed` |
| `OpenConsole.exe` |    1,148,448 | `d1fe7faa62f9e955e2ac2371f95d7e5513df4d496255097158f979c94782c5fc` |

- Product: Microsoft Windows Terminal / `microsoft/terminal` console host
- File version: `1.23.2510.08001`
- Obtained from: the `node-pty` 1.1.0 npm package
  (`https://registry.npmjs.org/node-pty/-/node-pty-1.1.0.tgz`), path
  `package/third_party/conpty/1.23.251008001/win10-x64/`
- License: MIT, Copyright (c) Microsoft Corporation (see `LICENSE`)

## Updating

1. Take `conpty.dll` and `OpenConsole.exe` from a newer `node-pty` release or
   from the `Microsoft.Windows.Console.ConPTY` NuGet package (x64 only).
2. Replace both files together; never mix versions.
3. Update the table above and the expected sizes in the Rust regression test
   in `src/platform.rs`.
4. Run the opt-in real PowerShell/WSL PTY test and re-check a full-width TUI
   (k9s pod shell round trip) in the built executable.
