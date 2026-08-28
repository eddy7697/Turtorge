use crate::error::TurtorgeError;
use crate::models::{AppSettings, LayoutNode, Workspace, WorkspaceMoveTerminalRequest};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::Write;
use std::path::PathBuf;

const SCHEMA_VERSION: u32 = 1;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Stored<T> {
    schema_version: u32,
    data: T,
}

pub struct Repository {
    root: PathBuf,
    write_lock: Mutex<()>,
}

impl Repository {
    pub fn new(root: PathBuf) -> Result<Self, TurtorgeError> {
        fs::create_dir_all(&root)
            .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;
        Ok(Self {
            root,
            write_lock: Mutex::new(()),
        })
    }

    #[cfg(test)]
    pub fn root(&self) -> &std::path::Path {
        &self.root
    }

    pub fn list_workspaces(&self) -> Result<Vec<Workspace>, TurtorgeError> {
        let _guard = self.write_lock.lock();
        self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())
    }

    pub fn save_workspace(&self, workspace: Workspace) -> Result<Workspace, TurtorgeError> {
        let _guard = self.write_lock.lock();
        let mut workspaces =
            self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())?;
        if let Some(existing) = workspaces.iter_mut().find(|item| item.id == workspace.id) {
            *existing = workspace.clone();
        } else {
            workspaces.push(workspace.clone());
        }
        self.write_unlocked("workspaces.json", &workspaces)?;
        Ok(workspace)
    }

    pub fn delete_workspace(&self, id: &str) -> Result<(), TurtorgeError> {
        let _guard = self.write_lock.lock();
        let mut workspaces =
            self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())?;
        let before = workspaces.len();
        workspaces.retain(|workspace| workspace.id != id);
        if before == workspaces.len() {
            return Err(TurtorgeError::WorkspaceNotFound(id.to_owned()));
        }
        self.write_unlocked("workspaces.json", &workspaces)
    }

    pub fn open_workspace(&self, id: &str, opened_at: &str) -> Result<Workspace, TurtorgeError> {
        let _guard = self.write_lock.lock();
        let mut workspaces =
            self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())?;
        let mut settings =
            self.read_or_default_unlocked("settings.json", AppSettings::default())?;
        let workspace = workspaces
            .iter_mut()
            .find(|workspace| workspace.id == id)
            .ok_or_else(|| TurtorgeError::WorkspaceNotFound(id.to_owned()))?;
        workspace.last_opened_at = Some(opened_at.to_owned());
        workspace.open_count = workspace.open_count.checked_add(1).ok_or_else(|| {
            TurtorgeError::Validation(format!("Workspace {id} open count overflowed"))
        })?;
        workspace.updated_at = opened_at.to_owned();
        let opened = workspace.clone();
        settings.last_active_workspace_id = Some(id.to_owned());

        self.write_unlocked("workspaces.json", &workspaces)?;
        self.write_unlocked("settings.json", &settings)?;
        Ok(opened)
    }

    pub fn reorder_workspaces(
        &self,
        ordered_ids: Vec<String>,
    ) -> Result<Vec<Workspace>, TurtorgeError> {
        let _guard = self.write_lock.lock();
        let workspaces =
            self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())?;
        let mut by_id = HashMap::with_capacity(workspaces.len());
        for workspace in workspaces {
            let id = workspace.id.clone();
            if id.is_empty() {
                return Err(TurtorgeError::Validation(
                    "Workspace IDs must not be empty".to_owned(),
                ));
            }
            if by_id.insert(id.clone(), workspace).is_some() {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace ID is duplicated in storage: {id}"
                )));
            }
        }
        if ordered_ids.len() != by_id.len() {
            return Err(TurtorgeError::Validation(format!(
                "Workspace order must contain exactly {} IDs",
                by_id.len()
            )));
        }

        let mut seen = HashSet::with_capacity(ordered_ids.len());
        let mut reordered = Vec::with_capacity(ordered_ids.len());
        for id in ordered_ids {
            if !seen.insert(id.clone()) {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace order contains a duplicate ID: {id}"
                )));
            }
            let workspace = by_id.remove(&id).ok_or_else(|| {
                TurtorgeError::Validation(format!("Workspace order contains an unknown ID: {id}"))
            })?;
            reordered.push(workspace);
        }
        if !by_id.is_empty() {
            return Err(TurtorgeError::Validation(
                "Workspace order is missing one or more IDs".to_owned(),
            ));
        }

        self.write_unlocked("workspaces.json", &reordered)?;
        Ok(reordered)
    }

    pub fn move_terminal(
        &self,
        request: &WorkspaceMoveTerminalRequest,
        moved_at: &str,
    ) -> Result<(Workspace, Workspace), TurtorgeError> {
        let _guard = self.write_lock.lock();
        let mut workspaces =
            self.read_or_default_unlocked("workspaces.json", Vec::<Workspace>::new())?;
        validate_workspace_ownership(&workspaces)?;

        if request.source_workspace_id == request.target_workspace_id {
            return Err(TurtorgeError::Validation(
                "Source and target workspaces must be different".to_owned(),
            ));
        }

        let source_index = workspaces
            .iter()
            .position(|workspace| workspace.id == request.source_workspace_id)
            .ok_or_else(|| TurtorgeError::WorkspaceNotFound(request.source_workspace_id.clone()))?;
        let target_index = workspaces
            .iter()
            .position(|workspace| workspace.id == request.target_workspace_id)
            .ok_or_else(|| TurtorgeError::WorkspaceNotFound(request.target_workspace_id.clone()))?;

        let owner = workspaces
            .iter()
            .find(|workspace| {
                workspace
                    .terminals
                    .iter()
                    .any(|terminal| terminal.id == request.terminal_id)
            })
            .ok_or_else(|| TurtorgeError::TerminalNotFound(request.terminal_id.clone()))?;
        if owner.id != request.source_workspace_id {
            return Err(TurtorgeError::Validation(format!(
                "Terminal {} belongs to workspace {}, not {}",
                request.terminal_id, owner.id, request.source_workspace_id
            )));
        }
        if workspaces.iter().enumerate().any(|(index, workspace)| {
            index != source_index
                && terminal_occurrences(&workspace.layout, &request.terminal_id) > 0
        }) {
            return Err(TurtorgeError::Validation(format!(
                "Terminal {} is assigned outside its source workspace",
                request.terminal_id
            )));
        }

        let (source_workspace, target_workspace) =
            two_workspaces_mut(&mut workspaces, source_index, target_index);
        if pane_occurrences(&source_workspace.layout, &request.source_pane_id) != 1 {
            return Err(TurtorgeError::Validation(format!(
                "Source pane must exist exactly once: {}",
                request.source_pane_id
            )));
        }
        if pane_occurrences(&target_workspace.layout, &request.target_pane_id) != 1 {
            return Err(TurtorgeError::Validation(format!(
                "Target pane must exist exactly once: {}",
                request.target_pane_id
            )));
        }
        if terminal_occurrences(&source_workspace.layout, &request.terminal_id) != 1
            || !pane_has_terminal(
                &source_workspace.layout,
                &request.source_pane_id,
                &request.terminal_id,
            )
        {
            return Err(TurtorgeError::Validation(format!(
                "Terminal {} is not owned by source pane {}",
                request.terminal_id, request.source_pane_id
            )));
        }
        let target_length = pane_terminal_count(&target_workspace.layout, &request.target_pane_id)
            .expect("validated target pane must exist");
        if request.target_index > target_length {
            return Err(TurtorgeError::Validation(format!(
                "Target index {} exceeds pane length {target_length}",
                request.target_index
            )));
        }

        let definition_index = source_workspace
            .terminals
            .iter()
            .position(|terminal| terminal.id == request.terminal_id)
            .expect("validated terminal owner must contain the definition");
        let definition = source_workspace.terminals.remove(definition_index);
        let removed = remove_terminal_from_pane(
            &mut source_workspace.layout,
            &request.source_pane_id,
            &request.terminal_id,
        );
        debug_assert!(removed);
        target_workspace.terminals.push(definition);
        let inserted = insert_terminal_into_pane(
            &mut target_workspace.layout,
            &request.target_pane_id,
            &request.terminal_id,
            request.target_index,
        );
        debug_assert!(inserted);

        source_workspace.updated_at = moved_at.to_owned();
        target_workspace.updated_at = moved_at.to_owned();
        target_workspace.last_opened_at = Some(moved_at.to_owned());
        target_workspace.open_count =
            target_workspace.open_count.checked_add(1).ok_or_else(|| {
                TurtorgeError::Validation(format!(
                    "Workspace {} open count overflowed",
                    target_workspace.id
                ))
            })?;
        let source_result = source_workspace.clone();
        let target_result = target_workspace.clone();

        validate_workspace_ownership(&workspaces)?;
        self.write_unlocked("workspaces.json", &workspaces)?;
        Ok((source_result, target_result))
    }

    pub fn settings(&self) -> Result<AppSettings, TurtorgeError> {
        let _guard = self.write_lock.lock();
        self.read_or_default_unlocked("settings.json", AppSettings::default())
    }

    pub fn save_settings(&self, settings: AppSettings) -> Result<AppSettings, TurtorgeError> {
        let _guard = self.write_lock.lock();
        self.write_unlocked("settings.json", &settings)?;
        Ok(settings)
    }

    fn read_or_default_unlocked<T: DeserializeOwned>(
        &self,
        name: &str,
        default: T,
    ) -> Result<T, TurtorgeError> {
        let path = self.root.join(name);
        if !path.exists() {
            return Ok(default);
        }

        let bytes =
            fs::read(&path).map_err(|error| TurtorgeError::StorageReadFailed(error.to_string()))?;
        let stored: Stored<T> = serde_json::from_slice(&bytes)
            .map_err(|error| TurtorgeError::StorageReadFailed(error.to_string()))?;
        if stored.schema_version > SCHEMA_VERSION {
            return Err(TurtorgeError::StorageReadFailed(format!(
                "{} uses unsupported schema version {}",
                path.display(),
                stored.schema_version
            )));
        }
        Ok(stored.data)
    }

    fn write_unlocked<T: Serialize>(&self, name: &str, data: &T) -> Result<(), TurtorgeError> {
        let target = self.root.join(name);
        let temporary = self.root.join(format!("{name}.tmp"));
        let backup = self.root.join(format!("{name}.bak"));
        let payload = serde_json::to_vec_pretty(&Stored {
            schema_version: SCHEMA_VERSION,
            data,
        })
        .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;

        let mut file = File::create(&temporary)
            .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;
        file.write_all(&payload)
            .and_then(|_| file.sync_all())
            .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;

        if backup.exists() {
            fs::remove_file(&backup)
                .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;
        }
        if target.exists() {
            fs::rename(&target, &backup)
                .map_err(|error| TurtorgeError::StorageWriteFailed(error.to_string()))?;
        }
        if let Err(error) = fs::rename(&temporary, &target) {
            if backup.exists() {
                let _ = fs::rename(&backup, &target);
            }
            return Err(TurtorgeError::StorageWriteFailed(error.to_string()));
        }
        Ok(())
    }
}

