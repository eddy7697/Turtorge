use crate::error::TurtorgeError;
use crate::models::{
    PathKind, ShellKind, ShellProfile, WorkspacePath, WslDistribution, WslShellDetection,
};
use semver::Version;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Output};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResolvedWslWorkingDirectory {
    pub path: String,
    pub used_home_fallback: bool,
}

fn command_output(mut command: Command) -> Result<Output, TurtorgeError> {
    configure_background_command(&mut command);
    command
        .output()
        .map_err(|error| TurtorgeError::Platform(error.to_string()))
}

pub(crate) fn background_command_status(mut command: Command) -> Result<ExitStatus, TurtorgeError> {
    configure_background_command(&mut command);
    command
        .status()
        .map_err(|error| TurtorgeError::Platform(error.to_string()))
}

fn configure_background_command(command: &mut Command) {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
}

pub fn decode_command_output(bytes: &[u8]) -> String {
    let appears_utf16 = bytes.len() >= 2
        && bytes
            .chunks_exact(2)
            .take(32)
            .filter(|pair| pair[1] == 0)
            .count()
            >= 3;
    if appears_utf16 {
        let units = bytes
            .chunks_exact(2)
            .map(|pair| u16::from_le_bytes([pair[0], pair[1]]))
            .collect::<Vec<_>>();
        String::from_utf16_lossy(&units)
    } else {
        String::from_utf8_lossy(bytes).into_owned()
    }
}

pub fn detect_windows_shells() -> Vec<ShellProfile> {
    let mut shells = powershell_candidates()
        .into_iter()
        .filter_map(|executable| {
            let mut command = Command::new(&executable);
            command.args([
                "-NoLogo",
                "-NoProfile",
                "-Command",
                "$PSVersionTable.PSVersion.ToString()",
            ]);
            let output = command_output(command).ok()?;
            if !output.status.success() {
                return None;
            }
            let version = decode_command_output(&output.stdout).trim().to_owned();
            let parsed = Version::parse(&normalize_version(&version)).ok();
            let major = parsed.as_ref().map(|item| item.major).unwrap_or_default();
            let executable = executable.to_string_lossy().into_owned();
            let stable_path_id = executable
                .to_ascii_lowercase()
                .chars()
                .map(|character| {
                    if character.is_ascii_alphanumeric() {
                        character
                    } else {
                        '-'
                    }
                })
                .collect::<String>();
            Some((
                parsed,
                ShellProfile {
                    id: format!("powershell-{version}-{stable_path_id}"),
                    name: if major >= 6 {
                        format!("PowerShell {version}")
                    } else {
                        format!("Windows PowerShell {version}")
                    },
                    kind: ShellKind::PowerShell,
                    executable,
                    version: Some(version),
                    distribution: None,
                    shell: None,
                    login_shell: false,
                    available: true,
                },
            ))
        })
        .collect::<Vec<_>>();

    shells.sort_by(|left, right| right.0.cmp(&left.0));
    shells.into_iter().map(|(_, shell)| shell).collect()
}

fn powershell_candidates() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    for executable in ["pwsh.exe", "powershell.exe"] {
        let mut command = Command::new("where.exe");
        command.arg(executable);
        if let Ok(output) = command_output(command)
            && output.status.success()
        {
            candidates.extend(
                decode_command_output(&output.stdout)
                    .lines()
                    .map(str::trim)
                    .filter(|line| !line.is_empty())
                    .map(PathBuf::from),
            );
        }
    }

    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        let power_shell_root = PathBuf::from(program_files).join("PowerShell");
        if let Ok(entries) = std::fs::read_dir(power_shell_root) {
            candidates.extend(
                entries
                    .flatten()
                    .map(|entry| entry.path().join("pwsh.exe"))
                    .filter(|path| path.is_file()),
            );
        }
    }
    if let Some(windows) = std::env::var_os("WINDIR") {
        let legacy = PathBuf::from(windows)
            .join("System32")
            .join("WindowsPowerShell")
            .join("v1.0")
            .join("powershell.exe");
        if legacy.is_file() {
            candidates.push(legacy);
        }
    }

    for fallback in ["pwsh.exe", "powershell.exe"] {
        let already_has_kind = candidates.iter().any(|candidate| {
            candidate
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case(fallback))
        });
        if !already_has_kind {
            candidates.push(PathBuf::from(fallback));
        }
    }

    let mut seen = HashSet::new();
    candidates.retain(|candidate| {
        let key = candidate
            .canonicalize()
            .unwrap_or_else(|_| candidate.clone())
            .to_string_lossy()
            .to_ascii_lowercase();
        seen.insert(key)
    });
    candidates
}

