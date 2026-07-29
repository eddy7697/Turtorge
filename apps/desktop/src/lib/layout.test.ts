import { describe, expect, it } from "vitest";
import { addTerminalToPane, createPane, removeTerminalFromLayout, splitPane } from "./layout";

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
});
