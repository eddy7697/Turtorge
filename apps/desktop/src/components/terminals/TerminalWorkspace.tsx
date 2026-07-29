import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { LayoutNode, PaneNode, SplitDirection, Workspace } from "../../types";
import { TerminalPane } from "./TerminalPane";

interface TerminalWorkspaceProps {
  workspace: Workspace;
  onSelectTerminal: (paneId: string, terminalId: string) => void;
  onNewTerminal: (paneId: string) => void;
  onSplit: (paneId: string, direction: SplitDirection) => void;
  onRatioChange: (splitId: string, ratio: number) => void;
  onRemoveTerminal: (terminalId: string) => Promise<void>;
}

export function TerminalWorkspace(props: TerminalWorkspaceProps) {
  return <div className="terminal-workspace"><LayoutRenderer node={props.workspace.layout} {...props} /></div>;
}

function LayoutRenderer({ node, ...props }: { node: LayoutNode } & TerminalWorkspaceProps) {
  if (node.type === "pane") {
    return <TerminalPane pane={node as PaneNode} workspace={props.workspace} onSelectTerminal={props.onSelectTerminal} onNewTerminal={props.onNewTerminal} onSplit={props.onSplit} onRemoveTerminal={props.onRemoveTerminal} />;
  }
  return <SplitContainer node={node} {...props} />;
}

function SplitContainer({ node, ...props }: { node: Extract<LayoutNode, { type: "split" }> } & TerminalWorkspaceProps) {
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
