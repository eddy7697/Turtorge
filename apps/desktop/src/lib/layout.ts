import type { LayoutNode, PaneNode, SplitDirection } from "../types";
import { createId } from "./ids";

export function createPane(terminalIds: string[] = []): PaneNode {
  return {
    type: "pane",
    id: createId("pane"),
    terminalIds,
    activeTerminalId: terminalIds[0] ?? null,
  };
}

export function findPane(node: LayoutNode, paneId: string): PaneNode | undefined {
  if (node.type === "pane") {
    return node.id === paneId ? node : undefined;
  }
  return findPane(node.first, paneId) ?? findPane(node.second, paneId);
}

export function mapPane(
  node: LayoutNode,
  paneId: string,
  mapper: (pane: PaneNode) => LayoutNode,
): LayoutNode {
  if (node.type === "pane") {
    return node.id === paneId ? mapper(node) : node;
  }
  return {
    ...node,
    first: mapPane(node.first, paneId, mapper),
    second: mapPane(node.second, paneId, mapper),
  };
}

export function addTerminalToPane(
  node: LayoutNode,
  paneId: string,
  terminalId: string,
): LayoutNode {
  return mapPane(node, paneId, (pane) => ({
    ...pane,
    terminalIds: pane.terminalIds.includes(terminalId)
      ? pane.terminalIds
      : [...pane.terminalIds, terminalId],
    activeTerminalId: terminalId,
  }));
}

export function setActiveTerminal(
  node: LayoutNode,
  paneId: string,
  terminalId: string,
): LayoutNode {
  return mapPane(node, paneId, (pane) => ({
    ...pane,
    activeTerminalId: pane.terminalIds.includes(terminalId)
      ? terminalId
      : pane.activeTerminalId,
  }));
}

export function splitPane(
  node: LayoutNode,
  paneId: string,
  direction: SplitDirection,
  terminalId?: string,
): LayoutNode {
  return mapPane(node, paneId, (pane) => ({
    type: "split",
    id: createId("split"),
    direction,
    ratio: 0.5,
    first: pane,
    second: createPane(terminalId ? [terminalId] : []),
  }));
}

export function removeTerminalFromLayout(
  node: LayoutNode,
  terminalId: string,
): LayoutNode {
  if (node.type === "pane") {
    const terminalIds = node.terminalIds.filter((id) => id !== terminalId);
    return {
      ...node,
      terminalIds,
      activeTerminalId:
        node.activeTerminalId === terminalId
          ? terminalIds[0] ?? null
          : node.activeTerminalId,
    };
  }
  return {
    ...node,
    first: removeTerminalFromLayout(node.first, terminalId),
    second: removeTerminalFromLayout(node.second, terminalId),
  };
}

export function updateSplitRatio(
  node: LayoutNode,
  splitId: string,
  ratio: number,
): LayoutNode {
  if (node.type === "pane") return node;
  if (node.id === splitId) {
    return { ...node, ratio: Math.min(0.8, Math.max(0.2, ratio)) };
  }
  return {
    ...node,
    first: updateSplitRatio(node.first, splitId, ratio),
    second: updateSplitRatio(node.second, splitId, ratio),
  };
}

export function firstPaneId(node: LayoutNode): string {
  return node.type === "pane" ? node.id : firstPaneId(node.first);
}

