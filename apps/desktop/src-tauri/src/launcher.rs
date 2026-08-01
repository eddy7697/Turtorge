use crate::error::TurtorgeError;
use crate::models::{
    AppSettings, LauncherDetectionMode, LauncherIcon, LauncherLaunchResult, LauncherOpenRequest,
    LauncherProfile, LauncherProfileStatus, LauncherValidationResult, PathKind, WorkspacePath,
};
use crate::platform;
use std::collections::{BTreeMap, HashSet};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const DETACHED_PROCESS: u32 = 0x0000_0008;
#[cfg(windows)]
const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const PATH_PLACEHOLDERS: [&str; 3] = ["{path}", "{wslPath}", "{projectRoot}"];
const ALL_PLACEHOLDERS: [&str; 4] = ["{path}", "{wslPath}", "{distribution}", "{projectRoot}"];

pub fn launcher_statuses(settings: &AppSettings) -> Vec<LauncherProfileStatus> {
    built_in_profiles()
        .into_iter()
        .chain(settings.launcher_profiles.iter().cloned())
        .map(|profile| {
            let validation = validate_profile(&profile);
            LauncherProfileStatus {
                available: validation.valid && validation.resolved_program.is_some(),
                resolved_program: validation.resolved_program,
                unavailable_reason: validation.errors.first().cloned(),
                profile,
            }
        })
        .collect()
}

pub fn validate_profile(profile: &LauncherProfile) -> LauncherValidationResult {
    let mut errors = validate_profile_definition(profile);
    let resolved_program = if errors.is_empty() {
        resolve_profile_program(profile, None)
    } else {
        None
    };

    if resolved_program.is_none() && errors.is_empty() {
        errors.push(match profile.detection_mode {
            LauncherDetectionMode::Auto => format!(
                "{} was not found in PATH or a trusted installation location. Locate the executable to continue.",
                profile.name
            ),
            LauncherDetectionMode::Manual => format!(
                "The configured program for {} does not exist. Choose an executable to continue.",
                profile.name
            ),
        });
    }

    LauncherValidationResult {
        valid: errors.is_empty(),
        errors,
        resolved_program: resolved_program.map(|path| path.to_string_lossy().into_owned()),
    }
}

pub fn open(
    settings: &AppSettings,
    request: LauncherOpenRequest,
) -> Result<LauncherLaunchResult, TurtorgeError> {
    let profile_id = request
        .profile_id
        .or_else(|| settings.default_launcher_profile_id.clone())
        .ok_or_else(|| {
            TurtorgeError::LauncherUnavailable(
                "No default launcher is configured. Choose how this folder should open first."
                    .to_owned(),
            )
        })?;
    let profile = find_profile(settings, &profile_id).ok_or_else(|| {
        TurtorgeError::LauncherUnavailable(format!(
            "Launcher profile {profile_id} no longer exists. Choose another launcher."
        ))
    })?;
    let definition_errors = validate_profile_definition(&profile);
    if !definition_errors.is_empty() {
        return Err(TurtorgeError::Validation(definition_errors.join(" ")));
    }

    let context = resolve_path_context(&request.path)?;
    if profile.id == "builtin-unity" {
        if request.path.kind == PathKind::Wsl {
            return Err(TurtorgeError::LauncherUnavailable(
                "Unity projects can only be opened from Windows paths in this version.".to_owned(),
            ));
        }
        let version = context.unity_version.as_deref().ok_or_else(|| {
            TurtorgeError::Validation(
                "This folder is not a Unity project with Assets, ProjectSettings, and ProjectVersion.txt."
                    .to_owned(),
            )
        })?;
        if find_exact_unity_editor(version).is_none() {
            let installed = installed_unity_editors()
                .into_keys()
                .collect::<Vec<_>>()
                .join(", ");
            let detail = if installed.is_empty() {
                "No Unity editors were detected in Unity Hub.".to_owned()
            } else {
                format!("Detected versions: {installed}.")
            };
            return Err(TurtorgeError::LauncherUnavailable(format!(
                "This project requires Unity {version}, but that exact editor is unavailable. {detail} Install the matching version or choose another launcher."
            )));
        }
    }
    let program = resolve_profile_program(&profile, Some(&context)).ok_or_else(|| {
        TurtorgeError::LauncherUnavailable(format!(
            "{} was not found. Locate its executable in Launcher settings.",
            profile.name
        ))
    })?;
    let templates = if request.path.kind == PathKind::Wsl {
        profile.wsl_arguments.as_ref().unwrap_or(&profile.arguments)
    } else {
        &profile.arguments
    };
    let arguments = expand_arguments(templates, &context)?;
    spawn_detached(&program, &arguments)?;

    Ok(LauncherLaunchResult {
        profile_id: profile.id,
        program: program.to_string_lossy().into_owned(),
        arguments,
    })
}

