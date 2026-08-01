use crate::error::TurtorgeError;
use crate::models::{
    PathKind, ShellKind, TerminalEvent, TerminalProfileKind, TerminalRuntimeSnapshot,
    TerminalStartRequest, TerminalStatus, merge_environment,
};
use crate::platform::{background_command_status, resolve_wsl_working_directory_with_fallback};
use parking_lot::Mutex;
use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::ipc::Channel;
use uuid::Uuid;

const MAX_MEMORY_SCROLLBACK_BYTES: usize = 1024 * 1024;

struct TerminalStream {
    buffer: Mutex<VecDeque<u8>>,
    subscriber: Mutex<Option<TerminalSubscriber>>,
}

struct TerminalSubscriber {
    connection_id: String,
    channel: Channel<TerminalEvent>,
}

impl TerminalStream {
    fn new(connection_id: String, channel: Channel<TerminalEvent>) -> Self {
        Self {
            buffer: Mutex::new(VecDeque::new()),
            subscriber: Mutex::new(Some(TerminalSubscriber {
                connection_id,
                channel,
            })),
        }
    }

    fn push(&self, bytes: &[u8]) {
        {
            let mut buffer = self.buffer.lock();
            buffer.extend(bytes.iter().copied());
            while buffer.len() > MAX_MEMORY_SCROLLBACK_BYTES {
                buffer.pop_front();
            }
        }
        self.send(TerminalEvent::Output(bytes.to_vec()));
    }

    fn attach(&self, connection_id: String, channel: Channel<TerminalEvent>) -> Vec<u8> {
        let mut subscriber = self.subscriber.lock();
        let snapshot = self.buffer.lock().iter().copied().collect::<Vec<_>>();
        *subscriber = Some(TerminalSubscriber {
            connection_id,
            channel,
        });
        snapshot
    }

    fn detach(&self, connection_id: &str) {
        let mut subscriber = self.subscriber.lock();
        if subscriber
            .as_ref()
            .is_some_and(|subscriber| subscriber.connection_id == connection_id)
        {
            *subscriber = None;
        }
    }

    fn send(&self, event: TerminalEvent) {
        let channel = self
            .subscriber
            .lock()
            .as_ref()
            .map(|subscriber| subscriber.channel.clone());
        if let Some(channel) = channel {
            let _ = channel.send(event);
        }
    }
}

struct ManagedTerminal {
    id: String,
    workspace_id: String,
    definition_id: String,
    process_id: Option<u32>,
    writer: Mutex<Box<dyn Write + Send>>,
    master: Mutex<Box<dyn MasterPty + Send>>,
    killer: Mutex<Box<dyn ChildKiller + Send + Sync>>,
    stream: Arc<TerminalStream>,
    status: Mutex<TerminalStatus>,
    exit_code: Mutex<Option<u32>>,
    size: Mutex<(u16, u16)>,
}

impl ManagedTerminal {
    fn snapshot(&self) -> TerminalRuntimeSnapshot {
        self.snapshot_with_scrollback(Vec::new())
    }

    fn snapshot_with_scrollback(&self, scrollback: Vec<u8>) -> TerminalRuntimeSnapshot {
        let (cols, rows) = *self.size.lock();
        TerminalRuntimeSnapshot {
            id: self.id.clone(),
            workspace_id: self.workspace_id.clone(),
            definition_id: self.definition_id.clone(),
            process_id: self.process_id,
            status: self.status.lock().clone(),
            exit_code: *self.exit_code.lock(),
            cols,
            rows,
            scrollback,
        }
    }
}

#[derive(Default)]
pub struct TerminalManager {
    terminals: Mutex<HashMap<String, Arc<ManagedTerminal>>>,
}

impl TerminalManager {
    pub fn start(
        &self,
        request: TerminalStartRequest,
        connection_id: String,
        channel: Channel<TerminalEvent>,
    ) -> Result<TerminalRuntimeSnapshot, TurtorgeError> {
        if let Some(existing) = self.find_by_definition(&request.definition.id) {
            let scrollback = existing.stream.attach(connection_id, channel);
            return Ok(existing.snapshot_with_scrollback(scrollback));
        }
        self.terminals.lock().retain(|_, terminal| {
            terminal.definition_id != request.definition.id
                || matches!(
                    *terminal.status.lock(),
                    TerminalStatus::Starting | TerminalStatus::Running | TerminalStatus::Stopping
                )
        });

        let cols = request.cols.max(20);
        let rows = request.rows.max(5);
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| TurtorgeError::ProcessSpawnFailed(error.to_string()))?;

