import { findPane, firstPaneId } from "./layout";
import type { TerminalRuntimeSnapshot, Workspace } from "../types";

export const TERMINAL_TAB_DRAG_MIME = "application/x-turtorge-terminal-tab";

export interface TerminalTabDrag {
  sourceWorkspaceId: string;
  sourcePaneId: string;
  terminalId: string;
}

export interface TerminalTabDropTarget {
  workspaceId: string;
  paneId: string;
  index: number;
}

export function writeTerminalTabDrag(
  dataTransfer: DataTransfer,
  drag: TerminalTabDrag,
): void {
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(TERMINAL_TAB_DRAG_MIME, JSON.stringify(drag));
  dataTransfer.setData("text/plain", drag.terminalId);
}

export function readTerminalTabDrag(dataTransfer: DataTransfer): TerminalTabDrag | null {
  const raw = dataTransfer.getData(TERMINAL_TAB_DRAG_MIME);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<TerminalTabDrag>;
    if (
      typeof value.sourceWorkspaceId !== "string"
      || typeof value.sourcePaneId !== "string"
      || typeof value.terminalId !== "string"
    ) return null;
    return {
      sourceWorkspaceId: value.sourceWorkspaceId,
      sourcePaneId: value.sourcePaneId,
      terminalId: value.terminalId,
    };
  } catch {
    return null;
  }
}

export function terminalMoveIsTransitioning(
  runtime: TerminalRuntimeSnapshot | undefined,
  pendingConnections: number,
  pendingStart = false,
): boolean {
  return runtime?.status === "starting"
    || runtime?.status === "stopping"
    || pendingConnections > 0
    || pendingStart;
}

export function workspaceEndDropTarget(
  workspaces: Workspace[],
  drag: TerminalTabDrag,
  workspaceId: string,
): TerminalTabDropTarget | null {
  const workspace = workspaces.find((item) => item.id === workspaceId);
  if (!workspace) return null;
  const paneId = firstPaneId(workspace.layout);
  const pane = findPane(workspace.layout, paneId);
  if (!pane) return null;
  return {
    workspaceId,
    paneId,
    index: pane.terminalIds.filter((terminalId) => terminalId !== drag.terminalId).length,
  };
}
