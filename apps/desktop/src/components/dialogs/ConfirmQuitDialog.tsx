import { AlertTriangle } from "lucide-react";
import { Modal } from "../ui/Modal";

export function ConfirmQuitDialog({ workspaceCount, terminalCount, onCancel, onConfirm }: { workspaceCount: number; terminalCount: number; onCancel: () => void; onConfirm: () => void }) {
  return <Modal title="Quit Turtorge?" description="Running processes are managed by Turtorge and cannot remain orphaned." onClose={onCancel} width="small" footer={<><button className="secondary-button" onClick={onCancel}>Cancel</button><button className="danger-button" onClick={onConfirm}>Quit and terminate all</button></>}><div className="warning-summary"><AlertTriangle size={20} /><p><strong>{terminalCount} running {terminalCount === 1 ? "terminal" : "terminals"}</strong> across {workspaceCount} {workspaceCount === 1 ? "workspace" : "workspaces"} will be terminated.</p></div></Modal>;
}