fn normalize_version(version: &str) -> String {
    let parts = version.split('.').collect::<Vec<_>>();
    match parts.len() {
        0 => "0.0.0".to_owned(),
        1 => format!("{}.0.0", parts[0]),
        2 => format!("{}.{}.0", parts[0], parts[1]),
        _ => parts[..3].join("."),
    }
}

pub fn list_wsl_distributions() -> Result<Vec<WslDistribution>, TurtorgeError> {
    let mut command = Command::new("wsl.exe");
    command.args(["--list", "--verbose"]);
    let output = command_output(command)?;
    if !output.status.success() {
        return Ok(Vec::new());
    }
    Ok(parse_wsl_distributions(&decode_command_output(
        &output.stdout,
    )))
}

pub fn parse_wsl_distributions(input: &str) -> Vec<WslDistribution> {
    input
        .lines()
        .map(|line| line.trim_matches(['\u{feff}', '\0', '\r', '\n', ' ']))
        .filter(|line| !line.is_empty() && !line.to_ascii_uppercase().starts_with("NAME"))
        .filter_map(|line| {
            let is_default = line.starts_with('*');
            let cleaned = line.trim_start_matches('*').trim();
            let parts = cleaned.split_whitespace().collect::<Vec<_>>();
            if parts.len() < 3 {
                return None;
            }
            let name = parts[0].to_owned();
            if name.eq_ignore_ascii_case("docker-desktop")
                || name.eq_ignore_ascii_case("docker-desktop-data")
            {
                return None;
            }
            let state = parts[1].to_ascii_lowercase();
            let version = parts[2].parse::<u8>().unwrap_or(2);
            Some(WslDistribution {
                name,
                is_default,
                is_running: state == "running",
                version,
            })
        })
        .collect()
}

pub fn detect_wsl_shells(distribution: &str) -> Result<WslShellDetection, TurtorgeError> {
    ensure_known_distribution(distribution)?;
    let script = r#"
default_shell="$(getent passwd "$(id -un)" 2>/dev/null | cut -d: -f7)"
printf 'DEFAULT\t%s\n' "$default_shell"
for shell_name in zsh bash; do
  shell_path="$(command -v "$shell_name" 2>/dev/null)" || continue
  if [ -n "$shell_path" ]; then
    shell_version="$($shell_path --version 2>/dev/null | head -n 1)"
    printf 'SHELL\t%s\t%s\t%s\n' "$shell_name" "$shell_path" "$shell_version"
  fi
done
"#;
    let mut command = Command::new("wsl.exe");
    command.args(["-d", distribution, "--exec", "sh", "-c", script]);
    let output = command_output(command)?;
    if !output.status.success() {
        return Err(TurtorgeError::Platform(
            decode_command_output(&output.stderr).trim().to_owned(),
        ));
    }

    let text = decode_command_output(&output.stdout);
    let mut default_shell = None;
    let mut shells = Vec::new();
    for line in text.lines() {
        let parts = line.trim().splitn(4, '\t').collect::<Vec<_>>();
        match parts.as_slice() {
            ["DEFAULT", path] if !path.is_empty() => default_shell = Some((*path).to_owned()),
            ["SHELL", name, path, version] => shells.push(ShellProfile {
                id: format!("wsl-{distribution}-{name}"),
                name: format!("WSL {distribution} · {name}"),
                kind: ShellKind::Wsl,
                executable: "wsl.exe".to_owned(),
                version: Some((*version).to_owned()),
                distribution: Some(distribution.to_owned()),
                shell: Some((*path).to_owned()),
                login_shell: true,
                available: true,
            }),
            _ => {}
        }
    }
    shells.sort_by_key(|profile| {
        let is_default = default_shell
            .as_ref()
            .zip(profile.shell.as_ref())
            .is_some_and(|(default, shell)| default == shell);
        !is_default
    });

    Ok(WslShellDetection {
        distribution: distribution.to_owned(),
        default_shell,
        shells,
    })
}

