# Turtorge Architecture

Version: 0.1.0
Status: Draft target architecture; not an as-built inventory
Primary Platform: Windows
Future Platforms: macOS, Linux
Core Language: Rust
Desktop Framework: Tauri v2
Frontend: React + TypeScript

> Current-state notice (2026-08-08): This document contains proposed structures, dependencies, and future platform abstractions that were not all adopted by the Windows MVP. Use `DEVELOPMENT_HISTORY.md` and the source tree for the as-built architecture. Native macOS support remains unimplemented; see `MACOS_HANDOFF.md`.

---

# 1. Architecture Overview

Turtorge 是一款以 Workspace 為核心的 Terminal 管理器。

它不是 IDE，也不是單純的 Terminal Emulator。

Turtorge 的主要責任是管理：

* Workspace
* Shell
* Working Directory
* Terminal
* Process
* AI Agent
* Terminal Layout
* Startup Action
* Command
* Platform Environment

Turtorge 的架構必須遵循以下核心原則：

> **Workspace is the product. Platform is an implementation detail.**

所有平台差異、Shell 差異及 Process 差異，都必須封裝在 Rust Core 內。

React 前端只負責：

* 畫面呈現
* 使用者操作
* Terminal 畫布
* UI 狀態
* 呼叫 Rust Command
* 接收 Rust Event

React 不負責：

* Process 管理
* Shell 啟動
* PTY 管理
* Workspace 持久化
* 路徑轉換
* 平台偵測
* Process Lifecycle
* Terminal Session Lifecycle

---

# 2. Architecture Goals

Turtorge 的架構必須達成以下目標：

1. Windows 為第一公民。
2. 原生支援 PowerShell 與 WSL。
3. 同一 Workspace 可包含不同 Shell。
4. Workspace 設定可持久化。
5. 不依賴 Terminal Session 保存。
6. Process 與 Terminal 可以獨立重新建立。
7. AI Agent 僅視為可執行的 Terminal Profile。
8. 核心邏輯集中於 Rust。
9. 前端與 Rust Core 之間使用明確的資料契約。
10. 平台差異必須透過 Platform Abstraction Layer 處理。
11. 未來可原生支援 macOS 與 Linux。
12. 架構必須允許 Terminal Layout、Plugin 與 Workspace Manifest 持續擴充。

---

# 3. Non-Goals

第一階段不建立：

* Code Editor
* Language Server
* Debugger
* Git GUI
* Docker GUI
* Database Client
* AI Chat UI
* 完整 Session Resume
* Remote Collaboration
* Cloud Workspace Sync
* Browser IDE
* Web-based Terminal Server

Turtorge 不取代：

* VS Code
* Cursor
* Zed
* Claude Code
* Codex
* Windows Terminal
* Docker Desktop
* Git Client

Turtorge 負責把這些工具整合到 Workspace 中。

---

# 4. High-Level Architecture

```text
┌─────────────────────────────────────────────┐
│                 Turtorge UI                 │
│                                             │
│  React                                      │
│  TypeScript                                 │
│  xterm.js                                   │
│  Workspace Sidebar                          │
│  Terminal Grid                              │
│  Command Palette                            │
│  Settings                                   │
└──────────────────────┬──────────────────────┘
                       │
                 Tauri IPC Layer
                       │
┌──────────────────────▼──────────────────────┐
│                  Rust Core                  │
│                                             │
│  Workspace Manager                          │
│  Terminal Manager                           │
│  Process Manager                            │
│  Shell Manager                              │
│  Layout Manager                             │
│  Profile Manager                            │
│  Command Manager                            │
│  Config Manager                             │
│  Event Manager                              │
│  Platform Abstraction Layer                 │
└──────────────────────┬──────────────────────┘
                       │
┌──────────────────────▼──────────────────────┐
│             Operating System Layer          │
│                                             │
│  Windows ConPTY                             │
│  PowerShell                                 │
│  WSL                                        │
│  Git Bash                                   │
│  CMD                                        │
│  SSH                                        │
│                                             │
│  Future:                                    │
│  macOS PTY / zsh / bash / fish              │
│  Linux PTY / bash / zsh / fish              │
└─────────────────────────────────────────────┘
```

---

# 5. Technology Stack

## 5.1 Core

* Rust stable
* Tokio
* Serde
* Serde JSON
* UUID
* Thiserror
* Tracing
* Tauri v2

## 5.2 Frontend

* React
* TypeScript
* Vite
* xterm.js
* Zustand
* React Router
* TanStack Query, optional
* CSS Modules or Tailwind CSS

## 5.3 Terminal Layer

Frontend：

* xterm.js
* xterm-addon-fit
* xterm-addon-search
* xterm-addon-web-links
* xterm-addon-unicode11

Backend：

* Windows ConPTY abstraction
* Cross-platform PTY crate
* Tokio async I/O
* Rust Process API

PTY crate 應於實作前進行技術驗證。

候選：

* portable-pty
* conpty
* winpty-rs
* 自行包裝 Windows ConPTY

MVP 優先選擇可以同時支援 Windows 與未來 macOS、Linux 的抽象層。

若現有 crate 無法穩定處理 Windows ConPTY，允許在 Platform Layer 內建立 Windows 專用實作。

## 5.4 Storage

MVP：

* JSON
* YAML Workspace Manifest

Future：

* SQLite
* Schema Migration
* Cloud Sync

## 5.5 Configuration Formats

應用程式內部設定：

```text
JSON
```

專案層級 Workspace Manifest：

```text
.turtorge.yml
```

---

# 6. Architectural Principles

## 6.1 Workspace First

Workspace 是最高層級的 Domain Entity。