        let BuiltCommand {
            mut command,
            startup_notice,
        } = build_command(&request)?;
        let environment = merge_environment(
            &request.workspace_environment,
            &request.definition.environment_variables,
        );
        if request.definition.shell_profile.kind == ShellKind::PowerShell {
            for (key, value) in &environment {
                command.env(key, value);
            }
        }

        let child = pair
            .slave
            .spawn_command(command)
            .map_err(|error| TurtorgeError::ProcessSpawnFailed(error.to_string()))?;
        drop(pair.slave);

        let process_id = child.process_id();
        let killer = child.clone_killer();
        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))?;
        let mut writer = pair
            .master
            .take_writer()
            .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))?;
        #[cfg(windows)]
        writer
            .write_all(b"\x1b[1;1R")
            .and_then(|_| writer.flush())
            .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))?;
        let stream = Arc::new(TerminalStream::new(connection_id, channel));
        if let Some(notice) = startup_notice {
            stream.push(notice.as_bytes());
        }
        let runtime_id = Uuid::new_v4().to_string();

        let managed = Arc::new(ManagedTerminal {
            id: runtime_id.clone(),
            workspace_id: request.workspace_id,
            definition_id: request.definition.id.clone(),
            process_id,
            writer: Mutex::new(writer),
            master: Mutex::new(pair.master),
            killer: Mutex::new(killer),
            stream: stream.clone(),
            status: Mutex::new(TerminalStatus::Starting),
            exit_code: Mutex::new(None),
            size: Mutex::new((cols, rows)),
        });
        self.terminals
            .lock()
            .insert(runtime_id.clone(), managed.clone());

        managed
            .stream
            .send(TerminalEvent::Status(TerminalStatus::Starting));
        *managed.status.lock() = TerminalStatus::Running;
        spawn_reader(reader, managed.clone());
        spawn_waiter(child, managed.clone());
        managed
            .stream
            .send(TerminalEvent::Status(TerminalStatus::Running));

        if let Some(startup) = startup_command(&request.definition) {
            let mut writer = managed.writer.lock();
            writer
                .write_all(format!("{startup}\r").as_bytes())
                .and_then(|_| writer.flush())
                .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))?;
        }

        Ok(managed.snapshot())
    }

    pub fn attach(
        &self,
        runtime_id: &str,
        connection_id: String,
        channel: Channel<TerminalEvent>,
    ) -> Result<TerminalRuntimeSnapshot, TurtorgeError> {
        let terminal = self.get(runtime_id)?;
        let scrollback = terminal.stream.attach(connection_id, channel);
        Ok(terminal.snapshot_with_scrollback(scrollback))
    }

    pub fn detach(&self, runtime_id: &str, connection_id: &str) -> Result<(), TurtorgeError> {
        self.get(runtime_id)?.stream.detach(connection_id);
        Ok(())
    }

    pub fn write(&self, runtime_id: &str, data: &[u8]) -> Result<(), TurtorgeError> {
        let terminal = self.get(runtime_id)?;
        Self::write_to_terminal(&terminal, data)
    }

    pub fn write_by_definition(
        &self,
        definition_id: &str,
        data: &[u8],
    ) -> Result<(), TurtorgeError> {
        let terminal = self
            .find_by_definition(definition_id)
            .ok_or_else(|| TurtorgeError::TerminalNotFound(definition_id.to_owned()))?;
        Self::write_to_terminal(&terminal, data)
    }

    fn write_to_terminal(
        terminal: &Arc<ManagedTerminal>,
        data: &[u8],
    ) -> Result<(), TurtorgeError> {
        let mut writer = terminal.writer.lock();
        writer
            .write_all(data)
            .and_then(|_| writer.flush())
            .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))
    }

    pub fn resize(&self, runtime_id: &str, cols: u16, rows: u16) -> Result<(), TurtorgeError> {
        let terminal = self.get(runtime_id)?;
        let cols = cols.max(20);
        let rows = rows.max(5);
        terminal
            .master
            .lock()
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|error| TurtorgeError::ProcessIoFailed(error.to_string()))?;
        *terminal.size.lock() = (cols, rows);
        Ok(())
    }

    pub fn close(&self, runtime_id: &str) -> Result<(), TurtorgeError> {
        let terminal = self.get(runtime_id)?;
        *terminal.status.lock() = TerminalStatus::Stopping;
        terminal
            .stream
            .send(TerminalEvent::Status(TerminalStatus::Stopping));

        {
            let mut writer = terminal.writer.lock();
            let _ = writer.write_all(b"exit\r");
            let _ = writer.flush();
        }
        thread::sleep(Duration::from_millis(180));
        if matches!(*terminal.status.lock(), TerminalStatus::Stopping) {
            terminal
                .killer
                .lock()
                .kill()
                .map_err(|error| TurtorgeError::ProcessTerminationFailed(error.to_string()))?;
        }
        self.terminals.lock().remove(runtime_id);
        Ok(())
    }

    pub fn terminate_all(&self) {
        let ids = self.terminals.lock().keys().cloned().collect::<Vec<_>>();
        for id in ids {
            let _ = self.close(&id);
        }
    }

    pub fn list(&self) -> Vec<TerminalRuntimeSnapshot> {
        self.terminals
            .lock()
            .values()
            .map(|terminal| terminal.snapshot())
            .collect()
    }

    fn get(&self, runtime_id: &str) -> Result<Arc<ManagedTerminal>, TurtorgeError> {
        self.terminals
            .lock()
            .get(runtime_id)
            .cloned()
            .ok_or_else(|| TurtorgeError::TerminalNotFound(runtime_id.to_owned()))
    }

    fn find_by_definition(&self, definition_id: &str) -> Option<Arc<ManagedTerminal>> {
        self.terminals
            .lock()
            .values()
            .find(|terminal| {
                terminal.definition_id == definition_id
                    && matches!(
                        *terminal.status.lock(),
                        TerminalStatus::Starting | TerminalStatus::Running
                    )
            })
            .cloned()
    }
}

