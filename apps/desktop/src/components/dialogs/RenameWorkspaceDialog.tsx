import { useState, type FormEvent } from "react";
import type { Workspace } from "../../types";
import { Modal } from "../ui/Modal";

export function RenameWorkspaceDialog({
  workspace,
  onSave,
  onClose,
}: {
  workspace: Workspace;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(workspace.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = name.trim();
    if (!normalized) {
      setError("Enter a workspace name.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(normalized);
      onClose();
    } catch (reason) {
      setError(messageFromReason(reason));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Rename Workspace"
      description="Only the workspace label changes. Its path, terminals, and layout stay the same."
      onClose={() => !saving && onClose()}
      width="small"
      footer={<><button className="secondary-button" onClick={onClose} disabled={saving}>Cancel</button><button className="primary-button" type="submit" form="rename-workspace-form" disabled={saving}>Rename</button></>}
    >
      <form id="rename-workspace-form" onSubmit={submit}>
        <label className="field"><span>Workspace name</span><input autoFocus maxLength={80} value={name} onChange={(event) => setName(event.target.value)} /></label>
        {error && <div className="form-error rename-error">{error}</div>}
      </form>
    </Modal>
  );
}

function messageFromReason(reason: unknown): string {
  if (typeof reason === "object" && reason && "message" in reason) {
    return String((reason as { message?: unknown }).message ?? reason);
  }
  return String(reason);
}
