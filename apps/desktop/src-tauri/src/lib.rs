mod commands;
mod error;
mod models;
mod platform;
mod storage;
mod terminal;

use std::sync::Arc;
use storage::Repository;
use tauri::Manager;
use terminal::TerminalManager;
use tracing_subscriber::EnvFilter;

pub struct AppState {
    repository: Arc<Repository>,
    terminals: Arc<TerminalManager>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("turtorge=info")),
        )
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_root = app
                .path()
                .app_data_dir()
                .map_err(|error| error.to_string())?;
            let repository = Repository::new(data_root).map_err(|error| error.to_string())?;
            app.manage(AppState {
                repository: Arc::new(repository),
                terminals: Arc::new(TerminalManager::default()),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_bootstrap,
            commands::workspace_save,
            commands::workspace_open,
            commands::workspace_delete,
            commands::settings_update,
            commands::platform_detect_windows_shells,
            commands::platform_list_wsl_distributions,
            commands::platform_detect_wsl_shells,
            commands::platform_validate_path,
            commands::platform_resolve_wsl_path,
            commands::terminal_start,
            commands::terminal_attach,
            commands::terminal_detach,
            commands::terminal_write,
            commands::terminal_write_definition,
            commands::terminal_resize,
            commands::terminal_close,
            commands::terminal_list_runtime,
            commands::terminal_terminate_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Turtorge");
}