fn find_profile(settings: &AppSettings, id: &str) -> Option<LauncherProfile> {
    built_in_profiles()
        .into_iter()
        .chain(settings.launcher_profiles.iter().cloned())
        .find(|profile| profile.id == id)
}

fn validate_profile_definition(profile: &LauncherProfile) -> Vec<String> {
    let mut errors = Vec::new();
    if profile.name.trim().is_empty() {
        errors.push("Launcher name is required.".to_owned());
    }
    if profile.program.trim().is_empty() {
        errors.push("Program is required.".to_owned());
    }
    if profile.arguments.is_empty()
        || !profile.arguments.iter().any(|argument| {
            PATH_PLACEHOLDERS
                .iter()
                .any(|token| argument.contains(token))
        })
    {
        errors.push("Arguments must include {path}, {wslPath}, or {projectRoot}.".to_owned());
    }
    if let Some(arguments) = &profile.wsl_arguments
        && !arguments.iter().any(|argument| {
            PATH_PLACEHOLDERS
                .iter()
                .any(|token| argument.contains(token))
        })
    {
        errors.push("WSL arguments must include {path}, {wslPath}, or {projectRoot}.".to_owned());
    }
    for value in std::iter::once(&profile.program)
        .chain(profile.arguments.iter())
        .chain(profile.wsl_arguments.iter().flatten())
    {
        if value.contains(['\0', '\r', '\n']) {
            errors
                .push("Programs and arguments cannot contain line breaks or NUL bytes.".to_owned());
            break;
        }
    }
    for argument in profile
        .arguments
        .iter()
        .chain(profile.wsl_arguments.iter().flatten())
    {
        for placeholder in extract_placeholders(argument) {
            if !ALL_PLACEHOLDERS.contains(&placeholder.as_str()) {
                errors.push(format!("Unknown launcher placeholder: {placeholder}."));
            }
        }
    }
    let extension = Path::new(profile.program.trim())
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "ps1" {
        errors.push("PowerShell scripts (.ps1) are not supported as launchers.".to_owned());
    } else if !extension.is_empty() && !["exe", "com", "cmd", "bat"].contains(&extension.as_str()) {
        errors.push("Program must resolve to an .exe, .com, .cmd, or .bat file.".to_owned());
    }
    errors
}

fn extract_placeholders(value: &str) -> Vec<String> {
    let mut placeholders = Vec::new();
    let mut remainder = value;
    while let Some(start) = remainder.find('{') {
        let after_start = &remainder[start..];
        let Some(end) = after_start.find('}') else {
            break;
        };
        placeholders.push(after_start[..=end].to_owned());
        remainder = &after_start[end + 1..];
    }
    placeholders
}

#[derive(Debug)]
struct PathContext {
    windows_path: String,
    wsl_path: Option<String>,
    distribution: Option<String>,
    project_root: Option<String>,
    unity_version: Option<String>,
}

