# Turtorge UI Specification

Version: 0.1.0
Status: Draft
Primary Platform: Windows
Future Platforms: macOS, Linux
Frontend: React + TypeScript
Desktop Framework: Tauri v2
Terminal Renderer: xterm.js

---

# 1. Document Purpose

本文件定義 Turtorge Desktop Application 的：

* 資訊架構
* 畫面結構
* 使用者操作流程
* Workspace 管理介面
* Terminal 管理介面
* Shell 與 Profile 設定介面
* 明暗主題系統
* 鍵盤操作
* 錯誤與空狀態
* 響應式與視窗行為
* Accessibility
* MVP UI 實作範圍

本文件描述的是產品介面與互動規格，不定義 Rust Core、PTY 或 Process Lifecycle 的具體實作。

相關文件：

* `PRD.md`
* `ARCHITECTURE.md`
* `ROADMAP.md`

---

# 2. Product UI Principle

Turtorge 的核心不是開啟 Terminal。

而是：

> **快速進入一個已定義的開發 Workspace。**

UI 必須讓使用者主要以 Project 與 Workspace 為思考單位，而不是以 Shell Window、Agent Window 或 Terminal Process 為單位。

主要操作模型：

```text
選擇 Workspace
        │
        ▼
恢復 Layout
        │
        ▼
建立所需 Terminal
        │
        ▼
開始工作
```

使用者不應需要重新記住：

* 專案在哪個路徑
* 要使用 PowerShell 或 WSL
* Claude Code 要在哪裡啟動
* Codex 要在哪裡啟動
* 哪些開發服務需要開啟
* Terminal 應如何排列

---

# 3. UX Goals

Turtorge UI 必須達成以下目標：

1. 使用者能在一秒內找到常用 Workspace。
2. 使用者能在五秒內重新建立主要開發環境。
3. 使用者能在同一個 Window 管理多個 Terminal。
4. 使用者能清楚辨識每個 Terminal 的用途。
5. 使用者能快速切換 PowerShell、WSL 與其他 Shell。
6. 使用者不需要理解 AI Agent 特殊模型。
7. 使用者能自由新增一般 Terminal。
8. Workspace 切換不應導致視覺混亂。
9. 明暗模式應符合使用者作業系統設定。
10. 所有主要操作必須可由鍵盤完成。
11. Terminal Output 不應造成整體 UI 頻繁重繪。
12. UI 不應嘗試取代 IDE 或完整 DevOps Dashboard。

---

# 4. Design Principles

## 4.1 Workspace First

Workspace 是 UI 的主要導航單位。

Sidebar 第一層應呈現 Workspace，而不是 Terminal、Shell 或 Agent。

```text
Workspaces
├── Wallet
├── Notify
├── CMS
├── Infrastructure
└── FrozenHeart
```

點擊 Workspace 後，主畫面顯示該 Workspace 的 Terminal Layout。

---

## 4.2 Terminal Is a Tool Surface

每個 Terminal 都必須具備明確名稱。

禁止只顯示：

```text
PowerShell
PowerShell
PowerShell
Ubuntu
Ubuntu
```

應顯示：

```text
Claude Code
Codex
Laravel Server
Queue Worker
Database Shell
Kubernetes
```

Shell 類型可以作為次要資訊顯示。

---

## 4.3 Progressive Disclosure

常用操作直接顯示。

進階設定收納於：

* Context Menu
* Workspace Settings
* Terminal Settings
* Application Settings
* Command Palette

主畫面不可因為放入太多設定而變成管理後台。

---

## 4.4 Keyboard First, Mouse Friendly

所有重要功能均應具備快捷鍵。

但不可要求使用者必須熟悉快捷鍵才能使用。

每個快捷鍵應能在：

* Tooltip
* Menu
* Command Palette

中被發現。

---

## 4.5 Native Desktop Behavior

Turtorge 是 Desktop Application。

應遵循 Windows Desktop 使用習慣：

* 標準視窗控制
* 系統檔案選擇器
* 右鍵選單
* 拖曳調整面板大小
* 滑鼠中鍵關閉 Tab，若適用
* `Ctrl + ,` 開啟設定
* `Ctrl + P` 或 `Ctrl + K` 開啟快速操作
* `Ctrl + Shift + T` 新增 Terminal

未來 macOS 版本應將快捷鍵映射為：

* `Command`
* `Option`

而非直接沿用 Windows 鍵位。

---

# 5. Theme System

## 5.1 Supported Themes

Turtorge 支援三種外觀設定：

```text
System
Light
Dark
```

預設值：

```text
System
```

`System` 模式會跟隨目前作業系統的明暗模式設定。

---

## 5.2 Theme Behavior

當設定為 `System`：

1. 應用程式啟動時讀取系統主題。
2. 系統主題在應用程式執行期間變更時，UI 應即時更新。
3. 不需要重新啟動 Turtorge。
4. Workspace 與 Terminal Runtime 不受主題切換影響。
5. xterm.js Theme 必須同步切換。