Terminal、Shell、Agent、Command 與 Layout 都隸屬於 Workspace。

```text
Workspace
├── Metadata
├── Environment
├── Shell Profiles
├── Terminal Definitions
├── Startup Actions
├── Command Library
├── Layout
└── Runtime State
```

## 6.2 Rust Core Owns Runtime

所有 Runtime Resource 必須由 Rust 管理：

* PTY
* Child Process
* Shell Process
* Terminal Process
* Process ID
* stdin
* stdout
* stderr
* Resize
* Termination
* Exit Status

前端不得直接持有 OS Process。

## 6.3 Stateless by Default

Turtorge 優先保存 Configuration，而不是 Runtime Session。

保存：

* Workspace
* Terminal Definition
* Shell Profile
* Working Directory
* Startup Command
* Layout
* Labels
* Tags
* Recent Usage

預設不保存：

* Process Memory
* Shell Runtime State
* Agent Runtime State
* Terminal Scrollback
* Running PID

Process 關閉後可以根據 Configuration 重新建立。

## 6.4 AI Agnostic

Claude Code、Codex、Gemini CLI 與一般 Shell 在架構上應使用相同模型。

```text
Terminal Profile
├── Name
├── Executable
├── Arguments
├── Shell
├── Working Directory
├── Environment Variables
└── Startup Behavior
```

AI Agent 不應成為特殊的核心 Domain Model。

若未來需要 Agent-specific metadata，應作為 Profile Extension，而不是直接耦合至核心。

## 6.5 Platform Agnostic Domain

Domain Layer 不得直接依賴：

* Windows Path
* PowerShell
* WSL
* ConPTY
* macOS API
* Linux PTY

平台差異只能存在於：

```text
platform/
```

以及：

```text
infrastructure/
```

Domain Layer 僅使用抽象介面。

## 6.6 Explicit IPC Contracts

React 與 Rust 之間所有資料傳遞必須使用明確型別。

禁止傳遞：

* 無結構 JSON Blob
* 任意 Map
* 隱含欄位
* 未版本化資料

IPC Request 與 Event Payload 必須可序列化並具有版本策略。

---

# 7. Recommended Repository Structure

```text
turtorge/
├── apps/
│   └── desktop/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── features/
│       │   ├── hooks/
│       │   ├── layouts/
│       │   ├── lib/
│       │   ├── pages/
│       │   ├── stores/
│       │   ├── styles/
│       │   ├── types/
│       │   └── main.tsx
│       │
│       ├── src-tauri/
│       │   ├── src/
│       │   │   ├── application/
│       │   │   ├── commands/
│       │   │   ├── domain/
│       │   │   ├── events/
│       │   │   ├── infrastructure/
│       │   │   ├── platform/
│       │   │   ├── services/
│       │   │   ├── state/
│       │   │   ├── error.rs
│       │   │   ├── lib.rs
│       │   │   └── main.rs
│       │   ├── capabilities/
│       │   ├── icons/
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       │
│       ├── package.json
│       └── vite.config.ts
│
├── crates/
│   ├── turtorge-domain/
│   ├── turtorge-workspace/
│   ├── turtorge-terminal/
│   ├── turtorge-platform/
│   ├── turtorge-storage/
│   ├── turtorge-protocol/
│   └── turtorge-common/
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   ├── UI_SPEC.md
│   └── ADR/
│
├── examples/
│   └── manifests/
│
├── scripts/
├── tests/
├── Cargo.toml
├── package.json
└── README.md
```

MVP 也可以先採用單一 `src-tauri` crate。

但模組邊界應從第一天開始維持清楚，以便後續拆分成 Workspace。

---

# 8. Rust Module Structure

```text
src-tauri/src/
├── application/
│   ├── workspace_service.rs
│   ├── terminal_service.rs
│   ├── profile_service.rs
│   └── startup_service.rs
│
├── commands/
│   ├── workspace_commands.rs
│   ├── terminal_commands.rs
│   ├── shell_commands.rs
│   ├── profile_commands.rs
│   └── settings_commands.rs
│
├── domain/
│   ├── workspace.rs
│   ├── terminal.rs
│   ├── terminal_profile.rs
│   ├── shell_profile.rs
│   ├── layout.rs
│   ├── startup_action.rs
│   ├── command.rs
│   └── platform.rs
│
├── events/
│   ├── terminal_events.rs
│   ├── workspace_events.rs
│   └── process_events.rs
│
├── infrastructure/
│   ├── config_repository.rs
│   ├── workspace_repository.rs
│   ├── manifest_loader.rs
│   ├── process_registry.rs
│   └── terminal_registry.rs
│
├── platform/
│   ├── mod.rs
│   ├── windows/
│   │   ├── mod.rs
│   │   ├── conpty.rs
│   │   ├── powershell.rs
│   │   ├── wsl.rs
│   │   ├── git_bash.rs
│   │   ├── path.rs
│   │   └── process.rs
│   │
│   ├── macos/
│   │   ├── mod.rs
│   │   ├── pty.rs
│   │   ├── shell.rs
│   │   ├── path.rs
│   │   └── process.rs
│   │
│   └── linux/
│       ├── mod.rs
│       ├── pty.rs
│       ├── shell.rs
│       ├── path.rs
│       └── process.rs
│
├── services/
│   ├── workspace_manager.rs
│   ├── terminal_manager.rs
│   ├── shell_manager.rs
│   ├── process_manager.rs
│   ├── layout_manager.rs
│   └── config_manager.rs
│
├── state/
│   ├── app_state.rs
│   ├── runtime_state.rs
│   └── settings_state.rs
│
├── error.rs
├── lib.rs
└── main.rs
```