fn ensure_known_distribution(distribution: &str) -> Result<(), TurtorgeError> {
    if distribution.is_empty()
        || !distribution
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-_.".contains(character))
    {
        return Err(TurtorgeError::Validation(
            "Invalid WSL distribution name".to_owned(),
        ));
    }
    Ok(())
}

pub fn validate_workspace_path(path: &WorkspacePath) -> Result<bool, TurtorgeError> {
    match path.kind {
        PathKind::Windows => Ok(Path::new(&path.value).is_dir()),
        PathKind::Wsl => {
            let distribution = path.distribution.as_deref().ok_or_else(|| {
                TurtorgeError::Validation("WSL path requires a distribution".to_owned())
            })?;
            ensure_known_distribution(distribution)?;
            let expanded = expand_wsl_home_path(&path.value, distribution)?;
            wsl_directory_exists(distribution, &expanded)
        }
    }
}

pub fn resolve_wsl_working_directory_with_fallback(
    path: &WorkspacePath,
    distribution: &str,
) -> Result<ResolvedWslWorkingDirectory, TurtorgeError> {
    let configured = resolve_wsl_working_directory(path, distribution)?;
    if wsl_directory_exists(distribution, &configured)? {
        return Ok(ResolvedWslWorkingDirectory {
            path: configured,
            used_home_fallback: false,
        });
    }

    let home = expand_wsl_home_path("~", distribution)?;
    if !wsl_directory_exists(distribution, &home)? {
        return Err(TurtorgeError::InvalidWorkingDirectory(
            "WSL home directory is unavailable".to_owned(),
        ));
    }
    Ok(ResolvedWslWorkingDirectory {
        path: home,
        used_home_fallback: true,
    })
}

pub fn resolve_wsl_working_directory(
    path: &WorkspacePath,
    distribution: &str,
) -> Result<String, TurtorgeError> {
    ensure_known_distribution(distribution)?;
    match path.kind {
        PathKind::Wsl => {
            if let Some(owner) = &path.distribution
                && owner != distribution
            {
                return Err(TurtorgeError::InvalidWorkingDirectory(format!(
                    "{} belongs to WSL distribution {owner}",
                    path.value
                )));
            }
            expand_wsl_home_path(&path.value, distribution)
        }
        PathKind::Windows => {
            if let Some(linux_path) = wsl_share_path_to_linux(&path.value, distribution) {
                return Ok(linux_path);
            }
            let mut command = Command::new("wsl.exe");
            command.args([
                "-d",
                distribution,
                "--exec",
                "wslpath",
                "-a",
                "-u",
                &path.value,
            ]);
            let output = command_output(command)?;
            if !output.status.success() {
                return Err(TurtorgeError::InvalidWorkingDirectory(path.value.clone()));
            }
            Ok(decode_command_output(&output.stdout).trim().to_owned())
        }
    }
}

fn wsl_directory_exists(distribution: &str, path: &str) -> Result<bool, TurtorgeError> {
    let mut command = Command::new("wsl.exe");
    command.args(["-d", distribution, "--exec", "test", "-d", path]);
    let status = background_command_status(command)?;
    Ok(status.success())
}