當設定為 `Light` 或 `Dark`：

* 忽略系統主題變化。
* 持續使用使用者指定主題。
* 設定應保存至本機。

---

## 5.3 Theme Setting Model

```typescript
type ThemePreference = "system" | "light" | "dark";
```

```typescript
interface AppearanceSettings {
  theme: ThemePreference;
}
```

預設：

```json
{
  "theme": "system"
}
```

---

## 5.4 Theme Resolution

```typescript
type ResolvedTheme = "light" | "dark";
```

邏輯：

```text
Preference = Light
        │
        └── Resolved Theme = Light

Preference = Dark
        │
        └── Resolved Theme = Dark

Preference = System
        │
        └── Read Operating System Theme
```

HTML Root 建議：

```html
<html data-theme="dark">
```

或：

```html
<html class="dark">
```

所有主題切換應由單一 Theme Provider 管理。

---

## 5.5 Color Tokens

禁止在 Feature Component 中大量直接寫入色碼。

應建立語意化 Design Token。

```css
:root {
  --color-app-background: ...;
  --color-surface-primary: ...;
  --color-surface-secondary: ...;
  --color-surface-hover: ...;
  --color-surface-active: ...;

  --color-border-default: ...;
  --color-border-muted: ...;
  --color-border-focus: ...;

  --color-text-primary: ...;
  --color-text-secondary: ...;
  --color-text-muted: ...;
  --color-text-inverse: ...;

  --color-accent: ...;
  --color-accent-hover: ...;
  --color-accent-muted: ...;

  --color-success: ...;
  --color-warning: ...;
  --color-danger: ...;
  --color-info: ...;

  --color-terminal-background: ...;
  --color-terminal-foreground: ...;
  --color-terminal-cursor: ...;
  --color-terminal-selection: ...;
}
```

Component 應使用：

```css
background: var(--color-surface-primary);
```

而不是：

```css
background: #1e1e1e;
```

---

## 5.6 Light Theme Principles

淺色模式應：

* 背景清晰
* Surface 具有低強度層級差異
* 邊框不過度明顯
* Terminal 與應用程式介面有明確區分
* 避免純白大面積刺眼
* 保持長時間開發工作的舒適度

---

## 5.7 Dark Theme Principles

深色模式應：

* 避免使用純黑作為所有背景
* 建立多層 Surface 深度
* Terminal 背景可以比應用程式背景更深
* 保持文字對比
* Accent 不應過度飽和
* 長時間使用時避免視覺疲勞

---

## 5.8 Workspace Custom Colors

Workspace 可設定自訂標籤顏色。

Workspace 顏色僅用於：

* Sidebar 左側色條
* Workspace Icon 背景
* Tag
* Active Workspace Indicator
* Quick Open 結果提示

不可將整個 Workspace 主畫面染成指定顏色。

自訂色需在明暗主題中維持足夠對比。

---

# 6. Application Window Structure

主畫面由以下區域組成：

```text
┌─────────────────────────────────────────────────────────────┐
│ Title Bar / App Toolbar                                     │
├───────────────┬─────────────────────────────────────────────┤
│               │ Workspace Header                            │
│ Workspace     ├─────────────────────────────────────────────┤
│ Sidebar       │                                             │
│               │ Terminal Workspace Area                     │
│               │                                             │
│               │                                             │
├───────────────┴─────────────────────────────────────────────┤
│ Status Bar                                                  │
└─────────────────────────────────────────────────────────────┘
```

主要區塊：

1. Title Bar
2. Workspace Sidebar
3. Workspace Header
4. Terminal Workspace Area
5. Status Bar
6. Dialog Layer
7. Command Palette Layer
8. Context Menu Layer
9. Toast Layer

---

# 7. Title Bar

## 7.1 Purpose

Title Bar 提供：

* Application Identity
* Global Navigation
* Quick Open
* Global Terminal Creation
* Settings
* Window Controls

---

## 7.2 Layout

```text
┌──────────────────────────────────────────────────────────────┐
│ Turtorge  │ Search Workspaces... │ + Terminal │ Settings │ — □ × │
└──────────────────────────────────────────────────────────────┘
```

若採用 Custom Title Bar，必須保留：

* Drag Region
* Minimize
* Maximize / Restore
* Close

不可讓可點擊元件覆蓋 Drag Region。

---

## 7.3 Title Bar Actions

左側：

* Turtorge Logo
* Sidebar Toggle

中間：

* Quick Open Trigger
* Current Workspace Name，視設計選擇

右側：

* New Terminal
* Command Palette
* Settings
* Window Controls

---

# 8. Workspace Sidebar

## 8.1 Purpose

Workspace Sidebar 是主要導航區。

它必須讓使用者快速：

* 找到 Workspace
* 切換 Workspace
* 建立 Workspace
* 開啟最近使用 Workspace
* 管理 Workspace Group
* 釘選 Workspace
* 查看目前 Active Workspace

---

## 8.2 Sidebar Structure