---

# 9. Domain Model

## 9.1 Workspace

```rust
pub struct Workspace {
    pub id: WorkspaceId,
    pub name: String,
    pub description: Option<String>,
    pub icon: Option<String>,
    pub color: Option<String>,
    pub tags: Vec<String>,
    pub group_id: Option<WorkspaceGroupId>,
    pub root_directory: WorkspacePath,
    pub default_shell_profile_id: ShellProfileId,
    pub terminal_definitions: Vec<TerminalDefinition>,
    pub startup_actions: Vec<StartupAction>,
    pub commands: Vec<WorkspaceCommand>,
    pub layout: WorkspaceLayout,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_opened_at: Option<DateTime<Utc>>,
    pub open_count: u64,
    pub pinned: bool,
    pub favorite: bool,
}
```

## 9.2 Terminal Definition

Terminal Definition 代表可以被重新建立的 Terminal 設定。

它不是 Runtime Terminal。

```rust
pub struct TerminalDefinition {
    pub id: TerminalDefinitionId,
    pub name: String,
    pub profile_id: TerminalProfileId,
    pub working_directory: Option<WorkspacePath>,
    pub command: Option<String>,
    pub arguments: Vec<String>,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub startup_mode: TerminalStartupMode,
    pub auto_start: bool,
}
```

## 9.3 Terminal Runtime

Terminal Runtime 僅存在於記憶體中。

```rust
pub struct TerminalRuntime {
    pub id: TerminalRuntimeId,
    pub workspace_id: WorkspaceId,
    pub definition_id: Option<TerminalDefinitionId>,
    pub process_id: Option<u32>,
    pub status: TerminalStatus,
    pub cols: u16,
    pub rows: u16,
    pub started_at: DateTime<Utc>,
}
```

## 9.4 Shell Profile

```rust
pub struct ShellProfile {
    pub id: ShellProfileId,
    pub name: String,
    pub shell_type: ShellType,
    pub executable: String,
    pub arguments: Vec<String>,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub working_directory_strategy: WorkingDirectoryStrategy,
    pub platform: SupportedPlatform,
}
```

## 9.5 Terminal Profile

Terminal Profile 可代表 Shell、AI Agent 或自訂工具。

```rust
pub struct TerminalProfile {
    pub id: TerminalProfileId,
    pub name: String,
    pub category: TerminalProfileCategory,
    pub shell_profile_id: ShellProfileId,
    pub executable: Option<String>,
    pub arguments: Vec<String>,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub icon: Option<String>,
    pub color: Option<String>,
}
```

```rust
pub enum TerminalProfileCategory {
    Shell,
    AiAgent,
    DevelopmentServer,
    Database,
    Container,
    Remote,
    Custom,
}
```

## 9.6 Workspace Layout

```rust
pub struct WorkspaceLayout {
    pub root: LayoutNode,
}
```

```rust
pub enum LayoutNode {
    Terminal {
        terminal_definition_id: TerminalDefinitionId,
    },
    Split {
        direction: SplitDirection,
        ratio: f32,
        first: Box<LayoutNode>,
        second: Box<LayoutNode>,
    },
    Tabs {
        terminal_definition_ids: Vec<TerminalDefinitionId>,
        active_terminal_definition_id: Option<TerminalDefinitionId>,
    },
}
```

---

# 10. Workspace Runtime Model

設定資料與 Runtime State 必須分離。

```text
Persistent Workspace
        │
        ▼
Workspace Definition
        │
        ▼
Open Workspace Runtime
        │
        ├── Terminal Runtime A
        ├── Terminal Runtime B
        ├── Terminal Runtime C
        └── Layout Runtime
```

`Workspace` 是持久化資料。

`WorkspaceRuntime` 是當次開啟產生的執行狀態。

```rust
pub struct WorkspaceRuntime {
    pub workspace_id: WorkspaceId,
    pub opened_at: DateTime<Utc>,
    pub terminal_ids: Vec<TerminalRuntimeId>,
    pub status: WorkspaceRuntimeStatus,
}
```

關閉 Workspace 時：

1. 終止或保留 Terminal Process。
2. 清除 Runtime State。
3. 保留 Workspace Configuration。
4. 更新最近開啟時間與使用次數。
5. 不預設保存 Process Session。

---

# 11. Terminal Architecture

## 11.1 Terminal Lifecycle

```text
Create Terminal Request
        │
        ▼
Resolve Terminal Definition
        │
        ▼
Resolve Shell Profile
        │
        ▼
Resolve Working Directory
        │
        ▼
Resolve Platform Adapter
        │
        ▼
Spawn PTY Process
        │
        ▼
Register Runtime
        │
        ▼
Stream Output to Frontend
        │
        ▼
Receive Input and Resize
        │
        ▼
Exit or Terminate
        │
        ▼
Remove Runtime
```

## 11.2 Terminal Manager Responsibilities

Terminal Manager 負責：

* 建立 Terminal
* 關閉 Terminal
* 重新啟動 Terminal
* 寫入 stdin
* 發送 resize
* 接收 stdout
* 接收 exit event
* 記錄 Terminal Runtime
* 將 output 推送至前端
* 防止同一 Terminal Runtime ID 重複
* 處理異常終止

## 11.3 Output Streaming

Terminal Output 不應透過頻繁的 invoke response 傳送。

建議使用：

* Tauri Event
* Tauri Channel
* Stream-based IPC

事件範例：

```text
terminal://output/{terminal_runtime_id}
terminal://exit/{terminal_runtime_id}
terminal://error/{terminal_runtime_id}
terminal://status/{terminal_runtime_id}
```