fn resolve_path_context(path: &WorkspacePath) -> Result<PathContext, TurtorgeError> {
    match path.kind {
        PathKind::Windows => {
            let directory = PathBuf::from(path.value.trim());
            if !directory.is_dir() {
                return Err(TurtorgeError::InvalidWorkingDirectory(path.value.clone()));
            }
            let project_root =
                find_project_root(&directory).map(|root| root.to_string_lossy().into_owned());
            let unity_version = project_root.as_deref().and_then(read_unity_project_version);
            Ok(PathContext {
                windows_path: directory.to_string_lossy().into_owned(),
                wsl_path: None,
                distribution: None,
                project_root,
                unity_version,
            })
        }
        PathKind::Wsl => {
            let distribution = path.distribution.as_deref().ok_or_else(|| {
                TurtorgeError::Validation("WSL path requires a distribution.".to_owned())
            })?;
            let wsl_path = platform::resolve_wsl_working_directory(path, distribution)?;
            if !platform::validate_workspace_path(&WorkspacePath {
                kind: PathKind::Wsl,
                value: wsl_path.clone(),
                distribution: Some(distribution.to_owned()),
            })? {
                return Err(TurtorgeError::InvalidWorkingDirectory(path.value.clone()));
            }
            let windows_path = platform::wsl_path_to_unc(&wsl_path, distribution)?;
            let project_root = find_project_root(Path::new(&windows_path))
                .map(|root| root.to_string_lossy().into_owned());
            Ok(PathContext {
                windows_path,
                wsl_path: Some(wsl_path),
                distribution: Some(distribution.to_owned()),
                project_root,
                unity_version: None,
            })
        }
    }
}

fn expand_arguments(
    templates: &[String],
    context: &PathContext,
) -> Result<Vec<String>, TurtorgeError> {
    templates
        .iter()
        .map(|template| {
            let mut value = template.replace("{path}", &context.windows_path);
            if value.contains("{wslPath}") {
                let wsl_path = context.wsl_path.as_deref().ok_or_else(|| {
                    TurtorgeError::Validation(
                        "{wslPath} can only be used with a WSL working directory.".to_owned(),
                    )
                })?;
                value = value.replace("{wslPath}", wsl_path);
            }
            if value.contains("{distribution}") {
                let distribution = context.distribution.as_deref().ok_or_else(|| {
                    TurtorgeError::Validation(
                        "{distribution} can only be used with a WSL working directory.".to_owned(),
                    )
                })?;
                value = value.replace("{distribution}", distribution);
            }
            if value.contains("{projectRoot}") {
                let project_root = context.project_root.as_deref().ok_or_else(|| {
                    TurtorgeError::Validation(
                        "No project root was detected above this working directory.".to_owned(),
                    )
                })?;
                value = value.replace("{projectRoot}", project_root);
            }
            Ok(value)
        })
        .collect()
}

fn find_project_root(start: &Path) -> Option<PathBuf> {
    start.ancestors().find_map(|directory| {
        let unity = directory.join("Assets").is_dir() && directory.join("ProjectSettings").is_dir();
        let marker = [".git", "package.json", "Cargo.toml", "pyproject.toml"]
            .iter()
            .any(|name| directory.join(name).exists());
        (unity || marker).then(|| directory.to_path_buf())
    })
}

fn read_unity_project_version(project_root: &str) -> Option<String> {
    let contents = std::fs::read_to_string(
        Path::new(project_root)
            .join("ProjectSettings")
            .join("ProjectVersion.txt"),
    )
    .ok()?;
    contents.lines().find_map(|line| {
        line.trim()
            .strip_prefix("m_EditorVersion:")
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .map(str::to_owned)
    })
}

fn resolve_profile_program(
    profile: &LauncherProfile,
    context: Option<&PathContext>,
) -> Option<PathBuf> {
    if profile.id == "builtin-unity" {
        if let Some(context) = context {
            return context
                .unity_version
                .as_deref()
                .and_then(find_exact_unity_editor);
        }
    }

    match profile.detection_mode {
        LauncherDetectionMode::Manual => {
            let path = PathBuf::from(profile.program.trim());
            path.is_file().then_some(path)
        }
        LauncherDetectionMode::Auto => auto_detect_program(profile),
    }
}