```text
Workspaces                         ＋

Pinned
  Wallet
  Infrastructure

Recent
  Notify
  CMS

Groups
  Backend
    Wallet
    Notify

  Business
    FrozenHeart

──────────────────────────────────

Settings
```

---

## 8.3 Workspace Item

每個 Workspace Item 包含：

```text
[Icon] Workspace Name
       Optional Path or Status
```

可顯示：

* Icon
* Name
* Color Indicator
* Favorite
* Pin
* Missing Directory Warning
* Active Indicator

MVP 不需要在 Sidebar 顯示即時 Git 或 Docker 狀態。

---

## 8.4 Active Workspace

Active Workspace 應具備：

* 明確背景狀態
* 左側 Accent Indicator
* 清楚文字對比
* 不依賴顏色作為唯一辨識方式

---

## 8.5 Sidebar Width

預設寬度：

```text
240px
```

可調整範圍：

```text
180px 至 420px
```

支援：

* 拖曳調整
* Collapse
* 自動保存寬度

收合後顯示 Workspace Icon。

---

## 8.6 Workspace Context Menu

Workspace 右鍵選單：

```text
Open
Open in New Window
Open External Editor
New Terminal
Rename
Duplicate
Pin / Unpin
Favorite / Remove Favorite
Move to Group
Edit Workspace
Reveal in File Explorer
Export Manifest
Delete
```

MVP 可先完成：

* Open
* New Terminal
* Rename
* Pin
* Favorite
* Edit
* Reveal in File Explorer
* Delete

---

## 8.7 Drag and Drop

未來可支援：

* Workspace 排序
* 拖入 Group
* Group 排序

MVP 可以使用選單操作，不強制實作 Drag and Drop。

---

# 9. Empty Application State

當使用者尚未建立 Workspace：

```text
                 Turtorge

      Bring every development workspace home.

          [ Create Workspace ]

          [ Open Folder ]

          [ Import .turtorge.yml ]
```

可提供快速入口：

* Create Workspace
* Open Folder as Workspace
* Import Manifest

不應直接顯示空白 Terminal。

---

# 10. Workspace Header

## 10.1 Purpose

Workspace Header 顯示目前 Workspace 資訊與常用操作。

---

## 10.2 Structure

```text
Wallet
WSL Ubuntu · ~/projects/wallet

[Open Editor] [+ Terminal] [Run Command] [···]
```

顯示內容：

* Workspace Name
* Description，若有
* Root Directory
* Default Shell
* Workspace Status
* 常用操作

---

## 10.3 Header Actions

主要操作：

* New Terminal
* Open External Editor
* Run Workspace Command

次要操作：

* Restart Workspace
* Edit Workspace
* Reveal Folder
* Close Workspace
* Export Manifest
* Delete Workspace

---

# 11. Terminal Workspace Area

## 11.1 Purpose

Terminal Workspace Area 是主要工作區域。

支援：

* Single Terminal
* Terminal Tabs
* Horizontal Split
* Vertical Split
* Nested Split
* Terminal Focus
* Terminal Resize
* Terminal Reopen
* Terminal Rename

---

## 11.2 Layout Examples

### Single Terminal

```text
┌────────────────────────────────────────────┐
│ Claude Code                         ● WSL  │
├────────────────────────────────────────────┤
│                                            │
│ Terminal                                   │
│                                            │
└────────────────────────────────────────────┘
```

### Horizontal Split

```text
┌──────────────────────┬─────────────────────┐
│ Claude Code          │ Codex               │
├──────────────────────┼─────────────────────┤
│                      │                     │
│                      │                     │
└──────────────────────┴─────────────────────┘
```

### Vertical Split

```text
┌────────────────────────────────────────────┐
│ Claude Code                                │
├────────────────────────────────────────────┤
│ Laravel Server                             │
└────────────────────────────────────────────┘
```

### Tabs and Split

```text
┌──────────────────────┬─────────────────────┐
│ Claude | Codex       │ Laravel | Queue     │
├──────────────────────┼─────────────────────┤
│                      │                     │
└──────────────────────┴─────────────────────┘
```

---

# 12. Terminal Panel

## 12.1 Terminal Panel Structure

```text
┌────────────────────────────────────────────┐
│ Terminal Header                            │
├────────────────────────────────────────────┤
│                                            │
│ xterm.js Canvas                            │
│                                            │
├────────────────────────────────────────────┤
│ Optional Inline Status                     │
└────────────────────────────────────────────┘
```

---

## 12.2 Terminal Header

Terminal Header 顯示：

* Icon
* Terminal Name
* Shell Type
* Runtime Status
* Working Directory，Tooltip
* Restart
* Split
* Close
* More Menu

範例：

```text
[AI] Claude Code            WSL · Running    ⟳  Split  ×
```

---

## 12.3 Terminal Status

支援狀態：

```text
Not Started
Starting
Running
Exited
Failed
Stopping
Disconnected
```

視覺規則：

* Running：低干擾狀態
* Starting：Spinner
* Exited：顯示 Exit Code
* Failed：明確錯誤提示
* Stopping：暫時禁用輸入

