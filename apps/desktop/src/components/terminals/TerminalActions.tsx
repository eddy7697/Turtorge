import { ExternalLink, FolderOpen, Pencil, Play, RotateCw, Settings2, Trash2, Type } from "lucide-react";
import { useState, type FormEvent } from "react";
import { closeTerminal, openLauncher } from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { TerminalDefinition, Workspace } from "../../types";
import { EditTerminalDialog } from "../dialogs/EditTerminalDialog";
import { LauncherSetupDialog } from "../dialogs/LauncherSetupDialog";
import { ContextMenu, type ContextMenuPoint } from "../ui/ContextMenu";
import { LauncherLogo } from "../ui/LauncherLogo";
import { Modal } from "../ui/Modal";

export interface TerminalActionTarget {
  workspace: Workspace;
  definition: TerminalDefinition;
}

export type TerminalActionRequest =
  | { kind: "menu"; target: TerminalActionTarget; point: ContextMenuPoint }
  | { kind: "rename" | "edit" | "forceRestart" | "delete" | "launcherSetup"; target: TerminalActionTarget };

export function TerminalActions({
  request,
  onRequestChange,
  onRename,
  onEdit,
  onRemove,
  onOpenLauncherSettings,
}: {
  request: TerminalActionRequest | null;
  onRequestChange: (request: TerminalActionRequest | null) => void;
  onRename: (workspace: Workspace, terminalId: string, name: string) => Promise<void>;
  onEdit: (workspace: Workspace, definition: TerminalDefinition) => Promise<void>;
  onRemove: (workspace: Workspace, terminalId: string) => Promise<void>;
  onOpenLauncherSettings: () => void;
}) {
  const runtimes = useAppStore((state) => state.runtimes);
  const pendingConnections = useAppStore((state) => state.pendingConnections);
  const settings = useAppStore((state) => state.settings);
  const launcherProfiles = useAppStore((state) => state.launcherProfiles);
  const platform = useAppStore((state) => state.platform);
  const windowsShells = useAppStore((state) => state.windowsShells);
  const nativeShells = useAppStore((state) => state.nativeShells);
  const wslDistributions = useAppStore((state) => state.wslDistributions);
  const updateSettings = useAppStore((state) => state.updateSettings);
  const requestStart = useAppStore((state) => state.requestTerminalStart);
  const removeRuntime = useAppStore((state) => state.removeRuntime);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [launcherPending, setLauncherPending] = useState(false);
  const [launcherError, setLauncherError] = useState("");

  const target = request?.target;
  const runtime = target ? runtimes[target.definition.id] : undefined;
  const isLive = Boolean(target && (
    (pendingConnections[target.definition.id] ?? 0) > 0
    || runtime?.status === "starting"
    || runtime?.status === "running"
    || runtime?.status === "stopping"
  ));
  const launcherId = target?.definition.launcherProfileId ?? settings.defaultLauncherProfileId ?? null;
  const launcher = launcherProfiles.find(({ profile }) => profile.id === launcherId);

  const changeRequest = (next: TerminalActionRequest | null) => {
    setError("");
    if (next?.kind === "rename") setName(next.target.definition.name);
    onRequestChange(next);
  };

  const restart = async (actionTarget: TerminalActionTarget) => {
    const current = useAppStore.getState().runtimes[actionTarget.definition.id];
    if (current && ["starting", "running", "stopping"].includes(current.status)) await closeTerminal(current.id);
    removeRuntime(actionTarget.definition.id);
    requestStart(actionTarget.definition.id);
  };

  const launch = async (actionTarget: TerminalActionTarget, profileId: string) => {
    if (launcherPending) return;
    setLauncherPending(true);
    setLauncherError("");
    try {
      await openLauncher({ profileId, path: actionTarget.definition.workingDirectory });
      onRequestChange(null);
    } catch (reason) {
      onRequestChange(null);
      setLauncherError(messageFromReason(reason));
    } finally {
      setLauncherPending(false);
    }
  };

  const requestLauncher = (actionTarget: TerminalActionTarget) => {
    const profileId = actionTarget.definition.launcherProfileId ?? settings.defaultLauncherProfileId ?? null;
    if (!profileId) {
      changeRequest({ kind: "launcherSetup", target: actionTarget });
      return;
    }
    void launch(actionTarget, profileId);
  };

  const finishRename = async (event: FormEvent) => {
    event.preventDefault();
    if (!target) return;
    const normalized = name.trim();
    if (!normalized) {
      setError("Enter a terminal name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onRename(target.workspace, target.definition.id, normalized);
      onRequestChange(null);
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  const finishRestart = async () => {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      await restart(target);
      onRequestChange(null);
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  const finishDelete = async () => {
    if (!target) return;
    setSaving(true);
    setError("");
    try {
      const current = useAppStore.getState().runtimes[target.definition.id];
      if (current && ["starting", "running", "stopping"].includes(current.status)) await closeTerminal(current.id);
      removeRuntime(target.definition.id);
      await onRemove(target.workspace, target.definition.id);
      onRequestChange(null);
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {request?.kind === "menu" && (
        <ContextMenu
          point={request.point}
          label={`${request.target.definition.name} actions`}
          onClose={() => onRequestChange(null)}
          entries={[
            {
              type: "item",
              key: "launcher",
              label: launcher ? `Open in ${launcher.profile.name}` : "Choose App to Open…",
              icon: launcher
                ? <LauncherLogo icon={launcher.profile.icon} accent={launcher.profile.accent} size={14} />
                : <FolderOpen size={14} />,
              onSelect: () => requestLauncher(request.target),
            },
            isLive
              ? {
                  type: "item",
                  key: "force-restart",
                  label: "Force Restart",
                  icon: <RotateCw size={14} />,
                  onSelect: () => changeRequest({ kind: "forceRestart", target: request.target }),
                }
              : {
                  type: "item",
                  key: "start",
                  label: "Start Terminal",
                  icon: <Play size={14} />,
                  onSelect: () => {
                    requestStart(request.target.definition.id);
                    onRequestChange(null);
                  },
                },
            { type: "separator", key: "primary-separator" },
            {
              type: "item",
              key: "rename",
              label: "Rename",
              icon: <Type size={14} />,
              onSelect: () => changeRequest({ kind: "rename", target: request.target }),
            },
            {
              type: "item",
              key: "edit",
              label: "Edit Terminal",
              icon: <Pencil size={14} />,
              onSelect: () => changeRequest({ kind: "edit", target: request.target }),
            },
            { type: "separator", key: "danger-separator" },
            {
              type: "item",
              key: "delete",
              label: "Delete Terminal",
              icon: <Trash2 size={14} />,
              hint: "Shift+F10",
              danger: true,
              onSelect: () => changeRequest({ kind: "delete", target: request.target }),
            },
          ]}
        />
      )}

      {request?.kind === "rename" && target && (
        <Modal
          title="Rename Terminal"
          description="The new label is saved with this workspace."
          onClose={() => !saving && onRequestChange(null)}
          width="small"
          footer={<><button className="secondary-button" onClick={() => onRequestChange(null)} disabled={saving}>Cancel</button><button className="primary-button" type="submit" form="context-rename-terminal-form" disabled={saving}>Rename</button></>}
        >
          <form id="context-rename-terminal-form" onSubmit={finishRename}>
            <label className="field"><span>Terminal name</span><input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
            {error && <div className="form-error rename-error">{error}</div>}
          </form>
        </Modal>
      )}

      {request?.kind === "edit" && target && (
        <EditTerminalDialog
          platform={platform}
          definition={target.definition}
          workspace={target.workspace}
          windowsShells={windowsShells}
          nativeShells={nativeShells}
          wslDistributions={wslDistributions}
          launcherProfiles={launcherProfiles}
          globalDefaultLauncherId={settings.defaultLauncherProfileId}
          running={isLive}
          onSave={(definition) => onEdit(target.workspace, definition)}
          onRestart={() => restart(target)}
          onClose={() => onRequestChange(null)}
        />
      )}

      {request?.kind === "forceRestart" && target && (
        <Modal
          title={`Force restart “${target.definition.name}”?`}
          description="The current process will be terminated and replaced with a fresh terminal session."
          onClose={() => !saving && onRequestChange(null)}
          width="small"
          footer={<><button className="secondary-button" onClick={() => onRequestChange(null)} disabled={saving}>Cancel</button><button className="danger-button" onClick={() => void finishRestart()} disabled={saving}>Force Restart</button></>}
        >
          <div className="terminal-restart-summary"><RotateCw size={17} /><span><strong>Unsaved process state will be lost.</strong><small>This keeps the saved terminal definition and starts it again with the same configuration.</small></span></div>
          {error && <div className="form-error terminal-edit-error">{error}</div>}
        </Modal>
      )}

      {request?.kind === "delete" && target && (
        <Modal
          title={`Delete “${target.definition.name}”?`}
          description="This permanently removes the saved terminal definition."
          onClose={() => !saving && onRequestChange(null)}
          width="small"
          footer={<><button className="secondary-button" onClick={() => onRequestChange(null)} disabled={saving}>Cancel</button><button className="danger-button" onClick={() => void finishDelete()} disabled={saving}>Delete Terminal</button></>}
        >
          <div className="pane-delete-summary"><Trash2 size={16} /><span><strong>Shell, directory, command, and environment settings will be deleted.</strong><small>{isLive ? "The running process will also be terminated." : "This terminal is not currently running."}</small></span></div>
          {error && <div className="form-error terminal-edit-error">{error}</div>}
        </Modal>
      )}

      {request?.kind === "launcherSetup" && target && (
        <LauncherSetupDialog
          launcherProfiles={launcherProfiles}
          path={target.definition.workingDirectory.value}
          onClose={() => onRequestChange(null)}
          onManage={() => {
            onRequestChange(null);
            onOpenLauncherSettings();
          }}
          onSaveAndOpen={async (profileId) => {
            await updateSettings({ ...settings, defaultLauncherProfileId: profileId });
            await launch(target, profileId);
          }}
        />
      )}

      {launcherError && (
        <Modal
          title="Unable to open working directory"
          description={launcherError}
          onClose={() => setLauncherError("")}
          width="small"
          footer={<><button className="secondary-button" onClick={() => setLauncherError("")}>Close</button><button className="primary-button" onClick={() => { setLauncherError(""); onOpenLauncherSettings(); }}><Settings2 size={13} /> Launcher Settings</button></>}
        >
          <div className="form-status"><ExternalLink size={15} /><span><strong>The configured launcher could not be started.</strong><small>Review its executable and argument settings, then try again.</small></span></div>
        </Modal>
      )}
    </>
  );
}

function messageFromReason(reason: unknown): string {
  if (typeof reason === "object" && reason && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }
  return String(reason);
}
