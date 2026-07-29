use crate::error::TurtorgeError;
use crate::models::{AppSettings, Workspace};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize, de::DeserializeOwned};
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
        self.read_or_default("workspaces.json", Vec::new())
    }

    pub fn save_workspace(&self, workspace: Workspace) -> Result<Workspace, TurtorgeError> {
        let mut workspaces = self.list_workspaces()?;
        if let Some(existing) = workspaces.iter_mut().find(|item| item.id == workspace.id) {
            *existing = workspace.clone();
        } else {
            workspaces.push(workspace.clone());
        }
        self.write("workspaces.json", &workspaces)?;
        Ok(workspace)
    }

    pub fn delete_workspace(&self, id: &str) -> Result<(), TurtorgeError> {
        let mut workspaces = self.list_workspaces()?;
        let before = workspaces.len();
        workspaces.retain(|workspace| workspace.id != id);
        if before == workspaces.len() {
            return Err(TurtorgeError::WorkspaceNotFound(id.to_owned()));
        }
        self.write("workspaces.json", &workspaces)
    }

    pub fn settings(&self) -> Result<AppSettings, TurtorgeError> {
        self.read_or_default("settings.json", AppSettings::default())
    }

    pub fn save_settings(&self, settings: AppSettings) -> Result<AppSettings, TurtorgeError> {
        self.write("settings.json", &settings)?;
        Ok(settings)
    }

    fn read_or_default<T: DeserializeOwned>(
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

    fn write<T: Serialize>(&self, name: &str, data: &T) -> Result<(), TurtorgeError> {
        let _guard = self.write_lock.lock();
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn settings_round_trip_keeps_schema_and_backup() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("turtorge-storage-{suffix}"));
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
}