不可只以顏色傳達狀態。

---

## 12.4 Terminal Name

建立 Terminal 時應要求或自動產生具意義名稱。

預設命名規則：

```text
Terminal
Terminal 2
PowerShell
WSL Ubuntu
Claude Code
Codex
```

使用者可以隨時 Rename。

Terminal 名稱屬於 Terminal Definition，應保存至 Workspace。

---

## 12.5 Terminal Header Menu

```text
Rename
Restart
Duplicate
Split Right
Split Down
Move to New Tab
Change Shell
Change Working Directory
Clear
Copy All
Open Definition Settings
Close Terminal
Kill Process
```

MVP 必須：

* Rename
* Restart
* Split Right
* Split Down
* Clear
* Close
* Kill Process

---

## 12.6 Terminal Focus

目前 Focused Terminal 應有：

* 邊框
* Header Active State
* Focus Ring
* Accessibility State

Focus 不應只依賴背景色。

---

# 13. Terminal Tabs

## 13.1 Tab Structure

```text
Claude Code | Codex | Shell | +
```

Tab 顯示：

* Icon
* Name
* Runtime Status
* Close Button

---

## 13.2 Tab Behavior

支援：

* 點擊切換
* 中鍵關閉，未來
* 拖曳排序，未來
* Context Menu
* Keyboard Navigation
* Overflow Menu

Tab 太多時：

```text
Claude | Codex | Shell | Laravel | +3
```

或提供水平捲動。

---

# 14. Split Layout

## 14.1 Supported Splits

* Split Right
* Split Down
* Nested Split

Split Ratio 預設：

```text
50 / 50
```

支援拖曳調整。

---

## 14.2 Split Persistence

保存：

* Split Direction
* Ratio
* Terminal Definition ID
* Tab Group
* Active Tab

不保存：

* Runtime ID
* Process ID

---

## 14.3 Minimum Panel Size

Terminal Panel 最小尺寸：

```text
Minimum Width: 320px
Minimum Height: 180px
```

若空間不足：

* 禁止繼續 Split
* 顯示簡短提示
* 建議使用 Tab

---

# 15. New Workspace Flow

## 15.1 Entry Points

可從以下位置建立 Workspace：

* Sidebar `+`
* Empty State
* File Menu
* Command Palette
* Open Folder

---

## 15.2 Workspace Creation Steps

### Step 1：Basic Information

欄位：

* Workspace Name
* Description，選填
* Root Directory
* Icon，選填
* Color，選填
* Group，選填

### Step 2：Environment

欄位：

* Default Shell
* WSL Distribution，若使用 WSL
* Shell Executable
* Working Directory
* Environment Variables

### Step 3：Terminals

新增 Terminal Definition：

* Name
* Profile
* Shell
* Working Directory
* Startup Command
* Auto Start

### Step 4：Layout

選擇：

* Single
* Two Columns
* Two Rows
* Tabs
* Custom

### Step 5：Review

顯示：

* Workspace
* Directory
* Shell
* Terminals
* Startup Commands
* Trust Warning，若適用

操作：

```text
Create Workspace
Create and Open
Cancel
```

---

## 15.3 MVP Simplified Flow

MVP 可先使用單頁 Dialog：

```text
Workspace Name
Root Directory
Default Shell
Initial Terminal
```

建立後再由 Workspace Settings 增加 Terminal 與 Layout。

---

# 16. Open Folder as Workspace

使用者選擇資料夾後：

1. 偵測 `.turtorge.yml`。
2. 若存在，提示匯入。
3. 若不存在，建立快速 Workspace。
4. 自動建議 Workspace Name。
5. 使用預設 Shell。
6. 建立一個一般 Terminal。
7. 使用者之後可補充設定。

---

# 17. Workspace Settings

## 17.1 Settings Navigation

```text
General
Environment
Terminals
Startup
Commands
Layout
Appearance
Advanced
```

MVP 可包含：

* General
* Environment
* Terminals
* Layout
* Advanced

---

## 17.2 General

欄位：

* Name
* Description
* Root Directory
* Icon
* Color
* Tags
* Group
* Favorite
* Pinned

---

## 17.3 Environment

欄位：

* Default Shell Profile
* WSL Distribution
* Default Working Directory
* Environment Variables
* Default External Editor

---

## 17.4 Terminals

Terminal Definitions List：

```text
Claude Code        WSL Ubuntu       Auto Start
Codex              WSL Ubuntu       Manual
PowerShell         PowerShell 7     Auto Start
Laravel Server     WSL Ubuntu       Auto Start
```

操作：

* Add
* Edit
* Duplicate
* Delete
* Reorder
* Toggle Auto Start

---

## 17.5 Startup

顯示 Startup Action 執行順序。

```text
1. Docker Compose Up
2. Start Laravel Server
3. Start Queue Worker
4. Open External Editor
```

操作：

* Add
* Edit
* Delete
* Reorder
* Enable / Disable

---

## 17.6 Commands

