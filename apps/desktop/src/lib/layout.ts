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

export function findPaneForTerminal(
  node: LayoutNode,
  terminalId: string,
): PaneNode | undefined {
  if (node.type === "pane") {
    return node.terminalIds.includes(terminalId) ? node : undefined;
  }
  return findPaneForTerminal(node.first, terminalId)
    ?? findPaneForTerminal(node.second, terminalId);
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

export function insertTerminalAfter(
  node: LayoutNode,
  sourceTerminalId: string,
  terminalId: string,
): LayoutNode {
  if (node.type === "pane") {
    const sourceIndex = node.terminalIds.indexOf(sourceTerminalId);
    if (sourceIndex < 0 || node.terminalIds.includes(terminalId)) return node;
    const terminalIds = [...node.terminalIds];
    terminalIds.splice(sourceIndex + 1, 0, terminalId);
    return { ...node, terminalIds, activeTerminalId: terminalId };
  }

  const first = insertTerminalAfter(node.first, sourceTerminalId, terminalId);
  if (first !== node.first) return { ...node, first };
  const second = insertTerminalAfter(node.second, sourceTerminalId, terminalId);
  return second === node.second ? node : { ...node, second };
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
    const removedIndex = node.terminalIds.indexOf(terminalId);
    const terminalIds = node.terminalIds.filter((id) => id !== terminalId);
    return {
      ...node,
      terminalIds,
      activeTerminalId:
        node.activeTerminalId === terminalId
          ? terminalIds[Math.min(removedIndex, terminalIds.length - 1)] ?? null
          : node.activeTerminalId,
    };
  }
  return {
    ...node,
    first: removeTerminalFromLayout(node.first, terminalId),
    second: removeTerminalFromLayout(node.second, terminalId),
  };
}

export function moveTerminal(
  node: LayoutNode,
  sourcePaneId: string,
  targetPaneId: string,
  terminalId: string,
  targetIndex: number,
): LayoutNode {
  const sourcePane = findPane(node, sourcePaneId);
  const targetPane = findPane(node, targetPaneId);
  if (!sourcePane?.terminalIds.includes(terminalId) || !targetPane) return node;

  if (sourcePaneId === targetPaneId) {
    return mapPane(node, sourcePaneId, (pane) => {
      const terminalIds = pane.terminalIds.filter((id) => id !== terminalId);
      terminalIds.splice(clampIndex(targetIndex, terminalIds.length), 0, terminalId);
      return { ...pane, terminalIds };
    });
  }

  const sourceIndex = sourcePane.terminalIds.indexOf(terminalId);
  const withoutSource = mapPane(node, sourcePaneId, (pane) => {
    const terminalIds = pane.terminalIds.filter((id) => id !== terminalId);
    return {
      ...pane,
      terminalIds,
      activeTerminalId:
        pane.activeTerminalId === terminalId
          ? terminalIds[Math.min(sourceIndex, terminalIds.length - 1)] ?? null
          : pane.activeTerminalId,
    };
  });

  return mapPane(withoutSource, targetPaneId, (pane) => {
    const terminalIds = pane.terminalIds.filter((id) => id !== terminalId);
    terminalIds.splice(clampIndex(targetIndex, terminalIds.length), 0, terminalId);
    return {
      ...pane,
      terminalIds,
      activeTerminalId: terminalId,
    };
  });
}

export function insertTerminalIntoPane(
  node: LayoutNode,
  paneId: string,
  terminalId: string,
  targetIndex: number,
): LayoutNode {
  if (!findPane(node, paneId)) return node;
  return mapPane(node, paneId, (pane) => {
    const terminalIds = pane.terminalIds.filter((id) => id !== terminalId);
    terminalIds.splice(clampIndex(targetIndex, terminalIds.length), 0, terminalId);
    return {
      ...pane,
      terminalIds,
      activeTerminalId: terminalId,
    };
  });
}

export function removePaneFromLayout(node: LayoutNode, paneId: string): LayoutNode {
  if (node.type === "pane") return node;
  if (node.first.type === "pane" && node.first.id === paneId) return node.second;
  if (node.second.type === "pane" && node.second.id === paneId) return node.first;

  const first = removePaneFromLayout(node.first, paneId);
  if (first !== node.first) return { ...node, first };
  const second = removePaneFromLayout(node.second, paneId);
  return second === node.second ? node : { ...node, second };
}

export function paneCount(node: LayoutNode): number {
  return node.type === "pane"
    ? 1
    : paneCount(node.first) + paneCount(node.second);
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

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(0, index), length);
}