Output 應使用 byte buffer 或 UTF-8-safe chunk。

必須考慮：

* ANSI Escape Sequence 被拆分
* UTF-8 多位元字元被拆分
* 高頻輸出
* 前端處理速度
* Backpressure
* 大量 log

## 11.4 Input Flow

```text
xterm.js
   │
   ▼
terminal_write IPC
   │
   ▼
Terminal Manager
   │
   ▼
PTY stdin
```

## 11.5 Resize Flow

```text
xterm.js FitAddon
   │
   ▼
cols / rows
   │
   ▼
terminal_resize IPC
   │
   ▼
PTY resize
```

Resize 應做 debounce，避免視窗拖曳期間過度呼叫。

---

# 12. Process Management

## 12.1 Process Registry

Rust Core 必須維護 Process Registry。

```rust
pub struct ProcessRegistry {
    terminals: HashMap<TerminalRuntimeId, ManagedTerminalProcess>,
}
```

每個 Managed Process 應保存：

* Runtime ID
* Workspace ID
* PTY Handle
* Writer Handle
* Child Handle
* PID
* Status
* Spawn Time
* Exit Code
* Cancellation Token

## 12.2 Process Termination

關閉 Terminal 時應依序：

1. 嘗試優雅結束。
2. 等待短暫 Grace Period。
3. 若仍執行則強制終止。
4. 關閉 PTY Handle。
5. 清理 Registry。
6. 發送 Exit Event。

## 12.3 App Shutdown

應用程式關閉時必須：

1. 標記 Runtime 進入 Shutdown。
2. 停止接受新 Process。
3. 終止所有 Managed Process。
4. Flush 設定。
5. 清除 Lock。
6. 完成關閉。

不得讓 orphan process 無意留在背景。

未來可加入設定：

```text
On App Close:
- Terminate all
- Ask every time
- Keep selected processes
```

但 MVP 預設終止所有由 Turtorge 建立的 Process。

---

# 13. Shell Abstraction

## 13.1 Shell Adapter Interface

```rust
pub trait ShellAdapter: Send + Sync {
    fn shell_type(&self) -> ShellType;

    fn build_spawn_request(
        &self,
        context: &ShellLaunchContext,
    ) -> Result<ProcessSpawnRequest, TurtorgeError>;

    fn normalize_working_directory(
        &self,
        path: &WorkspacePath,
    ) -> Result<PathBuf, TurtorgeError>;

    fn is_available(&self) -> bool;

    fn display_name(&self) -> String;
}
```

## 13.2 Supported Shells

Windows MVP：

* PowerShell 7
* Windows PowerShell 5.1
* WSL2
* Git Bash
* CMD
* Custom Executable

Future macOS：

* zsh
* bash
* fish
* Custom Shell

Future Linux：

* bash
* zsh
* fish
* Custom Shell

## 13.3 Shell Detection

Turtorge 啟動時應偵測：

* `pwsh.exe`
* `powershell.exe`
* `wsl.exe`
* 已安裝的 WSL Distributions
* Git Bash
* CMD
* 可用 SSH Client

偵測結果不應每次切換 Workspace 都重新執行。

應建立可重新整理的 Shell Capability Cache。

---

# 14. WSL Architecture

WSL 是 Windows 版本的核心能力。

## 14.1 WSL Profile

```rust
pub struct WslShellProfile {
    pub distribution: Option<String>,
    pub user: Option<String>,
    pub shell: Option<String>,
    pub login_shell: bool,
}
```

範例：

```yaml
shell:
  type: wsl
  distribution: Ubuntu-24.04
  shell: zsh
  login_shell: true
```

## 14.2 WSL Launch

概念指令：

```text
wsl.exe
-d Ubuntu-24.04
--cd /home/eddy/projects/wallet
--exec zsh -l
```

實際參數應根據 Windows 與 WSL 版本能力調整。

## 14.3 WSL Path Mapping

必須支援：

```text
Windows:
C:\Projects\Wallet
```

轉換為：

```text
WSL:
/mnt/c/Projects/Wallet
```

以及：

```text
WSL:
\\wsl$\Ubuntu-24.04\home\eddy\wallet
```

但不應假設所有 WSL 路徑都可以安全轉換成 Windows Path。

應提供：

```rust
pub enum WorkspacePath {
    Windows(PathBuf),
    Wsl {
        distribution: Option<String>,
        path: String,
    },
    Unix(PathBuf),
    Portable(String),
}
```

Workspace Path 不應只使用單純 String。

## 14.4 WSL Shell Switching

同一 Workspace 可存在：

* PowerShell Terminal
* WSL zsh Terminal
* Git Bash Terminal

Workspace 本身不綁定單一 Shell。

`default_shell_profile_id` 僅代表新增 Terminal 時的預設值。

---

# 15. Platform Abstraction Layer

```rust
pub trait PlatformAdapter: Send + Sync {
    fn platform(&self) -> SupportedPlatform;

    fn detect_shells(&self) -> Result<Vec<ShellCapability>, TurtorgeError>;

    fn spawn_terminal(
        &self,
        request: ProcessSpawnRequest,
    ) -> Result<SpawnedTerminal, TurtorgeError>;

    fn normalize_path(
        &self,
        path: &WorkspacePath,
    ) -> Result<PathBuf, TurtorgeError>;

    fn resolve_home_directory(&self) -> Result<PathBuf, TurtorgeError>;

    fn open_external_editor(
        &self,
        request: OpenEditorRequest,
    ) -> Result<(), TurtorgeError>;
}
```

平台實作：

```text
WindowsPlatformAdapter
MacOsPlatformAdapter
LinuxPlatformAdapter
```