Workspace Command Library：

```text
Run Tests
Run Migrations
Docker Logs
Queue Restart
Build Frontend
```

點擊後可：

* 在新 Terminal 執行
* 在 Focused Terminal 執行
* 在背景 Process 執行，Future

---

# 18. New Terminal Flow

## 18.1 Quick Create

點擊 `+ Terminal` 後顯示：

```text
Recent Profiles
  Claude Code
  Codex
  PowerShell
  WSL Ubuntu

Workspace Profiles
  Laravel Server
  Queue Worker

All Profiles
  Git Bash
  CMD
  Custom
```

點擊即可建立。

---

## 18.2 Advanced Create

欄位：

* Terminal Name
* Profile
* Shell
* Working Directory
* Command
* Arguments
* Environment Variables
* Save to Workspace
* Auto Start

操作：

```text
Start
Save and Start
Cancel
```

---

# 19. Shell Switcher

Terminal 可切換 Shell。

操作流程：

1. 開啟 Terminal Menu。
2. 選擇 `Change Shell`。
3. 選擇新 Shell Profile。
4. 顯示警告：目前 Process 將終止。
5. 確認後重新建立 Terminal。

不可在同一個執行中的 PTY 直接變更 Shell。

---

# 20. WSL Selection UI

當 Shell Type 為 WSL：

顯示：

* Distribution
* User
* Shell
* Login Shell
* Working Directory

範例：

```text
Distribution: Ubuntu-24.04
User: Default
Shell: zsh
Login Shell: Enabled
Directory: /home/eddy/projects/wallet
```

若 WSL 不可用：

```text
WSL is not available on this device.

[Refresh Detection]
[Open Setup Guide]
```

MVP 不需要內建 WSL 安裝功能。

---

# 21. Command Palette

## 21.1 Open Shortcut

Windows / Linux：

```text
Ctrl + Shift + P
```

或：

```text
Ctrl + K
```

macOS Future：

```text
Command + Shift + P
```

---

## 21.2 Supported Commands

```text
Open Workspace
Create Workspace
New Terminal
Split Terminal Right
Split Terminal Down
Switch Workspace
Rename Terminal
Restart Terminal
Close Terminal
Run Workspace Command
Open External Editor
Toggle Sidebar
Toggle Theme
Open Settings
```

---

## 21.3 Search Behavior

搜尋範圍：

* Command Name
* Workspace Name
* Terminal Name
* Shell Profile
* Workspace Command

支援：

* 模糊搜尋
* 鍵盤上下移動
* Enter 執行
* Escape 關閉

---

# 22. Quick Open

## 22.1 Purpose

Quick Open 用於快速切換 Workspace。

快捷鍵建議：

```text
Ctrl + P
```

結果：

```text
Wallet
~/projects/wallet
WSL Ubuntu

Notify
~/projects/notify
WSL Ubuntu

Infrastructure
D:\projects\infra
PowerShell
```

---

## 22.2 Ranking

排序依據：

1. Pinned
2. Favorite
3. Recently Opened
4. Most Used
5. Name Match
6. Tag Match
7. Path Match

---

# 23. Application Settings

## 23.1 Settings Sections

```text
General
Appearance
Shells
Terminal
Profiles
Keybindings
Data
Updates
About
```

---

## 23.2 General

* Open Last Workspace on Launch
* Confirm Before Closing Running Processes
* Default Workspace Folder
* Default External Editor
* Start Turtorge on Login，Future
* Minimize to Tray，Future

---

## 23.3 Appearance

### Theme

```text
Theme:
◉ System
○ Light
○ Dark
```

說明：

```text
System follows your operating system appearance setting.
```

其他選項：

* UI Scale
* Sidebar Density
* Reduced Motion
* Show Workspace Path
* Show Terminal Shell Badge

MVP 必須：

* System
* Light
* Dark

---

## 23.4 Terminal Appearance

設定：

* Font Family
* Font Size
* Line Height
* Cursor Style
* Cursor Blink
* Scrollback Lines
* Copy on Select
* Right-click Behavior
* Terminal Bell
* Ligatures，Future

預設 Font 應使用系統可用等寬字體。

不可打包或向使用者分享字型檔案。

---

## 23.5 Shells

顯示偵測結果：

```text
PowerShell 7             Available
Windows PowerShell       Available
WSL Ubuntu-24.04         Available
Git Bash                 Not Found
CMD                      Available
```

操作：

* Refresh Detection
* Add Custom Shell
* Edit Profile
* Disable Profile

---

## 23.6 Profiles

Profile 類別：

* Shell
* AI Agent
* Development Server
* Container
* Remote
* Custom

預設可建議：

* Claude Code
* Codex
* Gemini CLI
* PowerShell
* WSL
* Git Bash

但不得假設相關執行檔一定存在。

---

## 23.7 Data

操作：

* Open Configuration Folder
* Export Settings
* Import Settings
* Backup Workspaces
* Reset Application
* Clear Recent Workspaces
* Clear Cache

---

# 24. Theme Toggle

