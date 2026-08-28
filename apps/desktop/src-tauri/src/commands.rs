use crate::AppState;
use crate::error::{ApiError, TurtorgeError};
use crate::models::{
    AppSettings, BootstrapPayload, DesktopPlatform, EnvironmentVariable, LauncherLaunchResult,
    LauncherOpenRequest, LauncherProfile, LauncherProfileStatus, LauncherValidationResult,
    TerminalEvent, TerminalRuntimeSnapshot, TerminalStartRequest, Workspace,
    WorkspaceMoveTerminalRequest, WorkspaceMoveTerminalResult, WorkspacePath, WslDistribution,
    WslShellDetection,
};
use crate::{launcher, platform};
use chrono::Utc;
use tauri::State;
use tauri::ipc::Channel;

type CommandResult<T> = Result<T, ApiError>;

#[tauri::command]
pub fn app_bootstrap(state: State<'_, AppState>) -> CommandResult<BootstrapPayload> {
    let settings = state.repository.settings().map_err(ApiError::from)?;
    let platform_kind = platform::current_platform();
    Ok(BootstrapPayload {
        platform: platform_kind.clone(),
        workspaces: state.repository.list_workspaces().map_err(ApiError::from)?,
        launcher_profiles: launcher::launcher_statuses(&settings),
        settings,
        windows_shells: matches!(platform_kind, DesktopPlatform::Windows)
            .then(platform::detect_windows_shells)
            .unwrap_or_default(),
        native_shells: matches!(
            platform_kind,
            DesktopPlatform::Macos | DesktopPlatform::Linux
        )
        .then(platform::detect_native_shells)
        .unwrap_or_default(),
        wsl_distributions: matches!(platform_kind, DesktopPlatform::Windows)
            .then(|| platform::list_wsl_distributions().unwrap_or_default())
            .unwrap_or_default(),
    })
}

#[tauri::command]
pub fn launcher_validate_profile(profile: LauncherProfile) -> LauncherValidationResult {
    launcher::validate_profile(&profile)
}

#[tauri::command]
pub fn launcher_list_profiles(
    state: State<'_, AppState>,
) -> CommandResult<Vec<LauncherProfileStatus>> {
    let settings = state.repository.settings().map_err(ApiError::from)?;
    Ok(launcher::launcher_statuses(&settings))
}

#[tauri::command]
pub fn launcher_open(
    state: State<'_, AppState>,
    request: LauncherOpenRequest,
) -> CommandResult<LauncherLaunchResult> {
    let settings = state.repository.settings().map_err(ApiError::from)?;
    launcher::open(&settings, request).map_err(ApiError::from)
}

