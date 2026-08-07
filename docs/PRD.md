# Turtorge PRD
Version: 0.1.0

Status: Draft product vision; not an implementation inventory

> Current-state notice (2026-08-08): This document preserves the original product direction and includes aspirational MVP and future features. For confirmed implementation, verification, and deferred scope, consult `DEVELOPMENT_HISTORY.md`, `MVP_IMPLEMENTATION.md`, and `README.md` in that order. Native macOS support remains unimplemented; see `MACOS_HANDOFF.md`.

Author: Eddy Lee

---

# Turtorge

> **A Workspace-first Terminal Manager for AI-native Developers.**

**Turtorge** 並不是另一個 Terminal，也不是另一個 IDE。

Workspace is the product. Platform is an implementation detail.

它是一個以 **Workspace** 為核心的開發環境管理器（Development Environment Orchestrator），負責整合 Terminal、Shell、AI Agent 與 Project，讓開發者可以快速回到工作，而不是重新建立工作環境。

---

# Product Mission

> **Developers should remember their work, not their windows.**

中文：

> **讓開發者記住的是工作，而不是昨天到底開了哪六個 VS Code、哪四個 Terminal。**

---

# Vision

現代開發流程已經從：

- 一個 IDE
- 一個 Terminal

演變成：

- 多個 Project
- 多個 AI Agent
- 多個 Terminal
- 多個 Shell
- 多個 Docker Container
- 多個 Git Repository
- 多個 Development Environment

現有工具仍然圍繞著：

- Editor
- Terminal

而 Turtorge 則圍繞著：

> **Workspace**

使用者不再開啟 Terminal。

而是：

> **開啟 Workspace。**

---

# Problem Statement

目前 Windows 開發者每天都在管理：

- VS Code Window
- Claude Code
- Codex
- Gemini CLI
- Docker
- Kubernetes
- WSL
- PowerShell
- Git Bash

每一個 Project 都可能需要：

不同 Shell

不同 Terminal

不同 AI

不同 Startup Command

最後桌面變成：

- 十幾個 VS Code
- 十幾個 Terminal
- 多個 Claude Code
- 多個 Codex

真正需要的是：

> 我想快速回到昨天工作的 Project。

而不是：

> 我要重新打開所有工具。

---

# Goals

Turtorge 的核心目標：

- Workspace First
- AI Agnostic
- Shell Agnostic
- Stateless by Default
- Native Windows Experience
- Fast Workspace Restore

---

# Core Philosophy

## Workspace First

所有設定都屬於 Workspace。

Workspace 包含：

- Project
- Shell
- Working Directory
- Agent
- Terminal Layout
- Startup Commands
- Favorite Commands
- Environment Variables

Terminal 只是 Workspace 的其中一部分。

---

## AI Agnostic

Turtorge 不依賴任何 AI。

支援：

- Claude Code
- Codex
- Gemini CLI
- Aider
- OpenCode
- Bash
- PowerShell
- Docker Shell
- SSH

AI Agent 僅是一種 Terminal Profile。

---

## Shell Agnostic

Workspace 不綁定任何 Shell。

支援：

- PowerShell
- WSL
- Git Bash
- CMD
- SSH
- Custom Shell

同一 Workspace 可以自由切換 Shell。

---

## Stateless by Default

預設：

**不保存 Terminal Session。**

保存的是：

- Workspace Metadata
- Layout
- Startup Commands
- Working Directory
- Terminal Configuration

因為真正重要的是：

Workspace Configuration。

而不是 Terminal Memory。

---

## Native Windows

Windows 是第一公民。

完整支援：

- Windows 11
- Windows 10
- PowerShell
- WSL2
- Windows Path
- UNC Path
- Clipboard

不是 Linux 的移植版本。

---

# Target Users

Primary

- Backend Engineer
- DevOps Engineer
- Platform Engineer
- AI Native Developer

Secondary

- Full Stack Developer
- SRE
- Technical Lead

---

# MVP Features

## Workspace Sidebar

左側 Workspace：

- Wallet
- Notify
- CMS
- Infrastructure
- FrozenHeart

功能：

- Search
- Favorite
- Pin
- Rename
- Color Tag
- Icon
- Group

---

## Workspace Metadata

每個 Workspace 保存：

```yaml
name:
description:

icon:
color:

shell:
working_directory:

startup_commands:

environment_variables:

terminal_layout:

default_agent:

favorite_commands:
```

---

## Terminal Profiles

支援：

- Normal Terminal
- PowerShell
- WSL Ubuntu
- WSL Debian
- Git Bash
- SSH
- Docker Exec
- Kubectl
- Claude Code
- Codex
- Gemini CLI
- Custom

---

## Startup Actions

Workspace 開啟流程：

```
選擇 Shell

↓

切換 Working Directory

↓

執行 Startup Commands

↓

建立 Terminal

↓

啟動 AI Agent

↓

完成
```

例如：