可在以下位置切換主題：

* Settings → Appearance
* Command Palette
* Optional Title Bar Button

循環切換時順序：

```text
System → Light → Dark → System
```

若 Title Bar 有 Theme Button，Tooltip 必須顯示目前狀態：

```text
Theme: System
```

---

# 25. Status Bar

## 25.1 Purpose

顯示全域低優先資訊。

建議內容：

左側：

* Current Workspace
* Current Shell
* WSL Distribution

右側：

* Running Terminal Count
* Startup Status
* Application Update
* Error Indicator

範例：

```text
Wallet · WSL Ubuntu                         4 Terminals · Ready
```

---

## 25.2 MVP Status Bar

MVP 可以只顯示：

* Workspace
* Default Shell
* Running Terminal Count

---

# 26. Notifications

## 26.1 Toast Types

* Success
* Information
* Warning
* Error

---

## 26.2 Toast Examples

```text
Workspace saved.
```

```text
Claude Code restarted.
```

```text
WSL distribution not found.
```

```text
Startup command failed with exit code 1.
```

---

## 26.3 Toast Behavior

* 顯示時間依嚴重程度不同
* Error 不應太快消失
* 支援手動關閉
* 同類通知應合併
* 高頻 Terminal 錯誤不可造成 Toast Flood

---

# 27. Dialogs

Dialog 類型：

* Create Workspace
* Edit Workspace
* Create Terminal
* Edit Terminal
* Confirm Process Termination
* Delete Workspace
* Import Manifest
* Workspace Trust
* Application Shutdown

---

## 27.1 Destructive Action

刪除 Workspace：

```text
Delete “Wallet”?

This removes the workspace configuration from Turtorge.
Project files will not be deleted.

[Cancel] [Delete Workspace]
```

不得誤導使用者以為會刪除專案目錄。

---

## 27.2 Running Process Confirmation

```text
This terminal is still running.

Closing it will terminate the process.

[Cancel]
[Close Terminal]
```

可提供：

```text
Do not ask again for this session
```

MVP 不建議提供永久略過，避免誤操作。

---

# 28. Workspace Trust UI

匯入 `.turtorge.yml` 時顯示：

```text
Review Workspace Commands

This workspace contains commands that can execute on your computer.

docker compose up -d
composer install
php artisan serve

[Cancel]
[Import Without Running]
[Trust and Import]
```

未信任 Workspace：

* Startup Command Disabled
* Auto-start Disabled
* 明顯 Trust Badge

---

# 29. Error States

## 29.1 Missing Directory

```text
Workspace directory not found.

C:\Projects\Wallet

[Locate Folder]
[Edit Workspace]
[Remove Workspace]
```

---

## 29.2 Missing Shell

```text
The configured shell is unavailable.

WSL Ubuntu-24.04

[Choose Another Shell]
[Refresh Detection]
```

---

## 29.3 Process Spawn Failure

Terminal Panel 內顯示：

```text
Unable to start terminal.

Executable not found: claude

[Edit Profile]
[Retry]
```

---

## 29.4 Terminal Exited

正常結束：

```text
Process exited with code 0.

[Restart]
```

異常結束：

```text
Process exited with code 1.

[Restart]
[View Details]
```

---

# 30. Loading States

應用程式啟動時：

* 顯示 App Shell
* Sidebar Skeleton
* 不顯示長時間全畫面 Loading

Workspace 開啟時：

* 先恢復 Layout
* 各 Terminal Panel 獨立顯示 Starting
* 不需等待所有 Terminal 才顯示主畫面

---

# 31. Empty Terminal Area

Workspace 沒有 Terminal 時：

```text
No terminals in this workspace.

[New Terminal]
[Add from Profile]
```

若 Terminal Definition 存在但未啟動：

```text
Claude Code is not running.

[Start Terminal]
```

---

# 32. Keyboard Shortcuts

Windows / Linux 建議：

```text
Ctrl + P               Quick Open Workspace
Ctrl + Shift + P       Command Palette
Ctrl + Shift + T       New Terminal
Ctrl + Shift + W       Close Terminal
Ctrl + Shift + R       Restart Terminal
Ctrl + \               Split Right
Ctrl + Shift + \       Split Down
Ctrl + Tab             Next Terminal Tab
Ctrl + Shift + Tab     Previous Terminal Tab
Ctrl + 1...9           Focus Terminal
Ctrl + B               Toggle Sidebar
Ctrl + ,               Open Settings
Ctrl + Shift + F       Search Terminal Output
F11                    Toggle Fullscreen
```

macOS Future：

* `Ctrl` 主要映射為 `Command`
* 部分 Terminal 原生快捷鍵需避免衝突
* Shortcut Mapping 應由 Platform Keymap 提供

---

# 33. Context Menus

## 33.1 Terminal Context Menu

Terminal 畫布右鍵：

```text
Copy
Paste
Select All
Search
Clear
Restart Terminal
Split Right
Split Down
Close Terminal
```

需考慮 Terminal Application 可能自行使用滑鼠右鍵。

