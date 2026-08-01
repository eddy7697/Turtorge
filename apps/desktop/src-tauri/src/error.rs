use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum TurtorgeError {
    #[error("Workspace not found: {0}")]
    WorkspaceNotFound(String),
    #[error("Terminal not found: {0}")]
    TerminalNotFound(String),
    #[error("Shell is unavailable: {0}")]
    ShellUnavailable(String),
    #[error("Working directory is unavailable: {0}")]
    InvalidWorkingDirectory(String),
    #[error("Unable to spawn process: {0}")]
    ProcessSpawnFailed(String),
    #[error("Unable to communicate with process: {0}")]
    ProcessIoFailed(String),
    #[error("Unable to stop process: {0}")]
    ProcessTerminationFailed(String),
    #[error("Unable to read application data: {0}")]
    StorageReadFailed(String),
    #[error("Unable to save application data: {0}")]
    StorageWriteFailed(String),
    #[error("Invalid request: {0}")]
    Validation(String),
    #[error("Platform operation failed: {0}")]
    Platform(String),
    #[error("Launcher is unavailable: {0}")]
    LauncherUnavailable(String),
    #[error("Unable to open launcher: {0}")]
    LauncherFailed(String),
    #[error("Internal error: {0}")]
    Internal(String),
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ApiError {
    pub code: String,
    pub message: String,
}

impl From<TurtorgeError> for ApiError {
    fn from(value: TurtorgeError) -> Self {
        let code = match &value {
            TurtorgeError::WorkspaceNotFound(_) => "WORKSPACE_NOT_FOUND",
            TurtorgeError::TerminalNotFound(_) => "TERMINAL_NOT_FOUND",
            TurtorgeError::ShellUnavailable(_) => "SHELL_UNAVAILABLE",
            TurtorgeError::InvalidWorkingDirectory(_) => "INVALID_WORKING_DIRECTORY",
            TurtorgeError::ProcessSpawnFailed(_) => "PROCESS_SPAWN_FAILED",
            TurtorgeError::ProcessIoFailed(_) => "PROCESS_IO_FAILED",
            TurtorgeError::ProcessTerminationFailed(_) => "PROCESS_TERMINATION_FAILED",
            TurtorgeError::StorageReadFailed(_) => "STORAGE_READ_FAILED",
            TurtorgeError::StorageWriteFailed(_) => "STORAGE_WRITE_FAILED",
            TurtorgeError::Validation(_) => "VALIDATION_ERROR",
            TurtorgeError::Platform(_) => "PLATFORM_ERROR",
            TurtorgeError::LauncherUnavailable(_) => "LAUNCHER_UNAVAILABLE",
            TurtorgeError::LauncherFailed(_) => "LAUNCHER_FAILED",
            TurtorgeError::Internal(_) => "INTERNAL_ERROR",
        };

        Self {
            code: code.to_owned(),
            message: value.to_string(),
        }
    }
}

impl From<std::io::Error> for TurtorgeError {
    fn from(value: std::io::Error) -> Self {
        Self::Internal(value.to_string())
    }
}