fn auto_detect_program(profile: &LauncherProfile) -> Option<PathBuf> {
    let configured = PathBuf::from(profile.program.trim());
    if configured.components().count() > 1 && configured.is_file() {
        return Some(configured);
    }

    let mut candidates = known_candidates(&profile.id);
    candidates.extend(path_candidates(profile.program.trim()));
    let mut seen = HashSet::new();
    candidates.into_iter().find(|candidate| {
        let key = candidate.to_string_lossy().to_ascii_lowercase();
        seen.insert(key) && candidate.is_file()
    })
}

fn path_candidates(program: &str) -> Vec<PathBuf> {
    let configured = Path::new(program);
    let has_extension = configured.extension().is_some();
    let extensions = std::env::var("PATHEXT")
        .unwrap_or_else(|_| ".EXE;.COM;.CMD;.BAT".to_owned())
        .split(';')
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
        .collect::<Vec<_>>();
    std::env::split_paths(&std::env::var_os("PATH").unwrap_or_default())
        .flat_map(|directory| {
            let mut paths = vec![directory.join(program)];
            if !has_extension {
                paths.extend(
                    extensions
                        .iter()
                        .map(|extension| directory.join(format!("{program}{extension}"))),
                );
            }
            paths
        })
        .collect()
}

fn known_candidates(profile_id: &str) -> Vec<PathBuf> {
    let local_app_data = std::env::var_os("LOCALAPPDATA").map(PathBuf::from);
    let program_files = std::env::var_os("ProgramFiles").map(PathBuf::from);
    let program_files_x86 = std::env::var_os("ProgramFiles(x86)").map(PathBuf::from);
    let mut candidates = Vec::new();
    match profile_id {
        "builtin-explorer" => {
            if let Some(windows) = std::env::var_os("WINDIR") {
                candidates.push(PathBuf::from(windows).join("explorer.exe"));
            }
        }
        "builtin-vscode" => {
            if let Some(root) = &local_app_data {
                candidates.push(root.join("Programs/Microsoft VS Code/Code.exe"));
            }
            for root in [&program_files, &program_files_x86].into_iter().flatten() {
                candidates.push(root.join("Microsoft VS Code/Code.exe"));
            }
        }
        "builtin-cursor" => {
            if let Some(root) = &local_app_data {
                candidates.push(root.join("Programs/cursor/Cursor.exe"));
            }
        }
        "builtin-antigravity" => {
            if let Some(root) = &local_app_data {
                candidates.push(root.join("Programs/Antigravity/Antigravity.exe"));
                candidates.push(root.join("Antigravity/Antigravity.exe"));
            }
        }
        "builtin-zed" => {
            if let Some(root) = &local_app_data {
                candidates.push(root.join("Programs/Zed/Zed.exe"));
            }
        }
        "builtin-intellij" => {
            candidates.extend(jetbrains_candidates("IntelliJ IDEA", "idea64.exe"))
        }
        "builtin-rider" => {
            candidates.extend(jetbrains_candidates("JetBrains Rider", "rider64.exe"))
        }
        "builtin-webstorm" => candidates.extend(jetbrains_candidates("WebStorm", "webstorm64.exe")),
        "builtin-pycharm" => candidates.extend(jetbrains_candidates("PyCharm", "pycharm64.exe")),
        "builtin-unity" => candidates.extend(installed_unity_editors().into_values()),
        _ => {}
    }
    candidates
}

fn jetbrains_candidates(product_prefix: &str, executable: &str) -> Vec<PathBuf> {
    let Some(program_files) = std::env::var_os("ProgramFiles") else {
        return Vec::new();
    };
    let root = PathBuf::from(program_files).join("JetBrains");
    let mut paths = std::fs::read_dir(root)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().into_owned();
            (name.starts_with(product_prefix)
                && !name.to_ascii_lowercase().contains("eap")
                && !name.to_ascii_lowercase().contains("preview"))
            .then(|| entry.path().join("bin").join(executable))
        })
        .collect::<Vec<_>>();
    paths.sort_by(|left, right| right.cmp(left));
    paths
}