impl Drop for TerminalManager {
    fn drop(&mut self) {
        self.terminate_all();
    }
}

struct BuiltCommand {
    command: CommandBuilder,
    startup_notice: Option<String>,
}

fn build_command(request: &TerminalStartRequest) -> Result<BuiltCommand, TurtorgeError> {
    let profile = &request.definition.shell_profile;
    match profile.kind {
        ShellKind::PowerShell => {
            if request.definition.working_directory.kind != PathKind::Windows {
                return Err(TurtorgeError::InvalidWorkingDirectory(
                    request.definition.working_directory.value.clone(),
                ));
            }
            let directory = &request.definition.working_directory.value;
            if !std::path::Path::new(directory).is_dir() {
                return Err(TurtorgeError::InvalidWorkingDirectory(directory.clone()));
            }
            let mut command = CommandBuilder::new(&profile.executable);
            command.arg("-NoLogo");
            command.cwd(directory);
            Ok(BuiltCommand {
                command,
                startup_notice: None,
            })
        }
        ShellKind::Wsl => {
            let distribution = profile.distribution.as_deref().ok_or_else(|| {
                TurtorgeError::Validation("WSL profile requires a distribution".to_owned())
            })?;
            let shell = profile.shell.as_deref().ok_or_else(|| {
                TurtorgeError::Validation("WSL profile requires a shell".to_owned())
            })?;
            let mut shell_check = std::process::Command::new("wsl.exe");
            shell_check.args(["-d", distribution, "--exec", "test", "-x", shell]);
            let shell_available = background_command_status(shell_check)?;
            if !shell_available.success() {
                return Err(TurtorgeError::ShellUnavailable(format!(
                    "{shell} in WSL distribution {distribution}"
                )));
            }
            let resolved = resolve_wsl_working_directory_with_fallback(
                &request.definition.working_directory,
                distribution,
            )?;
            let environment = merge_environment(
                &request.workspace_environment,
                &request.definition.environment_variables,
            );
            let mut command = CommandBuilder::new("wsl.exe");
            command.args(["-d", distribution, "--cd", &resolved.path, "--exec"]);
            if environment.is_empty() {
                command.arg(shell);
            } else {
                command.arg("/usr/bin/env");
                for (key, value) in environment {
                    command.arg(format!("{key}={value}"));
                }
                command.arg(shell);
            }
            if profile.login_shell {
                command.arg("-l");
            }
            command.arg("-i");
            Ok(BuiltCommand {
                command,
                startup_notice: resolved.used_home_fallback.then(|| {
                    "\r\n[Turtorge] The configured WSL working directory is unavailable; started in ~.\r\n"
                        .to_owned()
                }),
            })
        }
    }
}