#[tauri::command]
pub fn workspace_save(
    state: State<'_, AppState>,
    mut workspace: Workspace,
) -> CommandResult<Workspace> {
    workspace.updated_at = Utc::now().to_rfc3339();
    state
        .repository
        .save_workspace(workspace)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn workspace_reorder(
    state: State<'_, AppState>,
    ordered_ids: Vec<String>,
) -> CommandResult<Vec<Workspace>> {
    state
        .repository
        .reorder_workspaces(ordered_ids)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn workspace_move_terminal(
    state: State<'_, AppState>,
    request: WorkspaceMoveTerminalRequest,
) -> CommandResult<WorkspaceMoveTerminalResult> {
    let ((source_workspace, target_workspace), runtime) = state
        .terminals
        .move_definition_transaction(&request.terminal_id, &request.target_workspace_id, || {
            state
                .repository
                .move_terminal(&request, &Utc::now().to_rfc3339())
        })
        .map_err(ApiError::from)?;
    Ok(WorkspaceMoveTerminalResult {
        source_workspace,
        target_workspace,
        runtime,
    })
}

#[tauri::command]
pub fn workspace_open(state: State<'_, AppState>, id: String) -> CommandResult<Workspace> {
    state
        .repository
        .open_workspace(&id, &Utc::now().to_rfc3339())
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn workspace_delete(state: State<'_, AppState>, id: String) -> CommandResult<()> {
    state
        .repository
        .delete_workspace(&id)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn settings_update(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> CommandResult<AppSettings> {
    state
        .repository
        .save_settings(settings)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn platform_detect_windows_shells() -> Vec<crate::models::ShellProfile> {
    platform::detect_windows_shells()
}

#[tauri::command]
pub fn platform_detect_native_shells() -> Vec<crate::models::ShellProfile> {
    platform::detect_native_shells()
}

#[tauri::command]
pub fn platform_validate_shell(executable: String) -> bool {
    platform::validate_shell_executable(&executable)
}

#[tauri::command]
pub fn platform_list_wsl_distributions() -> CommandResult<Vec<WslDistribution>> {
    platform::list_wsl_distributions().map_err(ApiError::from)
}

#[tauri::command]
pub fn platform_detect_wsl_shells(distribution: String) -> CommandResult<WslShellDetection> {
    platform::detect_wsl_shells(&distribution).map_err(ApiError::from)
}

#[tauri::command]
pub fn platform_validate_path(path: WorkspacePath) -> CommandResult<bool> {
    platform::validate_workspace_path(&path).map_err(ApiError::from)
}

#[tauri::command]
pub fn platform_resolve_wsl_path(
    path: WorkspacePath,
    distribution: String,
) -> CommandResult<String> {
    platform::resolve_wsl_working_directory(&path, &distribution).map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_start(
    state: State<'_, AppState>,
    request: TerminalStartRequest,
    connection_id: String,
    on_event: Channel<TerminalEvent>,
) -> CommandResult<TerminalRuntimeSnapshot> {
    state
        .terminals
        .start(request, connection_id, on_event, |request| {
            let workspaces = state.repository.list_workspaces()?;
            let definition_id = request.definition.id.clone();
            let owners = workspaces
                .into_iter()
                .filter(|workspace| {
                    workspace
                        .terminals
                        .iter()
                        .any(|terminal| terminal.id == definition_id)
                })
                .map(|workspace| (workspace.id, workspace.environment_variables))
                .collect();
            reconcile_terminal_start_context(
                &definition_id,
                &mut request.workspace_id,
                &mut request.workspace_environment,
                owners,
            )
        })
        .map_err(ApiError::from)
}

fn reconcile_terminal_start_context(
    definition_id: &str,
    requested_workspace_id: &mut String,
    requested_environment: &mut Vec<EnvironmentVariable>,
    owners: Vec<(String, Vec<EnvironmentVariable>)>,
) -> Result<(), TurtorgeError> {
    let mut owners = owners.into_iter();
    let Some((owner_id, owner_environment)) = owners.next() else {
        return Ok(());
    };
    if owners.next().is_some() {
        return Err(TurtorgeError::Validation(format!(
            "Terminal {definition_id} has more than one workspace owner"
        )));
    }
    if owner_id != *requested_workspace_id {
        *requested_workspace_id = owner_id;
        *requested_environment = owner_environment;
    }
    Ok(())
}

#[tauri::command]
pub fn terminal_attach(
    state: State<'_, AppState>,
    runtime_id: String,
    connection_id: String,
    on_event: Channel<TerminalEvent>,
) -> CommandResult<TerminalRuntimeSnapshot> {
    state
        .terminals
        .attach(&runtime_id, connection_id, on_event)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_detach(
    state: State<'_, AppState>,
    runtime_id: String,
    connection_id: String,
) -> CommandResult<()> {
    state
        .terminals
        .detach(&runtime_id, &connection_id)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_write(
    state: State<'_, AppState>,
    runtime_id: String,
    data: Vec<u8>,
) -> CommandResult<()> {
    state
        .terminals
        .write(&runtime_id, &data)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_write_definition(
    state: State<'_, AppState>,
    definition_id: String,
    data: Vec<u8>,
) -> CommandResult<()> {
    state
        .terminals
        .write_by_definition(&definition_id, &data)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_resize(
    state: State<'_, AppState>,
    runtime_id: String,
    cols: u16,
    rows: u16,
) -> CommandResult<()> {
    state
        .terminals
        .resize(&runtime_id, cols, rows)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_close(state: State<'_, AppState>, runtime_id: String) -> CommandResult<()> {
    state.terminals.close(&runtime_id).map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_list_runtime(state: State<'_, AppState>) -> Vec<TerminalRuntimeSnapshot> {
    state.terminals.list()
}

#[tauri::command]
pub fn terminal_terminate_all(state: State<'_, AppState>) {
    state.terminals.terminate_all();
}

#[tauri::command]
pub fn app_quit(app: tauri::AppHandle, state: State<'_, AppState>) {
    state.terminals.terminate_all();
    app.exit(0);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn environment(key: &str, value: &str) -> Vec<EnvironmentVariable> {
        vec![EnvironmentVariable {
            key: key.to_owned(),
            value: value.to_owned(),
        }]
    }

    #[test]
    fn terminal_start_context_tracks_a_definition_moved_before_start_acquires_its_lock() {
        let mut workspace_id = "workspace-source".to_owned();
        let mut requested_environment = environment("SOURCE_ONLY", "source");
        let target_environment = environment("TARGET_ONLY", "target");

        reconcile_terminal_start_context(
            "terminal-1",
            &mut workspace_id,
            &mut requested_environment,
            vec![("workspace-target".to_owned(), target_environment.clone())],
        )
        .unwrap();

        assert_eq!(workspace_id, "workspace-target");
        assert_eq!(requested_environment, target_environment);
    }

    #[test]
    fn terminal_start_context_allows_no_owner_but_rejects_ambiguous_ownership() {
        let mut workspace_id = "workspace-source".to_owned();
        let original_environment = environment("UNCHANGED", "true");
        let mut requested_environment = original_environment.clone();

        reconcile_terminal_start_context(
            "terminal-1",
            &mut workspace_id,
            &mut requested_environment,
            Vec::new(),
        )
        .unwrap();
        assert_eq!(workspace_id, "workspace-source");
        assert_eq!(requested_environment, original_environment);

        let error = reconcile_terminal_start_context(
            "terminal-1",
            &mut workspace_id,
            &mut requested_environment,
            vec![
                ("workspace-a".to_owned(), Vec::new()),
                ("workspace-b".to_owned(), Vec::new()),
            ],
        )
        .expect_err("duplicate owners must be rejected");
        assert!(matches!(
            error,
            TurtorgeError::Validation(message) if message.contains("terminal-1")
        ));
    }
}