fn wsl_share_path_to_linux(path: &str, distribution: &str) -> Option<String> {
    let mut normalized = path.trim().replace('/', "\\");
    if let Some(remainder) = normalized.strip_prefix("\\\\?\\UNC\\") {
        normalized = format!("\\\\{remainder}");
    }

    for host in ["wsl.localhost", "wsl$"] {
        let prefix = format!("\\\\{host}\\{distribution}");
        let Some(candidate_prefix) = normalized.get(..prefix.len()) else {
            continue;
        };
        if !candidate_prefix.eq_ignore_ascii_case(&prefix) {
            continue;
        }
        let remainder = &normalized[prefix.len()..];
        if remainder.is_empty() {
            return Some("/".to_owned());
        }
        let relative = remainder.strip_prefix('\\')?;
        return Some(format!("/{}", relative.replace('\\', "/")));
    }
    None
}

pub fn wsl_path_to_unc(path: &str, distribution: &str) -> Result<String, TurtorgeError> {
    ensure_known_distribution(distribution)?;
    if !path.starts_with('/') {
        return Err(TurtorgeError::InvalidWorkingDirectory(path.to_owned()));
    }
    let relative = path.trim_start_matches('/').replace('/', "\\");
    Ok(if relative.is_empty() {
        format!(r"\\wsl.localhost\{distribution}")
    } else {
        format!(r"\\wsl.localhost\{distribution}\{relative}")
    })
}

fn expand_wsl_home_path(path: &str, distribution: &str) -> Result<String, TurtorgeError> {
    if path != "~" && !path.starts_with("~/") {
        return Ok(path.to_owned());
    }
    let mut command = Command::new("wsl.exe");
    command.args([
        "-d",
        distribution,
        "--exec",
        "sh",
        "-c",
        "printf '%s' \"$HOME\"",
    ]);
    let output = command_output(command)?;
    if !output.status.success() {
        return Err(TurtorgeError::InvalidWorkingDirectory(path.to_owned()));
    }
    let home = decode_command_output(&output.stdout).trim().to_owned();
    if home.is_empty() {
        return Err(TurtorgeError::InvalidWorkingDirectory(path.to_owned()));
    }
    Ok(if path == "~" {
        home
    } else {
        format!("{home}/{}", path.trim_start_matches("~/"))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_utf16le_wsl_output() {
        let text = "Ubuntu-20.04\r\n";
        let bytes = text
            .encode_utf16()
            .flat_map(u16::to_le_bytes)
            .collect::<Vec<_>>();
        assert_eq!(decode_command_output(&bytes), text);
    }

    #[test]
    fn hides_docker_internal_distributions() {
        let parsed = parse_wsl_distributions(
            "  NAME STATE VERSION\r\n* Ubuntu-20.04 Running 2\r\n  docker-desktop Running 2\r\n",
        );
        assert_eq!(parsed.len(), 1);
        assert!(parsed[0].is_default);
        assert_eq!(parsed[0].name, "Ubuntu-20.04");
    }

    #[test]
    fn normalizes_short_versions() {
        assert_eq!(normalize_version("7.5"), "7.5.0");
        assert_eq!(normalize_version("5"), "5.0.0");
    }

    #[test]
    fn converts_wsl_network_share_paths_to_linux_paths() {
        assert_eq!(
            wsl_share_path_to_linux(
                r"\\wsl.localhost\Ubuntu-24.04\home\vince\projects\app",
                "Ubuntu-24.04",
            ),
            Some("/home/vince/projects/app".to_owned())
        );
        assert_eq!(
            wsl_share_path_to_linux(r"\\wsl$\Ubuntu-24.04", "Ubuntu-24.04"),
            Some("/".to_owned())
        );
        assert_eq!(
            wsl_share_path_to_linux(r"\\wsl.localhost\Debian\home\vince", "Ubuntu-24.04",),
            None
        );
    }

    #[test]
    fn converts_linux_paths_to_wsl_network_share_paths() {
        assert_eq!(
            wsl_path_to_unc("/home/dev/project", "Ubuntu-24.04").unwrap(),
            r"\\wsl.localhost\Ubuntu-24.04\home\dev\project"
        );
        assert!(wsl_path_to_unc("relative", "Ubuntu-24.04").is_err());
    }
}