fn startup_command(definition: &crate::models::TerminalDefinition) -> Option<String> {
    definition
        .startup_command
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| match definition.profile {
            TerminalProfileKind::ClaudeCode => Some("claude".to_owned()),
            TerminalProfileKind::Codex => Some("codex".to_owned()),
            TerminalProfileKind::Shell | TerminalProfileKind::Custom => None,
        })
}

fn spawn_reader(mut reader: Box<dyn Read + Send>, managed: Arc<ManagedTerminal>) {
    thread::spawn(move || {
        let mut bytes = vec![0_u8; 8192];
        let mut bootstrap_dsr_consumed = false;
        loop {
            match reader.read(&mut bytes) {
                Ok(0) => break,
                Ok(length) => {
                    let mut output = bytes[..length].to_vec();
                    if !bootstrap_dsr_consumed
                        && let Some(position) =
                            output.windows(4).position(|window| window == b"\x1b[6n")
                    {
                        output.drain(position..position + 4);
                        bootstrap_dsr_consumed = true;
                    }
                    if !output.is_empty() {
                        managed.stream.push(&output);
                    }
                }
                Err(error) => {
                    managed.stream.send(TerminalEvent::Error {
                        code: "PTY_READ_FAILED".to_owned(),
                        message: error.to_string(),
                    });
                    break;
                }
            }
        }
    });
}

fn spawn_waiter(
    mut child: Box<dyn portable_pty::Child + Send + Sync>,
    managed: Arc<ManagedTerminal>,
) {
    thread::spawn(move || match child.wait() {
        Ok(status) => {
            let exit_code = status.exit_code();
            *managed.status.lock() = TerminalStatus::Exited;
            *managed.exit_code.lock() = Some(exit_code);
            managed.stream.send(TerminalEvent::Exited { exit_code });
        }
        Err(error) => {
            *managed.status.lock() = TerminalStatus::Failed;
            managed.stream.send(TerminalEvent::Error {
                code: "PROCESS_WAIT_FAILED".to_owned(),
                message: error.to_string(),
            });
        }
    });
}

#[cfg(test)]
mod terminal_stream_tests {
    use super::*;

    fn test_channel() -> Channel<TerminalEvent> {
        Channel::new(|_| Ok(()))
    }

    #[test]
    fn stale_detach_does_not_clear_a_newer_subscriber() {
        let stream = TerminalStream::new("old-connection".to_owned(), test_channel());
        stream.attach("new-connection".to_owned(), test_channel());

        stream.detach("old-connection");

        let subscriber = stream.subscriber.lock();
        assert_eq!(
            subscriber
                .as_ref()
                .map(|subscriber| subscriber.connection_id.as_str()),
            Some("new-connection")
        );
    }

    #[test]
    fn current_subscriber_can_detach_and_attach_receives_scrollback() {
        let stream = TerminalStream::new("connection".to_owned(), test_channel());
        stream.push(b"terminal snapshot");

        let snapshot = stream.attach("replacement".to_owned(), test_channel());
        assert_eq!(snapshot, b"terminal snapshot");

        stream.detach("replacement");
        assert!(stream.subscriber.lock().is_none());
    }
}

#[cfg(all(test, windows))]
mod integration_tests {
    use super::*;
    use crate::models::{ShellProfile, TerminalDefinition, TerminalProfileKind, WorkspacePath};
    use crate::platform::{detect_wsl_shells, list_wsl_distributions};
    use std::sync::mpsc;

