use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ThemePreference {
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub theme: ThemePreference,
    pub open_last_workspace: bool,
    pub confirm_before_close: bool,
    pub sidebar_width: u16,
    pub last_active_workspace_id: Option<String>,
    #[serde(default)]
    pub default_launcher_profile_id: Option<String>,
    #[serde(default)]
    pub launcher_profiles: Vec<LauncherProfile>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: ThemePreference::System,
            open_last_workspace: true,
            confirm_before_close: true,
            sidebar_width: 236,
            last_active_workspace_id: None,
            default_launcher_profile_id: None,
            launcher_profiles: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LauncherDetectionMode {
    Auto,
    Manual,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum LauncherIcon {
    Explorer,
    Finder,
    VsCode,
    Cursor,
    Antigravity,
    Zed,
    IntelliJ,
    Rider,
    WebStorm,
    PyCharm,
    Unity,
    AppWindow,
    Terminal,
    Code,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LauncherProfile {
    pub id: String,
    pub name: String,
    pub program: String,
    pub arguments: Vec<String>,
    pub wsl_arguments: Option<Vec<String>>,
    pub detection_mode: LauncherDetectionMode,
    pub icon: LauncherIcon,
    pub accent: Option<String>,
    #[serde(default)]
    pub built_in: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherProfileStatus {
    pub profile: LauncherProfile,
    pub available: bool,
    pub resolved_program: Option<String>,
    pub unavailable_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherOpenRequest {
    pub profile_id: Option<String>,
    pub path: WorkspacePath,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherLaunchResult {
    pub profile_id: String,
    pub program: String,
    pub arguments: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherValidationResult {
    pub valid: bool,
    pub errors: Vec<String>,
    pub resolved_program: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PathKind {
    Windows,
    Wsl,
    Native,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspacePath {
    pub kind: PathKind,
    pub value: String,
    pub distribution: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ShellKind {
    PowerShell,
    Wsl,
    Native,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum DesktopPlatform {
    Windows,
    Macos,
    Linux,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ShellProfile {
    pub id: String,
    pub name: String,
    pub kind: ShellKind,
    pub executable: String,
    pub version: Option<String>,
    pub distribution: Option<String>,
    pub shell: Option<String>,
    pub login_shell: bool,
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct EnvironmentVariable {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TerminalProfileKind {
    Shell,
    ClaudeCode,
    Codex,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalDefinition {
    pub id: String,
    pub name: String,
    pub profile: TerminalProfileKind,
    pub shell_profile: ShellProfile,
    pub working_directory: WorkspacePath,
    pub startup_command: Option<String>,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub auto_start: bool,
    #[serde(default)]
    pub launcher_profile_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum LayoutNode {
    Pane {
        id: String,
        terminal_ids: Vec<String>,
        active_terminal_id: Option<String>,
    },
    Split {
        id: String,
        direction: SplitDirection,
        ratio: f32,
        first: Box<LayoutNode>,
        second: Box<LayoutNode>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Workspace {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub color: String,
    pub root_directory: WorkspacePath,
    pub default_shell_profile: ShellProfile,
    pub terminals: Vec<TerminalDefinition>,
    pub environment_variables: Vec<EnvironmentVariable>,
    pub layout: LayoutNode,
    pub pinned: bool,
    pub favorite: bool,
    pub created_at: String,
    pub updated_at: String,
    pub last_opened_at: Option<String>,
    pub open_count: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WslDistribution {
    pub name: String,
    pub is_default: bool,
    pub is_running: bool,
    pub version: u8,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WslShellDetection {
    pub distribution: String,
    pub default_shell: Option<String>,
    pub shells: Vec<ShellProfile>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BootstrapPayload {
    pub platform: DesktopPlatform,
    pub workspaces: Vec<Workspace>,
    pub settings: AppSettings,
    pub windows_shells: Vec<ShellProfile>,
    pub native_shells: Vec<ShellProfile>,
    pub wsl_distributions: Vec<WslDistribution>,
    pub launcher_profiles: Vec<LauncherProfileStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalStartRequest {
    pub workspace_id: String,
    pub definition: TerminalDefinition,
    pub workspace_environment: Vec<EnvironmentVariable>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum TerminalStatus {
    Starting,
    Running,
    Exited,
    Failed,
    Stopping,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TerminalRuntimeSnapshot {
    pub id: String,
    pub workspace_id: String,
    pub definition_id: String,
    pub process_id: Option<u32>,
    pub status: TerminalStatus,
    pub exit_code: Option<u32>,
    pub cols: u16,
    pub rows: u16,
    pub scrollback: Vec<u8>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(
    tag = "event",
    content = "data",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum TerminalEvent {
    Output(Vec<u8>),
    Status(TerminalStatus),
    Exited { exit_code: u32 },
    Error { code: String, message: String },
}

pub fn merge_environment(
    workspace: &[EnvironmentVariable],
    terminal: &[EnvironmentVariable],
) -> BTreeMap<String, String> {
    let mut merged = BTreeMap::new();
    for item in workspace.iter().chain(terminal) {
        if !item.key.trim().is_empty() {
            merged.insert(item.key.clone(), item.value.clone());
        }
    }
    merged
}

#[cfg(test)]
mod tests {
    use super::{
        AppSettings, DesktopPlatform, LayoutNode, PathKind, ShellKind, TerminalDefinition,
        TerminalEvent,
    };

    #[test]
    fn layout_node_accepts_camel_case_pane_fields() {
        let value = serde_json::json!({
            "type": "pane",
            "id": "pane-1",
            "terminalIds": ["terminal-1"],
            "activeTerminalId": "terminal-1"
        });

        let layout: LayoutNode = serde_json::from_value(value).expect("valid pane layout");
        match layout {
            LayoutNode::Pane {
                terminal_ids,
                active_terminal_id,
                ..
            } => {
                assert_eq!(terminal_ids, vec!["terminal-1"]);
                assert_eq!(active_terminal_id.as_deref(), Some("terminal-1"));
            }
            LayoutNode::Split { .. } => panic!("expected a pane"),
        }
    }

    #[test]
    fn terminal_exit_event_serializes_camel_case_fields() {
        let value = serde_json::to_value(TerminalEvent::Exited { exit_code: 7 })
            .expect("serialize terminal exit event");

        assert_eq!(
            value,
            serde_json::json!({
                "event": "exited",
                "data": { "exitCode": 7 }
            })
        );
    }

    #[test]
    fn terminal_output_event_serializes_as_a_byte_array() {
        let value = serde_json::to_value(TerminalEvent::Output(vec![27, 91, 54, 110]))
            .expect("serialize terminal output event");

        assert_eq!(
            value,
            serde_json::json!({
                "event": "output",
                "data": [27, 91, 54, 110]
            })
        );
    }

    #[test]
    fn settings_without_launcher_fields_remain_compatible() {
        let settings: AppSettings = serde_json::from_value(serde_json::json!({
            "theme": "system",
            "openLastWorkspace": true,
            "confirmBeforeClose": true,
            "sidebarWidth": 236,
            "lastActiveWorkspaceId": null
        }))
        .expect("legacy settings should load");

        assert!(settings.default_launcher_profile_id.is_none());
        assert!(settings.launcher_profiles.is_empty());
    }

    #[test]
    fn terminal_without_launcher_override_remains_compatible() {
        let terminal: TerminalDefinition = serde_json::from_value(serde_json::json!({
            "id": "terminal-1",
            "name": "Shell",
            "profile": "shell",
            "shellProfile": {
                "id": "pwsh",
                "name": "PowerShell",
                "kind": "powerShell",
                "executable": "pwsh.exe",
                "version": null,
                "distribution": null,
                "shell": null,
                "loginShell": false,
                "available": true
            },
            "workingDirectory": { "kind": "windows", "value": "C:\\\\work", "distribution": null },
            "startupCommand": null,
            "environmentVariables": [],
            "autoStart": true
        }))
        .expect("legacy terminal should load");

        assert!(terminal.launcher_profile_id.is_none());
    }

    #[test]
    fn macos_platform_and_native_variants_use_stable_wire_names() {
        assert_eq!(
            serde_json::to_value(DesktopPlatform::Macos).unwrap(),
            "macos"
        );
        assert_eq!(serde_json::to_value(PathKind::Native).unwrap(), "native");
        assert_eq!(serde_json::to_value(ShellKind::Native).unwrap(), "native");
    }
}