提供設定：

```text
Right Click:
- Open Context Menu
- Paste
- Send to Terminal
```

MVP 預設：

```text
Open Context Menu
```

---

# 34. Terminal Search

使用：

```text
Ctrl + Shift + F
```

顯示 Terminal 內搜尋列：

```text
[ Search terminal... ]  3 / 12  ↑ ↓ ×
```

搜尋只針對目前 xterm.js Scrollback。

不進行跨 Workspace 全域 Log 搜尋。

---

# 35. Copy and Paste

Windows：

* `Ctrl + Shift + C`
* `Ctrl + Shift + V`

是否支援 `Ctrl + C` 複製，需依 Terminal Selection 狀態處理。

建議：

```text
有選取文字：
Ctrl + C = Copy

無選取文字：
Ctrl + C = Send Interrupt
```

Paste 應避免將多行危險指令直接執行。

未來可提供：

```text
Warn before pasting multiple lines
```

MVP 建議預設啟用多行貼上警告。

---

# 36. Window Behavior

## 36.1 Minimum Window Size

```text
Minimum Width: 900px
Minimum Height: 600px
```

---

## 36.2 Window Restore

保存：

* Window Size
* Window Position
* Maximized State
* Sidebar Width
* Last Active Workspace
* Last Active Terminal

不保證保存 Terminal Process Session。

---

## 36.3 Multiple Windows

MVP 可先限制單一主視窗。

Future：

* Open Workspace in New Window
* Detached Terminal Window
* Multiple Workspace Windows

但核心價值仍是減少視窗數量，不應鼓勵預設多視窗。

---

# 37. Responsive Desktop Layout

Turtorge 不以手機或 Web Responsive 為目標。

但需支援不同 Desktop 寬度。

## Large Window

```text
Sidebar + Workspace Header + Multiple Split Terminals
```

## Medium Window

```text
Narrow Sidebar + Tabs + Limited Split
```

## Small Window

```text
Collapsed Sidebar + Single Focused Terminal
```

當寬度不足時：

* Sidebar 自動允許收合
* Split 新增受到限制
* Terminal Header 次要資訊隱藏
* 操作移入 More Menu

---

# 38. Accessibility

必須支援：

* Keyboard Navigation
* Visible Focus
* Semantic Buttons
* ARIA Labels
* Screen Reader Labels
* Color Contrast
* Reduced Motion
* Non-color Status Indicators
* Zoom / UI Scale
* High Contrast Compatibility，盡可能

Icon-only Button 必須有 Tooltip 與 Accessible Label。

---

# 39. Motion

動畫應簡短且低干擾。

適用：

* Sidebar Collapse
* Dialog Open
* Command Palette
* Panel Resize Feedback
* Toast Enter / Exit

不適用：

* Terminal Output
* Workspace 切換大型轉場
* Process Status 持續動畫

使用者開啟 Reduced Motion 時：

* 關閉非必要動畫
* 使用立即切換或淡入淡出

---

# 40. Icons

Icon 用途：

* Workspace
* Shell
* AI Agent
* Terminal Category
* Status
* Action

Icon 不可作為唯一資訊來源。

例如：

```text
[Icon] Claude Code
```

而不是只顯示 Claude Logo。

預設 Workspace Icon 可依資料夾名稱產生字母或通用 Terminal Icon。

---

# 41. Typography

UI 字體：

* 使用系統 UI Font
* Windows 優先採用系統字體堆疊
* macOS Future 使用系統字體

Terminal 字體：

* 使用系統已安裝的等寬字體
* 允許使用者選擇
* 提供 fallback

建議 CSS：

```css
font-family:
  ui-sans-serif,
  system-ui,
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  sans-serif;
```

Terminal：

```css
font-family:
  ui-monospace,
  "Cascadia Mono",
  "Consolas",
  monospace;
```

---

# 42. Visual Density

提供兩種 UI Density，Future：

```text
Comfortable
Compact
```

MVP 可固定使用接近 Compact 的開發工具密度。

Terminal Area 應優先取得空間。

避免：

* 過高 Toolbar
* 過大 Header
* 過寬 Sidebar
* 過度留白

---

# 43. Performance UI Rules

1. Terminal Output 不進入一般 React Global State。
2. 每個 Terminal 使用自己的 xterm.js Instance。
3. 非目前可見 Tab 可降低 UI 更新頻率，但不得遺失 Output。
4. Sidebar 不因 Terminal Output 重新 Render。
5. Workspace Runtime 狀態使用細粒度 Store Selector。
6. Resize 使用 Debounce 或 RequestAnimationFrame。
7. 大量 Terminal 不同時執行昂貴 Measure。
8. Theme 切換不得重建 Terminal Process。
9. Theme 切換可以更新 xterm Theme，不重建 xterm Instance。
10. Layout 變更應批次保存。

---

# 44. Frontend Component Structure