    #[test]
    #[ignore = "requires a local WSL distribution and launches real login shells"]
    fn real_wsl_login_shells_round_trip_through_a_pty() {
        run_windows_pty_smoke();
        let distributions = list_wsl_distributions().expect("WSL should be available");
        let distribution = distributions
            .iter()
            .find(|item| item.is_default)
            .or_else(|| distributions.first())
            .expect("at least one user WSL distribution should be installed");
        let detection = detect_wsl_shells(&distribution.name)
            .expect("bash or zsh should be detectable in the selected distribution");
        assert!(!detection.shells.is_empty(), "no supported WSL shell found");

        let fallback_shell = detection.shells[0].clone();
        for shell in detection.shells {
            run_wsl_shell_smoke(&distribution.name, shell);
        }
        run_wsl_missing_directory_fallback(&distribution.name, fallback_shell);
    }

    fn run_windows_pty_smoke() {
        let pty = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("PTY should open");
        let mut command = CommandBuilder::new("powershell.exe");
        command.args([
            "-NoLogo",
            "-NoProfile",
            "-Command",
            "Write-Output TURTORGE_WINDOWS_PTY_OK",
        ]);
        let mut child = pty
            .slave
            .spawn_command(command)
            .expect("PowerShell should start");
        drop(pty.slave);

        let reader = pty.master.try_clone_reader().expect("reader should clone");
        let mut writer = pty.master.take_writer().expect("writer should open");
        writer
            .write_all(b"\x1b[1;1R")
            .and_then(|_| writer.flush())
            .expect("bootstrap terminal status should be writable");
        let receiver = spawn_chunk_reader(reader);
        let output = collect_until(
            &receiver,
            "TURTORGE_WINDOWS_PTY_OK",
            Duration::from_secs(10),
            "PowerShell",
        );
        let output = String::from_utf8_lossy(&output);
        assert!(output.contains("TURTORGE_WINDOWS_PTY_OK"));
        wait_for_success(&mut child, "PowerShell");
    }

    fn run_wsl_shell_smoke(distribution: &str, shell: ShellProfile) {
        let request = TerminalStartRequest {
            workspace_id: "wsl-smoke-workspace".to_owned(),
            definition: TerminalDefinition {
                id: format!("wsl-smoke-{}", shell.id),
                name: "WSL smoke".to_owned(),
                profile: TerminalProfileKind::Shell,
                shell_profile: shell.clone(),
                working_directory: WorkspacePath {
                    kind: PathKind::Wsl,
                    value: "~".to_owned(),
                    distribution: Some(distribution.to_owned()),
                },
                startup_command: None,
                environment_variables: Vec::new(),
                auto_start: false,
            },
            workspace_environment: Vec::new(),
            cols: 80,
            rows: 24,
        };
        let pty = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("PTY should open");
        let smoke_command = build_command(&request)
            .expect("interactive WSL command should build")
            .command;
        let mut child = pty
            .slave
            .spawn_command(smoke_command)
            .expect("WSL login shell should start");
        drop(pty.slave);

        let reader = pty.master.try_clone_reader().expect("reader should clone");
        let mut writer = pty.master.take_writer().expect("writer should open");
        writer
            .write_all(b"\x1b[1;1R")
            .and_then(|_| writer.flush())
            .expect("bootstrap terminal status should be writable");
        writer
            .write_all(b"printf 'TURTORGE_PTY_OK:%s\\n' \"$0\"\r")
            .and_then(|_| writer.flush())
            .expect("interactive smoke command should be writable");
        let receiver = spawn_chunk_reader(reader);
        let output = collect_until(
            &receiver,
            "TURTORGE_PTY_OK:",
            Duration::from_secs(15),
            &shell.name,
        );
        let output = String::from_utf8_lossy(&output);
        assert!(
            output.contains("TURTORGE_PTY_OK:"),
            "{} did not return the PTY marker; output was {output:?}",
            shell.name
        );
        writer
            .write_all(b"exit\r")
            .and_then(|_| writer.flush())
            .expect("interactive shell exit should be writable");
        wait_for_success(&mut child, &shell.name);
    }