fn validate_workspace_ownership(workspaces: &[Workspace]) -> Result<(), TurtorgeError> {
    let mut workspace_ids = HashSet::new();
    let mut terminal_owners = HashMap::new();
    for workspace in workspaces {
        if workspace.id.is_empty() {
            return Err(TurtorgeError::Validation(
                "Workspace IDs must not be empty".to_owned(),
            ));
        }
        if !workspace_ids.insert(workspace.id.as_str()) {
            return Err(TurtorgeError::Validation(format!(
                "Workspace ID is duplicated in storage: {}",
                workspace.id
            )));
        }

        let mut definition_ids = HashSet::new();
        for terminal in &workspace.terminals {
            if terminal.id.is_empty() {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace {} contains an empty terminal ID",
                    workspace.id
                )));
            }
            if !definition_ids.insert(terminal.id.as_str()) {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace {} contains duplicate terminal ID {}",
                    workspace.id, terminal.id
                )));
            }
            if let Some(previous_owner) =
                terminal_owners.insert(terminal.id.as_str(), workspace.id.as_str())
            {
                return Err(TurtorgeError::Validation(format!(
                    "Terminal ID {} is owned by both {} and {}",
                    terminal.id, previous_owner, workspace.id
                )));
            }
        }

        let mut layout_node_ids = HashSet::new();
        let mut assigned_terminal_ids = HashSet::new();
        validate_layout_node(
            &workspace.layout,
            &workspace.id,
            &definition_ids,
            &mut layout_node_ids,
            &mut assigned_terminal_ids,
        )?;
    }
    Ok(())
}

