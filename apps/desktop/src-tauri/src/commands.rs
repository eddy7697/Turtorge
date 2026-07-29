use crate::AppState;
use crate::error::ApiError;
use crate::models::{
    AppSettings, BootstrapPayload, TerminalEvent, TerminalRuntimeSnapshot, TerminalStartRequest,
    Workspace, WorkspacePath, WslDistribution, WslShellDetection,
};
use crate::platform;
use chrono::Utc;
use tauri::State;
use tauri::ipc::Channel;

type CommandResult<T> = Result<T, ApiError>;

#[tauri::command]
pub fn app_bootstrap(state: State<'_, AppState>) -> CommandResult<BootstrapPayload> {
    Ok(BootstrapPayload {
        workspaces: state.repository.list_workspaces().map_err(ApiError::from)?,
        settings: state.repository.settings().map_err(ApiError::from)?,
        windows_shells: platform::detect_windows_shells(),
        wsl_distributions: platform::list_wsl_distributions().unwrap_or_default(),
    })
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
pub fn workspace_open(state: State<'_, AppState>, id: String) -> CommandResult<Workspace> {
    let mut workspace = state
        .repository
        .list_workspaces()
        .map_err(ApiError::from)?
        .into_iter()
        .find(|workspace| workspace.id == id)
        .ok_or_else(|| ApiError::from(crate::error::TurtorgeError::WorkspaceNotFound(id)))?;
    workspace.last_opened_at = Some(Utc::now().to_rfc3339());
    workspace.open_count += 1;
    workspace.updated_at = Utc::now().to_rfc3339();
    state
        .repository
        .save_workspace(workspace.clone())
        .map_err(ApiError::from)?;

    let mut settings = state.repository.settings().map_err(ApiError::from)?;
    settings.last_active_workspace_id = Some(workspace.id.clone());
    state
        .repository
        .save_settings(settings)
        .map_err(ApiError::from)?;
    Ok(workspace)
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
pub fn terminal_start(
    state: State<'_, AppState>,
    request: TerminalStartRequest,
    on_event: Channel<TerminalEvent>,
) -> CommandResult<TerminalRuntimeSnapshot> {
    state
        .terminals
        .start(request, on_event)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_attach(
    state: State<'_, AppState>,
    runtime_id: String,
    on_event: Channel<TerminalEvent>,
) -> CommandResult<TerminalRuntimeSnapshot> {
    state
        .terminals
        .attach(&runtime_id, on_event)
        .map_err(ApiError::from)
}

#[tauri::command]
pub fn terminal_detach(state: State<'_, AppState>, runtime_id: String) -> CommandResult<()> {
    state.terminals.detach(&runtime_id).map_err(ApiError::from)
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