```bash
cd ~/wallet

docker compose up -d

claude

codex
```

---

## Terminal Layout

Workspace 可以保存：

```
Claude

Codex

artisan

docker

mysql

redis
```

保存：

- Layout

不保存：

- Running Session

---

## Recent Workspace

自動維護：

- Recent
- Favorite
- Most Used
- Pinned

---

# Workspace Model

```
Workspace

├── Metadata
├── Environment
├── Shell
├── Startup
├── Commands
├── Layout
└── Terminals
```

---

# Workspace Manifest

每個 Project 可以包含：

```
.turtorge.yml
```

例如：

```yaml
name: Wallet

shell: wsl

working_directory: .

startup:

  - docker compose up -d

  - composer install

layout:

  - Claude Code

  - Codex

  - artisan

commands:

  migrate:

    artisan migrate

  queue:

    artisan queue:work

agent:

  default:

    claude
```

任何人 Clone 專案後：

```
turtorge open
```

即可恢復 Workspace。

---

# UX Principles

使用者只需要記住：

> Project

而不是：

- VS Code Window
- Terminal
- Claude Code
- Codex
- PowerShell
- WSL

Workspace 就代表一切。

---

# Technology Stack

## Frontend

- React
- TypeScript
- xterm.js

---

## Desktop Framework

- Tauri v2

---

## Backend

- Rust

---

## IPC

- Tauri IPC

---

## Storage

MVP：

- JSON

Future：

- SQLite

---

# Why Rust

Turtorge 是一個需要：

- 長時間常駐
- Process 管理
- Terminal 管理
- Shell Lifecycle
- Workspace Restore
- Plugin System

的 Desktop Application。

因此：

Rust 比 Node.js 更適合作為核心。

優勢：

- Memory Safety
- 高效能
- 低記憶體使用
- Native Windows
- 多執行緒
- Process 管理能力佳
- 適合作為 Background Service

---

# Architecture Principle

Rust 是整個系統的核心。

React 僅負責：

- Rendering
- User Interaction

Business Logic 應盡可能集中於 Rust。

避免：

- React 管理 Process
- React 管理 Terminal
- React 管理 Workspace

所有核心邏輯皆交由 Rust。

---

# Core Architecture

```
                 React UI
                      │
                 Tauri IPC
                      │
─────────────────────────────────
                  Rust Core
─────────────────────────────────

Workspace Manager

Shell Manager

Terminal Manager

Process Manager

Layout Manager

Plugin Manager

Config Manager

Session Manager

─────────────────────────────────

PowerShell

WSL

Git Bash

SSH

Docker

Custom Shell
```

---

# Future Features

## Workspace Snapshot

保存：

- Layout
- Terminal
- Scroll Position

不一定保存：

- Running Process

---

## Git Awareness

Workspace 顯示：

```
wallet

main

● modified

↑ ahead 2
```

---

## Docker Awareness

Workspace 顯示：

```
mysql

redis

nginx

running
```

---

## Command Library

每個 Workspace：

```
artisan migrate

artisan queue:work

docker compose logs

npm run dev
```

一鍵執行。

---

## Workspace Templates

建立 Workspace：

Laravel

Go

Node

Rust

Python

Docker Compose

直接套用。

---

## SSH Workspace

例如：

Production

Workspace：

```
SSH

kubectl

docker logs

tail logs
```

---

## Plugin System

未來支援：

- Cloudflare
- GitHub
- GitLab
- AWS
- Azure
- GCP
- MCP
- Claude
- Codex
- Gemini

---

# Non Goals

第一版不做：

- IDE
- Code Editor
- Git GUI
- Docker GUI
- Database Client
- AI Chat
- Debugger

Turtorge 的責任只有：

> 管理 Workspace。

---

# Success Metrics

使用者可以：

- 一秒找到 Project
- 五秒恢復工作環境
- 不再需要十幾個 VS Code Window
- 不再需要重新建立 Terminal
- 不再需要記住昨天到底開了哪些工具

---

# Engineering Philosophy

Turtorge 不追求取代：

- VS Code
- Cursor
- Zed
- Claude Code
- Codex

而是：

> **成為所有開發工具的協調者（Orchestrator）。**

它只負責：

- 管理 Workspace
- 管理 Shell
- 管理 Terminal
- 管理 Process
- 管理 AI Agent

而不是：

- 編輯程式
- Debug
- Git GUI
- Docker GUI

---

# Long-term Vision

Turtorge 最終不是：

- Terminal
- IDE
- AI Tool

而是：

> **The Operating System for Modern Development Workspaces.**

管理：

- Workspace
- Shell
- AI Agent
- Docker
- Git
- SSH
- Development Environment

讓開發者專注於真正重要的事情：

> **寫程式，而不是管理工具。**

---

# Product Slogan

> **Turtorge doesn't replace your tools. It brings them together.**

中文：

> **Turtorge 不取代你的工具，它只是把它們整合在一起。**