Domain Service 不得直接使用：

```rust
std::os::windows
```

或：

```rust
std::os::unix
```

這類平台 API。

它們必須被封裝於 Platform Adapter。

---

# 16. macOS Future Support

macOS 不在 MVP 範圍，但架構必須從第一天預留。

## 16.1 Native macOS Requirements

未來 macOS 版本應原生支援：

* Apple Silicon
* Intel Mac
* zsh
* bash
* fish
* Native PTY
* Homebrew Environment
* macOS Filesystem
* macOS Clipboard
* macOS Application Bundle
* Code Signing
* Notarization

## 16.2 macOS Architecture Constraints

Windows-specific 邏輯不得進入：

* Domain Models
* Workspace Models
* Layout Models
* Manifest Schema
* Terminal Profile Schema

Workspace Manifest 應能在 Windows、macOS 與 Linux 共用。

## 16.3 Platform-specific Manifest Values

Manifest 可允許平台覆寫：

```yaml
name: Wallet

working_directory: ${workspaceRoot}

shell:
  default: auto

platforms:
  windows:
    shell: wsl-ubuntu-zsh

  macos:
    shell: zsh

  linux:
    shell: zsh
```

平台覆寫不是 MVP 必須功能，但 Schema 設計應避免阻止此能力。

---

# 17. Workspace Persistence

## 17.1 Storage Location

Windows 建議：

```text
%APPDATA%\Turtorge\
```

或：

```text
%LOCALAPPDATA%\Turtorge\
```

需區分：

* Roaming Settings
* Machine-local Runtime Data

建議：

```text
%APPDATA%\Turtorge\
├── settings.json
├── profiles.json
└── workspaces.json

%LOCALAPPDATA%\Turtorge\
├── logs/
├── cache/
├── runtime/
└── crash/
```

macOS Future：

```text
~/Library/Application Support/Turtorge/
```

Linux Future：

```text
~/.config/turtorge/
```

## 17.2 JSON Storage

MVP 建議使用：

```text
settings.json
profiles.json
workspaces.json
```

每個檔案包含 Schema Version。

```json
{
  "schemaVersion": 1,
  "data": []
}
```

寫入流程必須：

1. 序列化至暫存檔。
2. Flush。
3. Atomic Rename。
4. 保留前一版 Backup。

避免應用程式中斷導致設定損毀。

## 17.3 Future SQLite Migration

未來若需要：

* 大量 Workspace
* 搜尋
* Usage Analytics
* Command History
* Plugin Data
* Snapshot
* Sync Metadata

可遷移至 SQLite。

Domain Repository Interface 不應依賴 JSON。

```rust
pub trait WorkspaceRepository {
    async fn list(&self) -> Result<Vec<Workspace>, TurtorgeError>;
    async fn find(&self, id: WorkspaceId) -> Result<Option<Workspace>, TurtorgeError>;
    async fn save(&self, workspace: &Workspace) -> Result<(), TurtorgeError>;
    async fn delete(&self, id: WorkspaceId) -> Result<(), TurtorgeError>;
}
```

---

# 18. Workspace Manifest

## 18.1 File Name

```text
.turtorge.yml
```

## 18.2 Manifest Purpose

Workspace Manifest 用於：

* 專案自描述
* 團隊分享
* 快速匯入
* 跨機器重建
* 跨平台重建
* Version Control

## 18.3 Example

```yaml
version: 1

name: Wallet
description: Wallet aggregation backend

working_directory: ${workspaceRoot}

default_shell: wsl-ubuntu-zsh

environment:
  APP_ENV: local

terminals:
  - id: claude
    name: Claude Code
    profile: claude-code
    shell: wsl-ubuntu-zsh
    working_directory: ${workspaceRoot}
    command: claude
    auto_start: true

  - id: codex
    name: Codex
    profile: codex
    shell: wsl-ubuntu-zsh
    working_directory: ${workspaceRoot}
    command: codex
    auto_start: false

  - id: artisan
    name: Laravel
    shell: wsl-ubuntu-zsh
    command: php artisan serve
    auto_start: true

  - id: shell
    name: Shell
    shell: powershell
    working_directory: ${workspaceRoot}
    auto_start: true

startup:
  - name: Start containers
    shell: wsl-ubuntu-zsh
    command: docker compose up -d
    blocking: true

commands:
  - id: migrate
    name: Run migrations
    shell: wsl-ubuntu-zsh
    command: php artisan migrate

  - id: test
    name: Run tests
    shell: wsl-ubuntu-zsh
    command: php artisan test

layout:
  type: split
  direction: horizontal
  ratio: 0.5
  first:
    type: tabs
    terminals:
      - claude
      - codex
  second:
    type: split
    direction: vertical
    ratio: 0.6
    first:
      type: terminal
      terminal: artisan
    second:
      type: terminal
      terminal: shell
```

## 18.4 Import Rules

匯入 `.turtorge.yml` 時：

1. 驗證 Schema Version。
2. 驗證必要欄位。
3. 檢查 Shell Profile 是否存在。
4. 檢查 Working Directory。
5. 檢查 Command 是否可能存在。
6. 顯示 Import Preview。
7. 允許使用者修改 Shell Mapping。
8. 建立 Local Workspace Record。

Manifest 不應保存：

* Token
* API Key
* Password
* Private Key
* Secret Environment Variable

Secrets 必須由本機安全儲存提供。

---

# 19. Security Architecture

## 19.1 Command Execution

Turtorge 是可執行任意 Shell Command 的工具。

因此必須明確區分：

* 使用者建立的 Command
* 本機 Workspace Command
* Repository Manifest Command
* 外部匯入 Command

