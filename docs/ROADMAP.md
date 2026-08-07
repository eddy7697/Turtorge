# Platform Roadmap

Status: directional roadmap; implementation state is recorded in `DEVELOPMENT_HISTORY.md`
Last reconciled: 2026-08-08

This roadmap preserves future direction. A phase heading or listed capability is not evidence that the capability has shipped.

Turtorge 採用 Rust + Tauri 作為核心架構。

雖然第一版以 Windows Developer 為主要目標，但從專案建立之初，即以跨平台能力作為設計原則。

## Phase 1

Primary Platform

- Windows 11
- Windows 10

目前已完成並驗證：

- PowerShell
- WSL2
- Windows Path
- Windows Clipboard

仍屬後續範圍：

- Git Bash

此階段所有 UX 均以 Windows Developer 為中心。

---

## Phase 2

Native macOS Support

Status: not started; scope requires explicit approval before implementation.

目標：

提供與 Windows 相同的 Workspace 體驗。

支援：

- zsh
- bash
- fish
- Homebrew Environment
- Native Terminal Process
- Apple Silicon
- Intel Mac

Workspace Manifest

```
.turtorge.yml
```

必須可完全跨平台。

Windows 建立的 Workspace 應能直接於 macOS 開啟。

This remains a future goal. The `.turtorge.yml` manifest and cross-platform migration flow are not implemented in the current source. See `MACOS_HANDOFF.md` for the present blockers and required decisions.

---

## Phase 3

Native Linux Support

支援：

- Ubuntu
- Fedora
- Arch Linux

Shell：

- bash
- zsh
- fish

Terminal Process：

- PTY
- SSH
- Docker

---

# Cross-platform Principles

Turtorge 的核心不是 Windows Terminal。

也不是 macOS Terminal。

而是：

Workspace。

因此：

所有 Workspace Metadata、Layout、Manifest、Plugin API 應保持平台無關（Platform Agnostic）。

例如：

不要保存：

```
C:\Projects\Wallet
```

而應保存：

```
${workspaceRoot}
```

或：

```
~/Projects/Wallet
```

並由各平台進行路徑解析。

---

# Platform Abstraction

Rust Core 應建立 Platform Layer：

```
Platform

├── Windows

│   ├── PowerShell

│   ├── WSL

│   └── Windows Process

├── macOS

│   ├── zsh

│   ├── bash

│   └── macOS Process

└── Linux

    ├── bash

    ├── zsh

    └── Linux PTY
```

Workspace Manager 不應知道目前是哪個平台。

所有平台差異皆由 Platform Layer 處理。

---

# Long-term Goal

Turtorge 希望提供一致的 Workspace 體驗，而非一致的 Terminal。

Developer 不需要重新學習不同平台的使用方式。

只需要：

Open Workspace.

剩下的一切，交給 Turtorge。
