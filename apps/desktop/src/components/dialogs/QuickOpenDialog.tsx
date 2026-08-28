import { Folder, Pin, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Workspace } from "../../types";
import { Modal } from "../ui/Modal";

export function QuickOpenDialog({ workspaces, onSelect, onClose }: { workspaces: Workspace[]; onSelect: (id: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => {
    const manualOrder = new Map(workspaces.map((workspace, index) => [workspace.id, index]));
    return workspaces
      .filter((workspace) => `${workspace.name} ${workspace.rootDirectory.value}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
        if (a.pinned) return (manualOrder.get(a.id) ?? 0) - (manualOrder.get(b.id) ?? 0);
        return (b.lastOpenedAt ?? "").localeCompare(a.lastOpenedAt ?? "");
      });
  }, [query, workspaces]);
  return <Modal title="Quick Open" onClose={onClose} width="medium"><div className="quick-open-search"><Search size={15} /><input autoFocus value={query} placeholder="Search workspaces…" onChange={(event) => setQuery(event.target.value)} /></div><div className="quick-open-results">{results.map((workspace) => <button key={workspace.id} onClick={() => { onSelect(workspace.id); onClose(); }}><Folder size={16} /><span><strong>{workspace.name}</strong><small>{workspace.rootDirectory.value}</small></span>{workspace.pinned && <Pin size={12} />}</button>)}{results.length === 0 && <p>No matching workspace.</p>}</div></Modal>;
}