fn installed_unity_editors() -> BTreeMap<String, PathBuf> {
    let Some(program_files) = std::env::var_os("ProgramFiles") else {
        return BTreeMap::new();
    };
    let root = PathBuf::from(program_files).join("Unity/Hub/Editor");
    std::fs::read_dir(root)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|entry| {
            let executable = entry.path().join("Editor/Unity.exe");
            executable
                .is_file()
                .then(|| (entry.file_name().to_string_lossy().into_owned(), executable))
        })
        .collect()
}

fn find_exact_unity_editor(version: &str) -> Option<PathBuf> {
    installed_unity_editors().remove(version)
}

fn spawn_detached(program: &Path, arguments: &[String]) -> Result<(), TurtorgeError> {
    let extension = program
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut command = match extension.as_str() {
        "exe" | "com" => {
            let mut command = Command::new(program);
            command.args(arguments);
            command
        }
        "cmd" | "bat" => {
            let command_line = build_cmd_command_line(program, arguments)?;
            let mut command = Command::new("cmd.exe");
            command.args(["/D", "/S", "/V:OFF", "/C", &command_line]);
            command
        }
        "ps1" => {
            return Err(TurtorgeError::Validation(
                "PowerShell scripts (.ps1) are not supported as launchers.".to_owned(),
            ));
        }
        _ => {
            return Err(TurtorgeError::Validation(
                "Launcher must resolve to an .exe, .com, .cmd, or .bat file.".to_owned(),
            ));
        }
    };
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP | CREATE_NO_WINDOW);
    command
        .spawn()
        .map(|_| ())
        .map_err(|error| TurtorgeError::LauncherFailed(error.to_string()))
}

fn build_cmd_command_line(program: &Path, arguments: &[String]) -> Result<String, TurtorgeError> {
    let values = std::iter::once(program.to_string_lossy().into_owned())
        .chain(arguments.iter().cloned())
        .collect::<Vec<_>>();
    if values
        .iter()
        .any(|value| value.contains(['\0', '\r', '\n', '"', '%', '!']))
    {
        return Err(TurtorgeError::Validation(
            "Batch launchers cannot receive quotes, percent signs, exclamation marks, or line breaks. Choose a direct executable for this path."
                .to_owned(),
        ));
    }
    Ok(values
        .iter()
        .map(|value| format!("\"{value}\""))
        .collect::<Vec<_>>()
        .join(" "))
}

fn built_in_profiles() -> Vec<LauncherProfile> {
    vec![
        built_in(
            "builtin-explorer",
            "File Explorer",
            "explorer.exe",
            vec!["{path}"],
            None,
            LauncherIcon::Explorer,
        ),
        built_in(
            "builtin-vscode",
            "Visual Studio Code",
            "code",
            vec!["{path}"],
            Some(vec!["--remote", "wsl+{distribution}", "{wslPath}"]),
            LauncherIcon::VsCode,
        ),
        built_in(
            "builtin-cursor",
            "Cursor",
            "cursor",
            vec!["{path}"],
            Some(vec!["--remote", "wsl+{distribution}", "{wslPath}"]),
            LauncherIcon::Cursor,
        ),
        built_in(
            "builtin-antigravity",
            "Antigravity",
            "antigravity",
            vec!["{path}"],
            None,
            LauncherIcon::Antigravity,
        ),
        built_in(
            "builtin-zed",
            "Zed",
            "zed",
            vec!["{path}"],
            None,
            LauncherIcon::Zed,
        ),
        built_in(
            "builtin-intellij",
            "IntelliJ IDEA",
            "idea64",
            vec!["{path}"],
            None,
            LauncherIcon::IntelliJ,
        ),
        built_in(
            "builtin-rider",
            "JetBrains Rider",
            "rider64",
            vec!["{path}"],
            None,
            LauncherIcon::Rider,
        ),
        built_in(
            "builtin-webstorm",
            "WebStorm",
            "webstorm64",
            vec!["{path}"],
            None,
            LauncherIcon::WebStorm,
        ),
        built_in(
            "builtin-pycharm",
            "PyCharm",
            "pycharm64",
            vec!["{path}"],
            None,
            LauncherIcon::PyCharm,
        ),
        built_in(
            "builtin-unity",
            "Unity",
            "Unity.exe",
            vec!["-projectPath", "{projectRoot}"],
            None,
            LauncherIcon::Unity,
        ),
    ]
}