fn validate_layout_node<'a>(
    node: &'a LayoutNode,
    workspace_id: &str,
    definition_ids: &HashSet<&'a str>,
    layout_node_ids: &mut HashSet<&'a str>,
    assigned_terminal_ids: &mut HashSet<&'a str>,
) -> Result<(), TurtorgeError> {
    match node {
        LayoutNode::Pane {
            id,
            terminal_ids,
            active_terminal_id,
        } => {
            if id.is_empty() || !layout_node_ids.insert(id.as_str()) {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace {workspace_id} contains an empty or duplicate layout node ID: {id}"
                )));
            }
            for terminal_id in terminal_ids {
                if !definition_ids.contains(terminal_id.as_str()) {
                    return Err(TurtorgeError::Validation(format!(
                        "Workspace {workspace_id} layout references unknown terminal {terminal_id}"
                    )));
                }
                if !assigned_terminal_ids.insert(terminal_id.as_str()) {
                    return Err(TurtorgeError::Validation(format!(
                        "Workspace {workspace_id} assigns terminal {terminal_id} more than once"
                    )));
                }
            }
            if active_terminal_id
                .as_ref()
                .is_some_and(|active| !terminal_ids.contains(active))
            {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace {workspace_id} pane {id} has an invalid active terminal"
                )));
            }
        }
        LayoutNode::Split {
            id, first, second, ..
        } => {
            if id.is_empty() || !layout_node_ids.insert(id.as_str()) {
                return Err(TurtorgeError::Validation(format!(
                    "Workspace {workspace_id} contains an empty or duplicate layout node ID: {id}"
                )));
            }
            validate_layout_node(
                first,
                workspace_id,
                definition_ids,
                layout_node_ids,
                assigned_terminal_ids,
            )?;
            validate_layout_node(
                second,
                workspace_id,
                definition_ids,
                layout_node_ids,
                assigned_terminal_ids,
            )?;
        }
    }
    Ok(())
}