首次匯入 Repository Manifest 時，所有 Startup Command 必須顯示給使用者確認。

不得因為開啟資料夾就自動執行未知 Command。

## 19.2 Trust Model

Workspace 應有 Trust Status：

```rust
pub enum WorkspaceTrustStatus {
    Trusted,
    Untrusted,
    PendingReview,
}
```

Untrusted Workspace：

* 不自動執行 Startup Action。
* 不自動啟動 AI Agent。
* 不載入未知 Plugin。
* 不注入敏感 Environment Variable。

## 19.3 Secrets

Secrets 不應保存於：

* Workspace JSON
* `.turtorge.yml`
* Command History
* Log

未來可使用：

Windows：

* Windows Credential Manager

macOS：

* Keychain

Linux：

* Secret Service

## 19.4 Tauri Capabilities

Tauri Capability 必須使用最小權限原則。

前端不應取得：

* 任意 filesystem 權限
* 任意 shell execute 權限
* 任意 process spawn 權限

所有操作必須透過 Rust Command 驗證。

---

# 20. IPC API

## 20.1 Workspace Commands

```text
workspace_list
workspace_get
workspace_create
workspace_update
workspace_delete
workspace_open
workspace_close
workspace_duplicate
workspace_import_manifest
workspace_export_manifest
workspace_mark_favorite
workspace_pin
```

## 20.2 Terminal Commands

```text
terminal_create
terminal_start
terminal_restart
terminal_write
terminal_resize
terminal_close
terminal_kill
terminal_list_runtime
terminal_get_status
```

## 20.3 Profile Commands

```text
profile_list_shells
profile_list_terminals
profile_create
profile_update
profile_delete
profile_detect
```

## 20.4 Settings Commands

```text
settings_get
settings_update
settings_reset
```

## 20.5 Platform Commands

```text
platform_get_info
platform_detect_shells
platform_list_wsl_distributions
platform_select_directory
platform_validate_path
platform_open_external_editor
```

---

# 21. Event Model

```text
workspace://opened
workspace://closed
workspace://updated
workspace://error

terminal://created
terminal://started
terminal://output
terminal://status
terminal://exit
terminal://error
terminal://removed

profile://detected
profile://updated

application://shutdown
application://error
```

每個 Event Payload 應包含：

```rust
pub struct EventEnvelope<T> {
    pub version: u32,
    pub event_id: Uuid,
    pub timestamp: DateTime<Utc>,
    pub payload: T,
}
```

---

# 22. Frontend Architecture

## 22.1 Feature Structure

```text
src/features/
├── workspaces/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── types/
│
├── terminals/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── types/
│
├── profiles/
├── settings/
├── commands/
└── layout/
```

## 22.2 State Ownership

Rust Core 是持久化資料與 Runtime Process 的 Source of Truth。

Frontend Store 只保存：

* 目前選取的 Workspace
* UI Panel 狀態
* Dialog 狀態
* Layout View State
* Terminal Component Reference
* 尚未提交的 Form State
* Runtime Status Cache

Workspace 或 Terminal 異動成功後，以 Rust Response 或 Event 更新前端。

## 22.3 Terminal Component

每個 Terminal View 包含：

```text
TerminalPanel
├── TerminalHeader
├── TerminalToolbar
├── XtermCanvas
├── StatusIndicator
└── ErrorOverlay
```

Terminal Panel 不負責 spawn process。

Mount 時：

1. 建立 xterm instance。
2. 訂閱 Terminal Output Event。
3. 設定 input handler。
4. 設定 resize handler。
5. 呼叫 Terminal Start 或 Attach Runtime。

Unmount 時：

1. 取消 Event Subscription。
2. Dispose xterm instance。
3. 不直接假設要終止 Process。
4. 由 Workspace Runtime Policy 決定 Process 是否保留。

---

# 23. Layout Architecture

MVP Layout 支援：

* Single Terminal
* Tabs
* Horizontal Split
* Vertical Split
* Nested Split

Layout 應保存 Terminal Definition ID，而非 Runtime ID。

```text
Persistent Layout
        │
        ▼
Terminal Definition IDs
        │
        ▼
Open Workspace
        │
        ▼
Generate Terminal Runtime IDs
```

如此重新開啟 Workspace 時可以重新建立相同 Layout。

---

# 24. Startup Action Architecture

## 24.1 Startup Action Types

```rust
pub enum StartupActionType {
    RunCommand,
    StartTerminal,
    OpenExternalEditor,
    WaitForPort,
    WaitForProcess,
    Delay,
}
```

MVP 僅需：

* RunCommand
* StartTerminal
* OpenExternalEditor, optional

## 24.2 Execution Policy

Startup Action 應支援：

```rust
pub struct StartupAction {
    pub id: StartupActionId,
    pub name: String,
    pub action_type: StartupActionType,
    pub shell_profile_id: Option<ShellProfileId>,
    pub command: Option<String>,
    pub working_directory: Option<WorkspacePath>,
    pub blocking: bool,
    pub continue_on_error: bool,
    pub timeout_seconds: Option<u64>,
}
```

執行流程：

```text
Validate Workspace Trust
        │
        ▼
Resolve Shell
        │
        ▼
Resolve Working Directory
        │
        ▼
Execute Action
        │
        ├── Success → Continue
        └── Failure
             ├── continue_on_error → Continue
             └── Stop Startup
```

---

# 25. External Editor Integration

Turtorge 不建立 Code Editor，但應支援快速開啟外部編輯器。

候選：

* VS Code
* Cursor
* Zed
* JetBrains IDE
* Custom Executable