```text
App
├── ThemeProvider
├── TauriEventProvider
├── AppShell
│   ├── TitleBar
│   ├── WorkspaceSidebar
│   ├── MainContent
│   │   ├── WorkspaceHeader
│   │   └── TerminalWorkspace
│   │       ├── LayoutRenderer
│   │       │   ├── SplitContainer
│   │       │   ├── TerminalTabGroup
│   │       │   └── TerminalPanel
│   │       │       ├── TerminalHeader
│   │       │       ├── XtermView
│   │       │       └── TerminalOverlay
│   │       └── EmptyWorkspaceState
│   └── StatusBar
│
├── CommandPalette
├── QuickOpen
├── DialogHost
├── ContextMenuHost
└── ToastHost
```

---

# 45. Suggested Frontend Feature Structure

```text
src/
├── app/
│   ├── App.tsx
│   ├── AppShell.tsx
│   ├── routes.tsx
│   └── providers/
│       ├── ThemeProvider.tsx
│       ├── TauriEventProvider.tsx
│       └── ShortcutProvider.tsx
│
├── features/
│   ├── workspaces/
│   │   ├── components/
│   │   ├── dialogs/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── types/
│   │
│   ├── terminals/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── stores/
│   │   └── types/
│   │
│   ├── layouts/
│   ├── profiles/
│   ├── settings/
│   ├── commands/
│   ├── appearance/
│   └── shell-detection/
│
├── components/
│   ├── ui/
│   ├── forms/
│   └── feedback/
│
├── lib/
│   ├── tauri/
│   ├── shortcuts/
│   ├── theme/
│   └── validation/
│
├── styles/
│   ├── tokens.css
│   ├── themes.css
│   ├── globals.css
│   └── terminal.css
│
└── types/
```

---

# 46. MVP Screens

MVP 必須完成以下畫面：

1. Application Shell
2. Empty State
3. Workspace Sidebar
4. Workspace Quick Open
5. Create Workspace Dialog
6. Edit Workspace Dialog
7. Workspace Main View
8. Terminal Panel
9. Terminal Tabs
10. Horizontal Split
11. Vertical Split
12. New Terminal Dialog
13. Terminal Profile Selection
14. Application Settings
15. Appearance Settings
16. Shell Detection Settings
17. Process Close Confirmation
18. Error State
19. Loading State
20. Toast Notification

---

# 47. MVP Theme Requirements

MVP 主題功能必須完成：

* `System` 主題
* `Light` 主題
* `Dark` 主題
* 預設 `System`
* 系統主題即時監聽
* 主題設定持久化
* xterm.js Theme 同步
* Dialog 與 Context Menu 同步
* Custom Title Bar 同步
* Workspace Color 在兩種主題下可辨識
* Theme 切換不影響 Terminal Process
* Theme 切換不重建 Workspace Runtime

---

# 48. MVP User Journey

## First Launch

```text
Launch Turtorge
        │
        ▼
Theme follows system
        │
        ▼
Empty State
        │
        ▼
Create Workspace
        │
        ▼
Select Directory
        │
        ▼
Select PowerShell or WSL
        │
        ▼
Create Initial Terminal
        │
        ▼
Workspace Opens
```

## Returning User

```text
Launch Turtorge
        │
        ▼
Restore Window State
        │
        ▼
Show Workspace List
        │
        ▼
Select Wallet
        │
        ▼
Restore Layout
        │
        ▼
Start Configured Terminals
        │
        ▼
Continue Work
```

---

# 49. Definition of Done for UI v0.1

UI v0.1 完成條件：

* 應用程式可正常顯示明暗主題。
* 預設跟隨系統主題。
* 使用者可指定 Light 或 Dark。
* 系統主題變更時 UI 可即時更新。
* 可建立 Workspace。
* 可設定 Workspace 名稱與目錄。
* 可選擇 PowerShell 或 WSL。
* Workspace 出現在 Sidebar。
* 可搜尋與快速切換 Workspace。
* 可建立一般 Terminal。
* 可建立 Claude Code Terminal。
* 可建立 Codex Terminal。
* 可同時顯示多個 Terminal。
* 可建立水平與垂直 Split。
* 可保存 Layout。
* 可重新開啟 Workspace。
* 可重新建立 Terminal。
* 可清楚顯示 Terminal 名稱。
* 可辨識 Terminal Runtime 狀態。
* Terminal 失敗時有可理解的錯誤介面。
* 所有主要操作可由鍵盤完成。
* UI 不需要保存 Process Session。
* Workspace 與 Layout 可在重新啟動後保留。
* Terminal Process 不因 UI Theme 切換而重啟。

---

# 50. Final UI Statement

Turtorge 的 UI 不應讓使用者感覺自己正在管理大量 Terminal。

它應讓使用者感覺自己正在進入一個完整的開發空間。

Workspace 是入口。

Terminal 是工作表面。

Shell 是可替換的執行環境。

AI Agent 是其中一種工具。

主題則應安靜地融入使用者的作業系統，預設跟隨系統，並保留淺色與深色的完整控制權。

> **Open the workspace. Everything else should already know where it belongs.**