fn built_in(
    id: &str,
    name: &str,
    program: &str,
    arguments: Vec<&str>,
    wsl_arguments: Option<Vec<&str>>,
    icon: LauncherIcon,
) -> LauncherProfile {
    LauncherProfile {
        id: id.to_owned(),
        name: name.to_owned(),
        program: program.to_owned(),
        arguments: arguments.into_iter().map(str::to_owned).collect(),
        wsl_arguments: wsl_arguments.map(|items| items.into_iter().map(str::to_owned).collect()),
        detection_mode: LauncherDetectionMode::Auto,
        icon,
        accent: None,
        built_in: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn custom_profile(arguments: Vec<&str>) -> LauncherProfile {
        LauncherProfile {
            id: "custom-test".to_owned(),
            name: "Test".to_owned(),
            program: "test.exe".to_owned(),
            arguments: arguments.into_iter().map(str::to_owned).collect(),
            wsl_arguments: None,
            detection_mode: LauncherDetectionMode::Auto,
            icon: LauncherIcon::AppWindow,
            accent: None,
            built_in: false,
        }
    }

    #[test]
    fn profile_requires_a_path_placeholder() {
        let errors = validate_profile_definition(&custom_profile(vec!["--reuse-window"]));
        assert!(errors.iter().any(|error| error.contains("must include")));
    }

    #[test]
    fn profile_rejects_unknown_placeholders_and_powershell_scripts() {
        let mut profile = custom_profile(vec!["{path}", "{unknown}"]);
        profile.program = "launch.ps1".to_owned();
        let errors = validate_profile_definition(&profile);
        assert!(errors.iter().any(|error| error.contains("Unknown")));
        assert!(errors.iter().any(|error| error.contains("PowerShell")));
    }

    #[test]
    fn expands_windows_path_arguments_without_a_shell() {
        let context = PathContext {
            windows_path: r"C:\Projects\A & B".to_owned(),
            wsl_path: None,
            distribution: None,
            project_root: Some(r"C:\Projects\A & B".to_owned()),
            unity_version: None,
        };
        assert_eq!(
            expand_arguments(&["--folder".to_owned(), "{path}".to_owned()], &context).unwrap(),
            vec!["--folder", r"C:\Projects\A & B"]
        );
    }

    #[test]
    fn expands_wsl_remote_arguments() {
        let context = PathContext {
            windows_path: r"\\wsl.localhost\Ubuntu\home\dev\app".to_owned(),
            wsl_path: Some("/home/dev/app".to_owned()),
            distribution: Some("Ubuntu".to_owned()),
            project_root: None,
            unity_version: None,
        };
        assert_eq!(
            expand_arguments(
                &[
                    "--remote".to_owned(),
                    "wsl+{distribution}".to_owned(),
                    "{wslPath}".to_owned()
                ],
                &context,
            )
            .unwrap(),
            vec!["--remote", "wsl+Ubuntu", "/home/dev/app"]
        );
    }

    #[test]
    fn batch_command_quotes_spaces_and_shell_metacharacters() {
        assert_eq!(
            build_cmd_command_line(
                Path::new(r"C:\Program Files\tool.cmd"),
                &[r"C:\Projects\A & B".to_owned()],
            )
            .unwrap(),
            r#""C:\Program Files\tool.cmd" "C:\Projects\A & B""#
        );
    }
}