```rust
pub struct ExternalEditorProfile {
    pub id: ExternalEditorProfileId,
    pub name: String,
    pub executable: String,
    pub arguments_template: Vec<String>,
    pub platform: SupportedPlatform,
}
```

範例：

```text
code ${workspaceRoot}
cursor ${workspaceRoot}
zed ${workspaceRoot}
```

Workspace 可設定預設 Editor。

---

# 26. Error Handling

所有 Rust Error 應統一為：

```rust
pub enum TurtorgeError {
    WorkspaceNotFound,
    TerminalNotFound,
    ShellNotFound,
    ShellUnavailable,
    InvalidWorkingDirectory,
    ProcessSpawnFailed,
    ProcessWriteFailed,
    ProcessResizeFailed,
    ProcessTerminationFailed,
    StorageReadFailed,
    StorageWriteFailed,
    ManifestInvalid,
    ManifestUnsupportedVersion,
    WorkspaceUntrusted,
    PlatformUnsupported,
    Internal,
}
```

傳給前端的 Error 不應包含：

* Stack Trace
* Secret
* Token
* 未過濾的 Environment Variable

IPC Error：

```rust
pub struct ApiError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}
```

---

# 27. Logging and Diagnostics

使用：

* `tracing`
* `tracing-subscriber`

Log Level：

* ERROR
* WARN
* INFO
* DEBUG
* TRACE

正式版預設：

```text
INFO
```

不得記錄：

* Terminal 完整輸入
* Password
* API Token
* Secret Environment Variable
* SSH Private Key
* Claude/Codex Prompt Content

可記錄：

* Workspace Open
* Terminal Spawn
* Process Exit
* Shell Detection
* Storage Migration
* Error Code
* Duration
* Runtime ID

應提供 Diagnostic Export：

```text
diagnostics.zip
├── app-info.json
├── platform-info.json
├── shell-capabilities.json
├── redacted-settings.json
└── logs/
```

---

# 28. Performance Requirements

MVP 目標：

* 冷啟動至可操作畫面：小於 2 秒
* Workspace 清單顯示：小於 500 毫秒
* Terminal 建立至出現 Prompt：小於 1 秒
* Workspace 切換 UI：小於 200 毫秒
* Terminal Input 延遲：不可有明顯感知
* Terminal Output：支援大量持續輸出
* Idle Memory：盡量低於 Electron 類型工具
* 多 Terminal：至少穩定支援 12 個同時執行

Terminal Output 不應直接寫入全域 React State。

應直接推送到對應 xterm instance，避免高頻重繪。

---

# 29. Concurrency Model

Rust Core 建議採用 Tokio Runtime。

每個 Terminal：

* 一個 Output Reader Task
* 一個 Process Wait Task
* 共用或受保護的 Input Writer
* 一個 Cancellation Token

共享狀態：

```rust
Arc<RwLock<AppRuntimeState>>
```

但避免持有全域 Lock 進行：

* PTY Read
* Process Wait
* Disk I/O
* Event Emit

Registry 查詢與 Process I/O 應分離，避免 Lock Contention。

---

# 30. Testing Strategy

## 30.1 Unit Tests

測試：

* Workspace Validation
* Layout Serialization
* Path Resolution
* WSL Path Mapping
* Profile Resolution
* Manifest Parsing
* Manifest Migration
* Startup Action Ordering
* Error Mapping

## 30.2 Integration Tests

測試：

* PowerShell Spawn
* WSL Spawn
* Terminal Input / Output
* Terminal Resize
* Process Exit
* Process Kill
* Workspace Open
* Workspace Close
* Settings Persistence
* Manifest Import

## 30.3 Frontend Tests

使用：

* Vitest
* React Testing Library

測試：

* Workspace Sidebar
* Terminal Panel
* Workspace Form
* Profile Form
* Layout Rendering
* Error State
* Runtime Status

## 30.4 End-to-End Tests

候選：

* Playwright
* Tauri-compatible E2E tooling

核心流程：

1. 建立 Workspace。
2. 選擇 WSL。
3. 指定目錄。
4. 建立 Claude Terminal。
5. 建立一般 Terminal。
6. 保存 Workspace。
7. 關閉應用程式。
8. 重新開啟。
9. 快速恢復 Workspace。
10. 驗證 Layout 與標籤存在。

---

# 31. Build and Release

## 31.1 Windows MVP

Build Targets：

* Windows x86_64
* Windows ARM64, future

Installer：

* MSI
* NSIS

應支援：

* Auto Update
* Code Signing
* Crash-safe Settings
* Uninstall Cleanup Policy

## 31.2 macOS Future

Build Targets：

* Apple Silicon
* Intel

Release Requirements：

* `.app`
* `.dmg`
* Code Signing
* Apple Notarization
* Universal Binary, optional

## 31.3 Linux Future

候選：

* AppImage
* `.deb`
* Flatpak

---

# 32. Versioning and Migration

## 32.1 Application Version

使用 Semantic Versioning：

```text
MAJOR.MINOR.PATCH
```

## 32.2 Schema Version

Workspace、Settings 與 Manifest 必須各自保存 Schema Version。

```json
{
  "schemaVersion": 1
}
```

Migration 必須：

* 可重複執行
* 不破壞舊資料
* 失敗時保留 Backup
* 寫入前完成驗證

---

# 33. Architecture Decision Records

重要決策應保存於：

```text
docs/ADR/
```

建議初始 ADR：

```text
ADR-0001-use-tauri-v2.md
ADR-0002-rust-owns-process-lifecycle.md
ADR-0003-use-xterm-js-for-terminal-rendering.md
ADR-0004-stateless-workspace-by-default.md
ADR-0005-json-storage-for-mvp.md
ADR-0006-platform-abstraction-layer.md
ADR-0007-workspace-manifest-format.md
ADR-0008-ai-agents-as-terminal-profiles.md
```

