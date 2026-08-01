import { describe, expect, it } from "vitest";
import {
  addTerminalToPane,
  createPane,
  moveTerminal,
  paneCount,
  removePaneFromLayout,
  removeTerminalFromLayout,
  splitPane,
} from "./layout";

describe("layout tree", () => {
  it("keeps tabs local to a pane", () => {
    const pane = createPane(["terminal-a"]);
    const layout = addTerminalToPane(pane, pane.id, "terminal-b");
    expect(layout.type).toBe("pane");
    if (layout.type === "pane") {
      expect(layout.terminalIds).toEqual(["terminal-a", "terminal-b"]);
      expect(layout.activeTerminalId).toBe("terminal-b");
    }
  });

  it("creates a nested split without moving existing tabs", () => {
    const pane = createPane(["codex", "powershell"]);
    const layout = splitPane(pane, pane.id, "vertical", "zsh");
    expect(layout.type).toBe("split");
    if (layout.type === "split") {
      expect(layout.first.type).toBe("pane");
      expect(layout.second.type).toBe("pane");
    }
  });

  it("removes a terminal definition from the layout", () => {
    const pane = createPane(["codex", "powershell"]);
    const layout = removeTerminalFromLayout(pane, "codex");
    expect(layout.type === "pane" && layout.terminalIds).toEqual(["powershell"]);
  });

  it("selects the next adjacent terminal when removing the active tab", () => {
    const pane = { ...createPane(["a", "b", "c"]), activeTerminalId: "b" };
    const layout = removeTerminalFromLayout(pane, "b");
    expect(layout.type === "pane" && layout.activeTerminalId).toBe("c");
  });

  it("reorders terminals inside one pane without changing the active tab", () => {
    const pane = { ...createPane(["a", "b", "c"]), activeTerminalId: "b" };
    const layout = moveTerminal(pane, pane.id, pane.id, "a", 2);
    expect(layout.type === "pane" && layout.terminalIds).toEqual(["b", "c", "a"]);
    expect(layout.type === "pane" && layout.activeTerminalId).toBe("b");
  });

  it("moves a terminal across panes and selects adjacent source and moved target tabs", () => {
    const left = { ...createPane(["a", "b", "c"]), activeTerminalId: "b" };
    const right = { ...createPane(["d", "e"]), activeTerminalId: "d" };
    const layout = {
      type: "split" as const,
      id: "split-root",
      direction: "horizontal" as const,
      ratio: 0.5,
      first: left,
      second: right,
    };

    const moved = moveTerminal(layout, left.id, right.id, "b", 1);
    expect(moved.type).toBe("split");
    if (moved.type === "split" && moved.first.type === "pane" && moved.second.type === "pane") {
      expect(moved.first.terminalIds).toEqual(["a", "c"]);
      expect(moved.first.activeTerminalId).toBe("c");
      expect(moved.second.terminalIds).toEqual(["d", "b", "e"]);
      expect(moved.second.activeTerminalId).toBe("b");
    }
  });

  it("keeps an empty source pane after moving its final terminal", () => {
    const left = createPane(["a"]);
    const right = createPane(["b"]);
    const layout = {
      type: "split" as const,
      id: "split-root",
      direction: "horizontal" as const,
      ratio: 0.5,
      first: left,
      second: right,
    };

    const moved = moveTerminal(layout, left.id, right.id, "a", 1);
    expect(moved.type === "split" && moved.first.type === "pane" && moved.first.terminalIds).toEqual([]);
  });

  it("collapses a deleted leaf pane by promoting its sibling subtree", () => {
    const left = createPane(["a"]);
    const upperRight = createPane(["b"]);
    const lowerRight = createPane(["c"]);
    const right = {
      type: "split" as const,
      id: "split-right",
      direction: "vertical" as const,
      ratio: 0.5,
      first: upperRight,
      second: lowerRight,
    };
    const layout = {
      type: "split" as const,
      id: "split-root",
      direction: "horizontal" as const,
      ratio: 0.5,
      first: left,
      second: right,
    };

    const collapsed = removePaneFromLayout(layout, left.id);
    expect(collapsed).toBe(right);
    expect(paneCount(collapsed)).toBe(2);
  });

  it("does not delete the final pane", () => {
    const pane = createPane(["a"]);
    expect(removePaneFromLayout(pane, pane.id)).toBe(pane);
    expect(paneCount(pane)).toBe(1);
  });
});