fn two_workspaces_mut(
    workspaces: &mut [Workspace],
    first_index: usize,
    second_index: usize,
) -> (&mut Workspace, &mut Workspace) {
    debug_assert_ne!(first_index, second_index);
    if first_index < second_index {
        let (before_second, from_second) = workspaces.split_at_mut(second_index);
        (&mut before_second[first_index], &mut from_second[0])
    } else {
        let (before_first, from_first) = workspaces.split_at_mut(first_index);
        (&mut from_first[0], &mut before_first[second_index])
    }
}

fn pane_occurrences(node: &LayoutNode, pane_id: &str) -> usize {
    match node {
        LayoutNode::Pane { id, .. } => usize::from(id == pane_id),
        LayoutNode::Split { first, second, .. } => {
            pane_occurrences(first, pane_id) + pane_occurrences(second, pane_id)
        }
    }
}

fn terminal_occurrences(node: &LayoutNode, terminal_id: &str) -> usize {
    match node {
        LayoutNode::Pane { terminal_ids, .. } => {
            terminal_ids.iter().filter(|id| *id == terminal_id).count()
        }
        LayoutNode::Split { first, second, .. } => {
            terminal_occurrences(first, terminal_id) + terminal_occurrences(second, terminal_id)
        }
    }
}

fn pane_has_terminal(node: &LayoutNode, pane_id: &str, terminal_id: &str) -> bool {
    match node {
        LayoutNode::Pane {
            id, terminal_ids, ..
        } => id == pane_id && terminal_ids.iter().any(|id| id == terminal_id),
        LayoutNode::Split { first, second, .. } => {
            pane_has_terminal(first, pane_id, terminal_id)
                || pane_has_terminal(second, pane_id, terminal_id)
        }
    }
}

fn pane_terminal_count(node: &LayoutNode, pane_id: &str) -> Option<usize> {
    match node {
        LayoutNode::Pane {
            id, terminal_ids, ..
        } => (id == pane_id).then_some(terminal_ids.len()),
        LayoutNode::Split { first, second, .. } => {
            pane_terminal_count(first, pane_id).or_else(|| pane_terminal_count(second, pane_id))
        }
    }
}

fn remove_terminal_from_pane(node: &mut LayoutNode, pane_id: &str, terminal_id: &str) -> bool {
    match node {
        LayoutNode::Pane {
            id,
            terminal_ids,
            active_terminal_id,
        } if id == pane_id => {
            let Some(removed_index) = terminal_ids.iter().position(|id| id == terminal_id) else {
                return false;
            };
            terminal_ids.remove(removed_index);
            if active_terminal_id.as_deref() == Some(terminal_id) {
                *active_terminal_id = terminal_ids
                    .get(removed_index)
                    .or_else(|| {
                        removed_index
                            .checked_sub(1)
                            .and_then(|index| terminal_ids.get(index))
                    })
                    .cloned();
            }
            true
        }
        LayoutNode::Pane { .. } => false,
        LayoutNode::Split { first, second, .. } => {
            remove_terminal_from_pane(first, pane_id, terminal_id)
                || remove_terminal_from_pane(second, pane_id, terminal_id)
        }
    }
}