    fn run_wsl_missing_directory_fallback(distribution: &str, shell: ShellProfile) {
        let missing = format!("/tmp/turtorge-missing-{}", Uuid::new_v4());
        let request = TerminalStartRequest {
            workspace_id: "wsl-fallback-workspace".to_owned(),
            definition: TerminalDefinition {
                id: "wsl-fallback-terminal".to_owned(),
                name: "WSL fallback".to_owned(),
                profile: TerminalProfileKind::Shell,
                shell_profile: shell.clone(),
                working_directory: WorkspacePath {
                    kind: PathKind::Wsl,
                    value: missing,
                    distribution: Some(distribution.to_owned()),
                },
                startup_command: None,
                environment_variables: Vec::new(),
                auto_start: false,
            },
            workspace_environment: Vec::new(),
            cols: 80,
            rows: 24,
        };
        let pty = native_pty_system()
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .expect("PTY should open");
        let built = build_command(&request).expect("missing WSL directory should use home");
        assert!(built.startup_notice.is_some());
        let mut child = pty
            .slave
            .spawn_command(built.command)
            .expect("WSL fallback shell should start");
        drop(pty.slave);

        let reader = pty.master.try_clone_reader().expect("reader should clone");
        let mut writer = pty.master.take_writer().expect("writer should open");
        writer
            .write_all(b"\x1b[1;1R")
            .and_then(|_| writer.flush())
            .expect("bootstrap terminal status should be writable");
        writer
            .write_all(b"[ \"$PWD\" = \"$HOME\" ] && printf 'TURTORGE_WSL_HOME_FALLBACK_OK\\n'\r")
            .and_then(|_| writer.flush())
            .expect("fallback assertion should be writable");
        let receiver = spawn_chunk_reader(reader);
        collect_until(
            &receiver,
            "TURTORGE_WSL_HOME_FALLBACK_OK",
            Duration::from_secs(15),
            &shell.name,
        );
        writer
            .write_all(b"exit\r")
            .and_then(|_| writer.flush())
            .expect("interactive shell exit should be writable");
        wait_for_success(&mut child, &shell.name);
    }

    fn spawn_chunk_reader(mut reader: Box<dyn Read + Send>) -> mpsc::Receiver<Vec<u8>> {
        let (sender, receiver) = mpsc::channel();
        thread::spawn(move || {
            let mut bytes = vec![0_u8; 8192];
            loop {
                match reader.read(&mut bytes) {
                    Ok(0) | Err(_) => break,
                    Ok(length) => {
                        if sender.send(bytes[..length].to_vec()).is_err() {
                            break;
                        }
                    }
                }
            }
        });
        receiver
    }

    fn collect_until(
        receiver: &mpsc::Receiver<Vec<u8>>,
        marker: &str,
        timeout: Duration,
        process_name: &str,
    ) -> Vec<u8> {
        let started = std::time::Instant::now();
        let mut output = Vec::new();
        loop {
            let remaining = timeout.saturating_sub(started.elapsed());
            if remaining.is_zero() {
                panic!(
                    "{process_name} did not emit {marker:?}; output was {:?}",
                    String::from_utf8_lossy(&output)
                );
            }
            match receiver.recv_timeout(remaining) {
                Ok(chunk) => {
                    output.extend(chunk);
                    if String::from_utf8_lossy(&output).contains(marker) {
                        return output;
                    }
                }
                Err(error) => panic!(
                    "{process_name} output stopped before {marker:?}: {error}; output was {:?}",
                    String::from_utf8_lossy(&output)
                ),
            }
        }
    }

    fn wait_for_success(
        child: &mut Box<dyn portable_pty::Child + Send + Sync>,
        process_name: &str,
    ) {
        let started = std::time::Instant::now();
        loop {
            match child.try_wait().expect("child status should be readable") {
                Some(status) => {
                    assert_eq!(status.exit_code(), 0, "{process_name} did not exit cleanly");
                    return;
                }
                None if started.elapsed() < Duration::from_secs(5) => {
                    thread::sleep(Duration::from_millis(20));
                }
                None => {
                    let _ = child.kill();
                    panic!("{process_name} did not exit after emitting its PTY marker");
                }
            }
        }
    }
}
