import { AlertCircle, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { LayoutNode, PaneNode, SplitDirection, TerminalDefinition, Workspace } from "../../types";
import { paneCount } from "../../lib/layout";
import { TerminalPane } from "./TerminalPane";

interface TerminalWorkspaceProps {
  workspace: Workspace;
  visible: boolean;
  layoutError: string | null;
  terminalFocusRequest: { terminalId: string; sequence: number } | null;
  onDismissLayoutError: () => void;
  onSelectTerminal: (paneId: string, terminalId: string) => void;
  onNewTerminal: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onRatioChange: (splitId: string, ratio: number) => void;
  onMoveTerminal: (sourcePaneId: string, targetPaneId: string, terminalId: string, targetIndex: number) => Promise<void>;
  onDeletePane: (paneId: string) => Promise<void>;
  onRemoveTerminal: (terminalId: string) => Promise<void>;
  onRenameTerminal: (terminalId: string, name: string) => Promise<void>;
  onEditTerminal: (definition: TerminalDefinition) => Promise<void>;
  onOpenLauncherSettings: () => void;
}

export function TerminalWorkspace(props: TerminalWorkspaceProps) {
  const [dragging, setDragging] = useState<{ paneId: string; terminalId: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ paneId: string; index: number } | null>(null);
  useEffect(() => {
    setDragging(null);
    setDropTarget(null);
  }, [props.workspace.id]);

  const startDrag = (paneId: string, terminalId: string, event: ReactDragEvent<HTMLButtonElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", terminalId);
    setDragging({ paneId, terminalId });
    setDropTarget(null);
  };
  const endDrag = () => {
    setDragging(null);
    setDropTarget(null);
  };
  const moveDropTarget = (paneId: string, index: number) => {
    if (dragging) setDropTarget({ paneId, index });
  };
  const finishDrop = (paneId: string, index: number) => {
    if (!dragging) return;
    const source = dragging;
    endDrag();
    void props.onMoveTerminal(source.paneId, paneId, source.terminalId, index).catch(() => undefined);
  };

  return (
    <div className="terminal-workspace">
      {props.layoutError && (
        <div className="layout-error-banner" role="alert">
          <AlertCircle size={15} />
          <span>{props.layoutError}</span>
          <button onClick={props.onDismissLayoutError} aria-label="Dismiss layout error" title="Dismiss"><X size={13} /></button>
        </div>
      )}
      <LayoutRenderer
        node={props.workspace.layout}
        {...props}
        paneTotal={paneCount(props.workspace.layout)}
        dragging={dragging}
        dropTarget={dropTarget}
        onTabDragStart={startDrag}
        onTabDragEnd={endDrag}
        onTabDragOver={moveDropTarget}
        onTabDrop={finishDrop}
      />
    </div>
  );
}

interface DragProps {
  paneTotal: number;
  dragging: { paneId: string; terminalId: string } | null;
  dropTarget: { paneId: string; index: number } | null;
  onTabDragStart: (paneId: string, terminalId: string, event: ReactDragEvent<HTMLButtonElement>) => void;
  onTabDragEnd: () => void;
  onTabDragOver: (paneId: string, index: number) => void;
  onTabDrop: (paneId: string, index: number) => void;
}

function LayoutRenderer({ node, ...props }: { node: LayoutNode } & TerminalWorkspaceProps & DragProps) {
  if (node.type === "pane") {
    return (
      <TerminalPane
        pane={node as PaneNode}
        workspace={props.workspace}
        workspaceVisible={props.visible}
        terminalFocusRequest={props.terminalFocusRequest}
        canDeletePane={props.paneTotal > 1}
        dragging={props.dragging}
        dropTarget={props.dropTarget?.paneId === node.id ? props.dropTarget : null}
        onSelectTerminal={props.onSelectTerminal}
        onNewTerminal={props.onNewTerminal}
        onSplit={props.onSplit}
        onDeletePane={props.onDeletePane}
        onRemoveTerminal={props.onRemoveTerminal}
        onRenameTerminal={props.onRenameTerminal}
        onEditTerminal={props.onEditTerminal}
        onOpenLauncherSettings={props.onOpenLauncherSettings}
        onTabDragStart={props.onTabDragStart}
        onTabDragEnd={props.onTabDragEnd}
        onTabDragOver={props.onTabDragOver}
        onTabDrop={props.onTabDrop}
      />
    );
  }
  return <SplitContainer node={node} {...props} />;
}

function SplitContainer({ node, ...props }: { node: Extract<LayoutNode, { type: "split" }> } & TerminalWorkspaceProps & DragProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(node.ratio);
  const ratioRef = useRef(node.ratio);
  useEffect(() => {
    ratioRef.current = node.ratio;
    setRatio(node.ratio);
  }, [node.ratio]);

  const beginResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const onMove = (moveEvent: PointerEvent) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return;
      const next = node.direction === "horizontal"
        ? (moveEvent.clientX - bounds.left) / bounds.width
        : (moveEvent.clientY - bounds.top) / bounds.height;
      ratioRef.current = Math.min(0.8, Math.max(0.2, next));
      setRatio(ratioRef.current);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      props.onRatioChange(node.id, ratioRef.current);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div ref={containerRef} className={`split-container ${node.direction}`}>
      <div className="split-child" style={{ flexBasis: `calc(${ratio * 100}% - 3px)` }}><LayoutRenderer node={node.first} {...props} /></div>
      <div className="split-handle" onPointerDown={beginResize} role="separator" aria-orientation={node.direction === "horizontal" ? "vertical" : "horizontal"} />
      <div className="split-child" style={{ flexBasis: `calc(${(1 - ratio) * 100}% - 3px)` }}><LayoutRenderer node={node.second} {...props} /></div>
    </div>
  );
}