fn insert_terminal_into_pane(
    node: &mut LayoutNode,
    pane_id: &str,
    terminal_id: &str,
    target_index: usize,
) -> bool {
    match node {
        LayoutNode::Pane {
            id,
            terminal_ids,
            active_terminal_id,
        } if id == pane_id => {
            if target_index > terminal_ids.len() || terminal_ids.iter().any(|id| id == terminal_id)
            {
                return false;
            }
            terminal_ids.insert(target_index, terminal_id.to_owned());
            *active_terminal_id = Some(terminal_id.to_owned());
            true
        }
        LayoutNode::Pane { .. } => false,
        LayoutNode::Split { first, second, .. } => {
            insert_terminal_into_pane(first, pane_id, terminal_id, target_index)
                || insert_terminal_into_pane(second, pane_id, terminal_id, target_index)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        EnvironmentVariable, PathKind, ShellKind, ShellProfile, TerminalDefinition,
        TerminalProfileKind, WorkspacePath,
    };
    use std::sync::{Arc, Barrier};
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root(label: &str) -> PathBuf {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("turtorge-{label}-{suffix}"))
    }

    fn test_shell() -> ShellProfile {
        ShellProfile {
            id: "test-shell".to_owned(),
            name: "Test shell".to_owned(),
            kind: ShellKind::Native,
            executable: "/bin/sh".to_owned(),
            version: None,
            distribution: None,
            shell: Some("sh".to_owned()),
            login_shell: true,
            available: true,
        }
    }

    fn test_terminal(id: &str) -> TerminalDefinition {
        TerminalDefinition {
            id: id.to_owned(),
            name: id.to_owned(),
            profile: TerminalProfileKind::Shell,
            shell_profile: test_shell(),
            working_directory: WorkspacePath {
                kind: PathKind::Native,
                value: "/tmp".to_owned(),
                distribution: None,
            },
            startup_command: None,
            environment_variables: Vec::<EnvironmentVariable>::new(),
            auto_start: false,
            launcher_profile_id: None,
        }
    }

    fn test_workspace(
        id: &str,
        pane_id: &str,
        terminal_ids: &[&str],
        active_terminal_id: Option<&str>,
    ) -> Workspace {
        Workspace {
            id: id.to_owned(),
            name: id.to_owned(),
            description: None,
            color: "#72d8c9".to_owned(),
            root_directory: WorkspacePath {
                kind: PathKind::Native,
                value: "/tmp".to_owned(),
                distribution: None,
            },
            default_shell_profile: test_shell(),
            terminals: terminal_ids
                .iter()
                .map(|terminal_id| test_terminal(terminal_id))
                .collect(),
            environment_variables: Vec::new(),
            layout: LayoutNode::Pane {
                id: pane_id.to_owned(),
                terminal_ids: terminal_ids.iter().map(|id| (*id).to_owned()).collect(),
                active_terminal_id: active_terminal_id.map(str::to_owned),
            },
            pinned: true,
            favorite: false,
            created_at: "2026-08-28T00:00:00Z".to_owned(),
            updated_at: "2026-08-28T00:00:00Z".to_owned(),
            last_opened_at: None,
            open_count: 0,
        }
    }

    fn pane_state(workspace: &Workspace) -> (&[String], Option<&str>) {
        match &workspace.layout {
            LayoutNode::Pane {
                terminal_ids,
                active_terminal_id,
                ..
            } => (terminal_ids, active_terminal_id.as_deref()),
            LayoutNode::Split { .. } => panic!("expected a pane layout"),
        }
    }

    #[test]
    fn settings_round_trip_keeps_schema_and_backup() {
        let root = test_root("storage");
        let repository = Repository::new(root.clone()).unwrap();
        let settings = AppSettings {
            sidebar_width: 300,
            ..AppSettings::default()
        };
        repository.save_settings(settings).unwrap();
        let mut updated = repository.settings().unwrap();
        updated.sidebar_width = 320;
        repository.save_settings(updated).unwrap();

        assert_eq!(repository.settings().unwrap().sidebar_width, 320);
        assert!(repository.root().join("settings.json.bak").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_reorder_persists_only_a_complete_unique_permutation() {
        let root = test_root("reorder");
        let repository = Repository::new(root.clone()).unwrap();
        for workspace in [
            test_workspace("workspace-a", "pane-a", &["terminal-a"], Some("terminal-a")),
            test_workspace("workspace-b", "pane-b", &["terminal-b"], Some("terminal-b")),
            test_workspace("workspace-c", "pane-c", &["terminal-c"], Some("terminal-c")),
        ] {
            repository.save_workspace(workspace).unwrap();
        }

        let reordered = repository
            .reorder_workspaces(vec![
                "workspace-c".to_owned(),
                "workspace-a".to_owned(),
                "workspace-b".to_owned(),
            ])
            .unwrap();
        assert_eq!(
            reordered
                .iter()
                .map(|workspace| workspace.id.as_str())
                .collect::<Vec<_>>(),
            ["workspace-c", "workspace-a", "workspace-b"]
        );
        assert_eq!(
            repository
                .list_workspaces()
                .unwrap()
                .iter()
                .map(|workspace| workspace.id.as_str())
                .collect::<Vec<_>>(),
            ["workspace-c", "workspace-a", "workspace-b"]
        );

        for invalid in [
            vec!["workspace-c".to_owned(), "workspace-a".to_owned()],
            vec![
                "workspace-c".to_owned(),
                "workspace-c".to_owned(),
                "workspace-b".to_owned(),
            ],
            vec![
                "workspace-c".to_owned(),
                "workspace-a".to_owned(),
                "workspace-unknown".to_owned(),
            ],
        ] {
            assert!(matches!(
                repository.reorder_workspaces(invalid),
                Err(TurtorgeError::Validation(_))
            ));
            assert_eq!(
                repository
                    .list_workspaces()
                    .unwrap()
                    .iter()
                    .map(|workspace| workspace.id.as_str())
                    .collect::<Vec<_>>(),
                ["workspace-c", "workspace-a", "workspace-b"]
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_move_terminal_updates_both_layouts_and_target_recency_in_one_file() {
        let root = test_root("move-terminal");
        let repository = Repository::new(root.clone()).unwrap();
        let source = test_workspace(
            "workspace-source",
            "pane-source",
            &["terminal-a", "terminal-b", "terminal-c"],
            Some("terminal-b"),
        );
        let mut target = test_workspace(
            "workspace-target",
            "pane-target",
            &["terminal-d", "terminal-e"],
            Some("terminal-d"),
        );
        target.open_count = 4;
        repository.save_workspace(source).unwrap();
        repository.save_workspace(target).unwrap();
        let settings = AppSettings {
            last_active_workspace_id: Some("workspace-source".to_owned()),
            ..AppSettings::default()
        };
        repository.save_settings(settings).unwrap();

        let moved_at = "2026-08-28T12:34:56Z";
        let (source, target) = repository
            .move_terminal(
                &WorkspaceMoveTerminalRequest {
                    source_workspace_id: "workspace-source".to_owned(),
                    source_pane_id: "pane-source".to_owned(),
                    target_workspace_id: "workspace-target".to_owned(),
                    target_pane_id: "pane-target".to_owned(),
                    terminal_id: "terminal-b".to_owned(),
                    target_index: 1,
                },
                moved_at,
            )
            .unwrap();

        assert_eq!(
            source
                .terminals
                .iter()
                .map(|terminal| terminal.id.as_str())
                .collect::<Vec<_>>(),
            ["terminal-a", "terminal-c"]
        );
        assert_eq!(
            pane_state(&source),
            (
                &["terminal-a".to_owned(), "terminal-c".to_owned()][..],
                Some("terminal-c")
            )
        );
        assert_eq!(
            target
                .terminals
                .iter()
                .map(|terminal| terminal.id.as_str())
                .collect::<Vec<_>>(),
            ["terminal-d", "terminal-e", "terminal-b"]
        );
        assert_eq!(
            pane_state(&target),
            (
                &[
                    "terminal-d".to_owned(),
                    "terminal-b".to_owned(),
                    "terminal-e".to_owned()
                ][..],
                Some("terminal-b")
            )
        );
        assert_eq!(source.updated_at, moved_at);
        assert_eq!(target.updated_at, moved_at);
        assert_eq!(target.last_opened_at.as_deref(), Some(moved_at));
        assert_eq!(target.open_count, 5);
        assert_eq!(
            repository
                .settings()
                .unwrap()
                .last_active_workspace_id
                .as_deref(),
            Some("workspace-source")
        );

        let stored = repository.list_workspaces().unwrap();
        assert_eq!(
            stored
                .iter()
                .map(|workspace| workspace.id.as_str())
                .collect::<Vec<_>>(),
            ["workspace-source", "workspace-target"]
        );
        assert_eq!(pane_state(&stored[0]).1, Some("terminal-c"));
        assert_eq!(pane_state(&stored[1]).1, Some("terminal-b"));
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn removing_an_active_terminal_prefers_right_then_left_and_allows_empty_panes() {
        let mut middle = LayoutNode::Pane {
            id: "pane".to_owned(),
            terminal_ids: vec!["a".to_owned(), "b".to_owned(), "c".to_owned()],
            active_terminal_id: Some("b".to_owned()),
        };
        assert!(remove_terminal_from_pane(&mut middle, "pane", "b"));
        match middle {
            LayoutNode::Pane {
                terminal_ids,
                active_terminal_id,
                ..
            } => {
                assert_eq!(terminal_ids, ["a", "c"]);
                assert_eq!(active_terminal_id.as_deref(), Some("c"));
            }
            LayoutNode::Split { .. } => unreachable!(),
        }

        let mut last = LayoutNode::Pane {
            id: "pane".to_owned(),
            terminal_ids: vec!["a".to_owned(), "b".to_owned()],
            active_terminal_id: Some("b".to_owned()),
        };
        assert!(remove_terminal_from_pane(&mut last, "pane", "b"));
        match last {
            LayoutNode::Pane {
                terminal_ids,
                active_terminal_id,
                ..
            } => {
                assert_eq!(terminal_ids, ["a"]);
                assert_eq!(active_terminal_id.as_deref(), Some("a"));
            }
            LayoutNode::Split { .. } => unreachable!(),
        }

        let mut only = LayoutNode::Pane {
            id: "pane".to_owned(),
            terminal_ids: vec!["a".to_owned()],
            active_terminal_id: Some("a".to_owned()),
        };
        assert!(remove_terminal_from_pane(&mut only, "pane", "a"));
        match only {
            LayoutNode::Pane {
                terminal_ids,
                active_terminal_id,
                ..
            } => {
                assert!(terminal_ids.is_empty());
                assert!(active_terminal_id.is_none());
            }
            LayoutNode::Split { .. } => unreachable!(),
        }
    }

    #[test]
    fn workspace_move_terminal_rejects_duplicate_global_ownership_without_writing() {
        let root = test_root("duplicate-terminal-owner");
        let repository = Repository::new(root.clone()).unwrap();
        let source = test_workspace(
            "workspace-source",
            "pane-source",
            &["terminal-shared"],
            Some("terminal-shared"),
        );
        let target = test_workspace(
            "workspace-target",
            "pane-target",
            &["terminal-shared"],
            Some("terminal-shared"),
        );
        repository.save_workspace(source).unwrap();
        repository.save_workspace(target).unwrap();
        let before = serde_json::to_value(repository.list_workspaces().unwrap()).unwrap();

        let result = repository.move_terminal(
            &WorkspaceMoveTerminalRequest {
                source_workspace_id: "workspace-source".to_owned(),
                source_pane_id: "pane-source".to_owned(),
                target_workspace_id: "workspace-target".to_owned(),
                target_pane_id: "pane-target".to_owned(),
                terminal_id: "terminal-shared".to_owned(),
                target_index: 0,
            },
            "2026-08-28T12:34:56Z",
        );

        assert!(matches!(result, Err(TurtorgeError::Validation(_))));
        assert_eq!(
            serde_json::to_value(repository.list_workspaces().unwrap()).unwrap(),
            before
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_move_terminal_rejects_invalid_panes_and_indices_without_writing() {
        let root = test_root("invalid-terminal-move");
        let repository = Repository::new(root.clone()).unwrap();
        repository
            .save_workspace(test_workspace(
                "workspace-source",
                "pane-source",
                &["terminal-source"],
                Some("terminal-source"),
            ))
            .unwrap();
        repository
            .save_workspace(test_workspace(
                "workspace-target",
                "pane-target",
                &["terminal-target"],
                Some("terminal-target"),
            ))
            .unwrap();
        let before = serde_json::to_value(repository.list_workspaces().unwrap()).unwrap();

        for request in [
            WorkspaceMoveTerminalRequest {
                source_workspace_id: "workspace-source".to_owned(),
                source_pane_id: "missing-pane".to_owned(),
                target_workspace_id: "workspace-target".to_owned(),
                target_pane_id: "pane-target".to_owned(),
                terminal_id: "terminal-source".to_owned(),
                target_index: 0,
            },
            WorkspaceMoveTerminalRequest {
                source_workspace_id: "workspace-source".to_owned(),
                source_pane_id: "pane-source".to_owned(),
                target_workspace_id: "workspace-target".to_owned(),
                target_pane_id: "missing-pane".to_owned(),
                terminal_id: "terminal-source".to_owned(),
                target_index: 0,
            },
            WorkspaceMoveTerminalRequest {
                source_workspace_id: "workspace-source".to_owned(),
                source_pane_id: "pane-source".to_owned(),
                target_workspace_id: "workspace-target".to_owned(),
                target_pane_id: "pane-target".to_owned(),
                terminal_id: "terminal-source".to_owned(),
                target_index: 2,
            },
        ] {
            assert!(matches!(
                repository.move_terminal(&request, "2026-08-28T12:34:56Z"),
                Err(TurtorgeError::Validation(_))
            ));
            assert_eq!(
                serde_json::to_value(repository.list_workspaces().unwrap()).unwrap(),
                before
            );
        }

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn workspace_move_terminal_write_failure_keeps_persisted_ownership_unchanged() {
        let root = test_root("failed-terminal-move-write");
        let repository = Repository::new(root.clone()).unwrap();
        repository
            .save_workspace(test_workspace(
                "workspace-source",
                "pane-source",
                &["terminal-source"],
                Some("terminal-source"),
            ))
            .unwrap();
        repository
            .save_workspace(test_workspace(
                "workspace-target",
                "pane-target",
                &["terminal-target"],
                Some("terminal-target"),
            ))
            .unwrap();
        let before = serde_json::to_value(repository.list_workspaces().unwrap()).unwrap();
        fs::create_dir(repository.root().join("workspaces.json.tmp")).unwrap();

        let result = repository.move_terminal(
            &WorkspaceMoveTerminalRequest {
                source_workspace_id: "workspace-source".to_owned(),
                source_pane_id: "pane-source".to_owned(),
                target_workspace_id: "workspace-target".to_owned(),
                target_pane_id: "pane-target".to_owned(),
                terminal_id: "terminal-source".to_owned(),
                target_index: 1,
            },
            "2026-08-28T12:34:56Z",
        );

        assert!(matches!(result, Err(TurtorgeError::StorageWriteFailed(_))));
        assert_eq!(
            serde_json::to_value(repository.list_workspaces().unwrap()).unwrap(),
            before
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn concurrent_workspace_saves_preserve_every_distinct_workspace() {
        let root = test_root("concurrent-save");
        let repository = Arc::new(Repository::new(root.clone()).unwrap());
        let barrier = Arc::new(Barrier::new(8));
        let handles = (0..8)
            .map(|index| {
                let repository = repository.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    let workspace_id = format!("workspace-{index}");
                    let pane_id = format!("pane-{index}");
                    let terminal_id = format!("terminal-{index}");
                    let workspace = test_workspace(
                        &workspace_id,
                        &pane_id,
                        &[&terminal_id],
                        Some(&terminal_id),
                    );
                    barrier.wait();
                    repository.save_workspace(workspace).unwrap();
                })
            })
            .collect::<Vec<_>>();
        for handle in handles {
            handle.join().unwrap();
        }

        let mut ids = repository
            .list_workspaces()
            .unwrap()
            .into_iter()
            .map(|workspace| workspace.id)
            .collect::<Vec<_>>();
        ids.sort();
        assert_eq!(ids.len(), 8);
        assert_eq!(ids.first().map(String::as_str), Some("workspace-0"));
        assert_eq!(ids.last().map(String::as_str), Some("workspace-7"));
        drop(repository);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn concurrent_delete_and_save_do_not_restore_or_drop_unrelated_workspaces() {
        let root = test_root("concurrent-delete-save");
        let repository = Arc::new(Repository::new(root.clone()).unwrap());
        repository
            .save_workspace(test_workspace(
                "workspace-delete",
                "pane-delete",
                &["terminal-delete"],
                Some("terminal-delete"),
            ))
            .unwrap();
        repository
            .save_workspace(test_workspace(
                "workspace-keep",
                "pane-keep",
                &["terminal-keep"],
                Some("terminal-keep"),
            ))
            .unwrap();
        let barrier = Arc::new(Barrier::new(2));

        let delete_handle = {
            let repository = repository.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                repository.delete_workspace("workspace-delete").unwrap();
            })
        };
        let save_handle = {
            let repository = repository.clone();
            let barrier = barrier.clone();
            std::thread::spawn(move || {
                barrier.wait();
                repository
                    .save_workspace(test_workspace(
                        "workspace-add",
                        "pane-add",
                        &["terminal-add"],
                        Some("terminal-add"),
                    ))
                    .unwrap();
            })
        };
        delete_handle.join().unwrap();
        save_handle.join().unwrap();

        let mut ids = repository
            .list_workspaces()
            .unwrap()
            .into_iter()
            .map(|workspace| workspace.id)
            .collect::<Vec<_>>();
        ids.sort();
        assert_eq!(ids, ["workspace-add", "workspace-keep"]);
        drop(repository);
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn concurrent_workspace_opens_preserve_every_increment() {
        let root = test_root("concurrent-open");
        let repository = Arc::new(Repository::new(root.clone()).unwrap());
        repository
            .save_workspace(test_workspace(
                "workspace-open",
                "pane-open",
                &["terminal-open"],
                Some("terminal-open"),
            ))
            .unwrap();
        let barrier = Arc::new(Barrier::new(8));
        let handles = (0..8)
            .map(|index| {
                let repository = repository.clone();
                let barrier = barrier.clone();
                std::thread::spawn(move || {
                    barrier.wait();
                    repository
                        .open_workspace("workspace-open", &format!("2026-08-28T12:34:{index:02}Z"))
                        .unwrap();
                })
            })
            .collect::<Vec<_>>();
        for handle in handles {
            handle.join().unwrap();
        }

        let workspace = repository.list_workspaces().unwrap().remove(0);
        assert_eq!(workspace.open_count, 8);
        assert_eq!(
            repository
                .settings()
                .unwrap()
                .last_active_workspace_id
                .as_deref(),
            Some("workspace-open")
        );
        drop(repository);
        fs::remove_dir_all(root).unwrap();
    }
}
