import { useMemo } from "react";
import { useAppStore } from "../../stores/appStore";
import type { LayoutNode, TerminalDefinition, Workspace } from "../../types";
import { terminalMountKey } from "./PersistentTerminalSlot";
import { XtermView } from "./XtermView";

export interface TerminalFocusRequest {
  terminalId: string;
  sequence: number;
}

interface PersistentTerminalDeckProps {
  workspaces: Workspace[];
  visibleWorkspaceId: string | null;
  terminalFocusRequest: TerminalFocusRequest | null;
}

interface TerminalOwner {
  workspace: Workspace;
  definition: TerminalDefinition;
  paneId: string;
  active: boolean;
}

export function PersistentTerminalDeck({
  workspaces,
  visibleWorkspaceId,
  terminalFocusRequest,
}: PersistentTerminalDeckProps) {
  const runtimes = useAppStore((state) => state.runtimes);
  const startRequests = useAppStore((state) => state.startRequests);
  const owners = useMemo(() => assignedTerminalOwners(workspaces), [workspaces]);

  return (
    <>
      {owners.map(({ workspace, definition, paneId, active }) => {
        const visible = workspace.id === visibleWorkspaceId && active;
        return (
          <XtermView
            key={definition.id}
            workspace={workspace}
            definition={definition}
            activate={Boolean(runtimes[definition.id]) || Boolean(startRequests[definition.id])}
            connectionGeneration={startRequests[definition.id] ?? 0}
            visible={visible}
            focusRequest={visible && terminalFocusRequest?.terminalId === definition.id
              ? terminalFocusRequest.sequence
              : undefined}
            mountKey={terminalMountKey(workspace.id, paneId, definition.id)}
          />
        );
      })}
    </>
  );
}

function assignedTerminalOwners(workspaces: Workspace[]): TerminalOwner[] {
  const owners: TerminalOwner[] = [];
  const assigned = new Set<string>();

  for (const workspace of workspaces) {
    const definitions = new Map(
      workspace.terminals.map((definition) => [definition.id, definition]),
    );
    visitLayout(workspace.layout, (paneId, terminalIds, activeTerminalId) => {
      const paneDefinitions = terminalIds
        .map((terminalId) => definitions.get(terminalId))
        .filter((definition): definition is TerminalDefinition => Boolean(definition));
      const activeId = paneDefinitions.some(({ id }) => id === activeTerminalId)
        ? activeTerminalId
        : paneDefinitions[0]?.id;

      for (const definition of paneDefinitions) {
        if (assigned.has(definition.id)) continue;
        assigned.add(definition.id);
        owners.push({
          workspace,
          definition,
          paneId,
          active: definition.id === activeId,
        });
      }
    });
  }

  return owners;
}

function visitLayout(
  node: LayoutNode,
  visitPane: (
    paneId: string,
    terminalIds: string[],
    activeTerminalId: string | null | undefined,
  ) => void,
) {
  if (node.type === "pane") {
    visitPane(node.id, node.terminalIds, node.activeTerminalId);
    return;
  }
  visitLayout(node.first, visitPane);
  visitLayout(node.second, visitPane);
}