---

# 34. MVP Implementation Boundaries

MVP 必須完成：

* Tauri + React Desktop App
* Rust Terminal Core
* PowerShell Support
* WSL Support
* Working Directory Selection
* Workspace CRUD
* Workspace Tags
* Workspace Groups
* Favorite / Pin
* Terminal Profile
* General Terminal
* Claude Code Profile
* Codex Profile
* Multiple Terminals in One Window
* Tabs
* Split Layout
* Workspace Layout Persistence
* Workspace Quick Open
* Recent Workspace
* JSON Persistence
* Basic Shell Detection
* Safe Process Shutdown

MVP 可以延後：

* `.turtorge.yml`
* Git Awareness
* Docker Awareness
* Command Palette
* Plugin System
* Session Snapshot
* macOS Build
* Linux Build
* Cloud Sync
* Shared Workspace
* Secure Secret Storage
* Automatic Agent Detection

---

# 35. Suggested Implementation Order

## Phase 1：Application Skeleton

* 建立 Rust Workspace。
* 建立 Tauri v2 專案。
* 建立 React + TypeScript 前端。
* 建立 IPC 基礎。
* 建立 Error Model。
* 建立 Logging。
* 建立 App State。

## Phase 2：Single Terminal Prototype

* 整合 xterm.js。
* Rust 建立 PowerShell PTY。
* Output Stream 至前端。
* Input 傳回 PTY。
* Resize。
* Exit。
* Kill。

## Phase 3：WSL Support

* 偵測 WSL。
* 列出 Distribution。
* 支援指定 Distribution。
* 支援 zsh / bash。
* 支援 WSL Working Directory。
* 建立 Path Abstraction。

## Phase 4：Workspace Core

* Workspace Domain。
* Workspace Repository。
* Workspace CRUD。
* Recent / Favorite / Pin。
* Workspace Sidebar。
* Workspace Open / Close。

## Phase 5：Multiple Terminals

* Terminal Registry。
* 多 Terminal Runtime。
* Tabs。
* Split Layout。
* Terminal Definition。
* Layout Persistence。

## Phase 6：Profiles

* Shell Profile。
* Terminal Profile。
* Claude Code。
* Codex。
* Custom Command。
* Profile Detection。

## Phase 7：Workspace Restore

* 保存 Terminal Definition。
* 保存 Layout。
* 重新建立 Terminal。
* Auto-start Policy。
* Startup Error Handling。

## Phase 8：Hardening

* Process Cleanup。
* Crash-safe Storage。
* Trust Model。
* Integration Tests。
* Installer。
* Auto Update。
* Code Signing。

## Phase 9：Cross-platform Preparation

* 移除 Windows-specific Domain Coupling。
* 完成 Platform Adapter。
* 加入 macOS compile target。
* 建立 macOS PTY Prototype。
* 驗證 Manifest 與 Layout 可跨平台使用。

---

# 36. Open Technical Questions

在正式開發前需要進行 Spike：

1. 哪個 Rust PTY crate 對 Windows ConPTY 最穩定？
2. Tauri Event 或 Channel 哪個更適合高頻 Terminal Output？
3. xterm.js 與 Rust PTY 之間是否需要自訂 byte framing？
4. WSL `--cd` 在支援版本中的相容性如何？
5. PowerShell 5.1 與 PowerShell 7 是否共用啟動邏輯？
6. Git Bash 是否應由 Turtorge 自動偵測安裝路徑？
7. Workspace 關閉時是否立即終止所有 Process？
8. Layout Library 採用現成方案或自建 Tree Model？
9. MVP 儲存拆成多個 JSON，還是單一資料檔？
10. Terminal Scrollback 是否完全交由 xterm.js 管理？
11. 如何避免高速輸出阻塞 Tauri IPC？
12. Windows App Close 時如何確保 Child Process 完整回收？
13. 是否需要 Windows Job Object 管理 Process Tree？
14. WSL 內部啟動的 Process 如何安全終止？
15. macOS PTY 實作能否共用同一 Terminal Manager？

---

# 37. Definition of Done for Architecture v0.1

架構 v0.1 被視為成立，必須證明：

* 可在 Windows 原生啟動 Turtorge。
* 可建立 PowerShell Terminal。
* 可建立 WSL zsh Terminal。
* 可同時執行兩個以上 Terminal。
* 可傳送輸入。
* 可正確渲染 ANSI Output。
* 可調整 Terminal Size。
* 可正常關閉 Process。
* 可建立 Workspace。
* 可保存 Workspace 名稱、標籤與目錄。
* 可保存 Terminal Definition。
* 可重新開啟 Workspace。
* 不需要保存 Terminal Session。
* Workspace 能依設定重新建立 Terminal。
* Domain Layer 不直接依賴 Windows API。
* Platform Adapter 邊界已建立。
* 架構不阻止未來加入原生 macOS 支援。

---

# 38. Final Architecture Statement

Turtorge 的核心不是 Terminal Emulator。

它的核心是：

> **一個由 Rust 驅動的 Workspace Runtime。**

Terminal 是 Workspace 的操作介面。

PowerShell、WSL、zsh 與 AI Agent 都只是 Workspace 中可替換的執行環境。

React 負責呈現。

Rust 負責控制。

平台差異由 Platform Layer 吸收。

Workspace Configuration 必須能夠跨時間、跨 Shell，並在未來跨 Windows、macOS 與 Linux 重建。

> **Turtorge doesn't replace your tools. It gives them a home.**
