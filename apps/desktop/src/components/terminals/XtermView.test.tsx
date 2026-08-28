// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import * as api from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { TerminalEvent, TerminalRuntimeSnapshot, Workspace } from "../../types";
import { PersistentTerminalDeck } from "./PersistentTerminalDeck";
import { PersistentTerminalSlot, terminalMountKey } from "./PersistentTerminalSlot";
import { XtermView } from "./XtermView";
import { SHIFT_ENTER_SEQUENCE } from "./terminalKeymap";

const xterm = vi.hoisted(() => ({
  dataHandler: null as ((data: string) => void) | null,
  keyHandler: null as ((event: KeyboardEvent) => boolean) | null,
  selectionHandler: null as (() => void) | null,
  selection: "",
  writes: [] as Array<string | number[]>,
  construct: vi.fn(),
  fit: vi.fn(),
  refresh: vi.fn(),
  reset: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = xterm.fit; } }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    constructor() { xterm.construct(); }
    cols = 80;
    rows = 24;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) { xterm.keyHandler = handler; }
    onData(handler: (data: string) => void) { xterm.dataHandler = handler; return { dispose: vi.fn() }; }
    onSelectionChange(handler: () => void) { xterm.selectionHandler = handler; return { dispose: vi.fn() }; }
    onResize() { return { dispose: vi.fn() }; }
    getSelection() { return xterm.selection; }
    write(data: string | Uint8Array) { xterm.writes.push(typeof data === "string" ? data : Array.from(data)); }
    refresh(start: number, end: number) { xterm.refresh(start, end); }
    reset() { xterm.reset(); }
    focus() { xterm.focus(); }
    dispose() { xterm.dispose(); }
  },
}));

vi.mock("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: vi.fn() }));

vi.mock("../../lib/api", () => ({
  attachTerminal: vi.fn(),
  detachTerminal: vi.fn(),
  resizeTerminal: vi.fn(),
  startTerminal: vi.fn(),
  writeTerminal: vi.fn(),
  writeTerminalDefinition: vi.fn(),
}));

const runtime: TerminalRuntimeSnapshot = {
  id: "runtime-claude",
  workspaceId: "workspace-test",
  definitionId: "terminal-claude",
  processId: 42,
  status: "running",
  exitCode: null,
  cols: 80,
  rows: 24,
  scrollback: [],
};

const workspace: Workspace = {
  id: "workspace-test",
  name: "Test",
  description: null,
  color: "#72d8c9",
  rootDirectory: { kind: "wsl", value: "/home/test/project", distribution: "Ubuntu" },
  defaultShellProfile: {
    id: "wsl-zsh",
    name: "zsh",
    kind: "wsl",
    executable: "wsl.exe",
    distribution: "Ubuntu",
    shell: "/usr/bin/zsh",
    loginShell: true,
    available: true,
  },
  terminals: [{
    id: "terminal-claude",
    name: "Claude",
    profile: "claudeCode",
    shellProfile: {
      id: "wsl-zsh",
      name: "zsh",
      kind: "wsl",
      executable: "wsl.exe",
      distribution: "Ubuntu",
      shell: "/usr/bin/zsh",
      loginShell: true,
      available: true,
    },
    workingDirectory: { kind: "wsl", value: "/home/test/project", distribution: "Ubuntu" },
    startupCommand: "claude",
    environmentVariables: [],
    autoStart: false,
  }],
  environmentVariables: [],
  layout: { type: "pane", id: "pane-test", terminalIds: ["terminal-claude"], activeTerminalId: "terminal-claude" },
  pinned: false,
  favorite: false,
  createdAt: "2026-07-31T00:00:00Z",
  updatedAt: "2026-07-31T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

describe("XtermView", () => {
  beforeEach(() => {
    xterm.dataHandler = null;
    xterm.keyHandler = null;
    xterm.selectionHandler = null;
    xterm.selection = "";
    xterm.writes.length = 0;
    xterm.construct.mockClear();
    xterm.fit.mockClear();
    xterm.refresh.mockClear();
    xterm.reset.mockClear();
    xterm.focus.mockClear();
    xterm.dispose.mockClear();
    vi.mocked(api.attachTerminal).mockReset();
    vi.mocked(api.detachTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.resizeTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.startTerminal).mockReset();
    vi.mocked(api.writeTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.writeTerminalDefinition).mockReset().mockResolvedValue(undefined);
    vi.mocked(writeText).mockReset().mockResolvedValue(undefined);
    useAppStore.setState({ runtimes: {}, errors: {}, pendingConnections: {}, pendingStarts: {}, startRequests: {} });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("crypto", { randomUUID: () => "connection-test" });
  });

  it("copies a completed terminal selection to the system clipboard", async () => {
    render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate={false} connectionGeneration={0} visible />);
    await waitFor(() => expect(xterm.selectionHandler).not.toBeNull());

    xterm.selection = "selected Claude output";
    xterm.selectionHandler!();

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("selected Claude output"));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends Shift+Enter as an extended key without passing Enter to xterm", async () => {
    render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate={false} connectionGeneration={0} visible />);
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull());
    const preventDefault = vi.fn();

    const handledByXterm = xterm.keyHandler!({
      type: "keydown",
      key: "Enter",
      shiftKey: true,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      preventDefault,
    } as unknown as KeyboardEvent);

    expect(handledByXterm).toBe(false);
    expect(preventDefault).toHaveBeenCalled();
    await waitFor(() => expect(api.writeTerminalDefinition).toHaveBeenCalled());
    const bytes = vi.mocked(api.writeTerminalDefinition).mock.calls[0][1];
    expect(new TextDecoder().decode(bytes)).toBe(SHIFT_ENTER_SEQUENCE);
  });

  it("preserves xterm history and delete control sequences byte-for-byte", async () => {
    render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate={false} connectionGeneration={0} visible />);
    await waitFor(() => expect(xterm.dataHandler).not.toBeNull());

    for (const sequence of ["\u001b[A", "\u001b[B", "\u007f", "\u001b[3~"]) {
      xterm.dataHandler!(sequence);
    }

    await waitFor(() => expect(api.writeTerminalDefinition).toHaveBeenCalledTimes(4));
    expect(vi.mocked(api.writeTerminalDefinition).mock.calls.map((call) => Array.from(call[1]))).toEqual([
      [27, 91, 65],
      [27, 91, 66],
      [127],
      [27, 91, 51, 126],
    ]);
  });

  it("resets the emulator when a force restart requests a fresh generation", async () => {
    const definition = workspace.terminals[0];
    const { rerender } = render(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} visible />,
    );
    await waitFor(() => expect(xterm.keyHandler).not.toBeNull());
    expect(xterm.reset).not.toHaveBeenCalled();

    rerender(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={1} visible />,
    );

    await waitFor(() => expect(xterm.reset).toHaveBeenCalledTimes(1));
  });

  it("replays the snapshot before queued live output and attaches only once", async () => {
    let emit: ((event: TerminalEvent) => void) | undefined;
    let resolveAttach: ((snapshot: TerminalRuntimeSnapshot) => void) | undefined;
    vi.mocked(api.attachTerminal).mockImplementation((_runtimeId, _connectionId, onEvent) => {
      emit = onEvent;
      return new Promise((resolve) => { resolveAttach = resolve; });
    });
    useAppStore.setState({ runtimes: { [runtime.definitionId]: runtime } });
    const { unmount } = render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate connectionGeneration={0} visible />);

    await waitFor(() => expect(emit).toBeDefined());
    emit!({ event: "output", data: [2] });
    expect(xterm.writes).toEqual([]);
    resolveAttach!({ ...runtime, scrollback: [1] });

    await waitFor(() => expect(xterm.writes).toEqual([[1], [2]]));
    expect(api.attachTerminal).toHaveBeenCalledTimes(1);

    unmount();
    expect(api.detachTerminal).toHaveBeenCalledWith(runtime.id, "workspace-test:terminal-claude:0:connection-test");
  });

  it("keeps a hidden running terminal attached and processing output", async () => {
    let emit: ((event: TerminalEvent) => void) | undefined;
    vi.mocked(api.attachTerminal).mockImplementation((_runtimeId, _connectionId, onEvent) => {
      emit = onEvent;
      return Promise.resolve(runtime);
    });
    useAppStore.setState({ runtimes: { [runtime.definitionId]: runtime } });

    render(
      <XtermView workspace={workspace} definition={workspace.terminals[0]} activate connectionGeneration={0} visible={false} />,
    );

    await waitFor(() => expect(emit).toBeDefined());
    emit!({ event: "output", data: [7, 8] });
    await waitFor(() => expect(xterm.writes).toEqual([[7, 8]]));
    expect(api.attachTerminal).toHaveBeenCalledTimes(1);
    expect(xterm.focus).not.toHaveBeenCalled();
  });

  it("focuses the terminal when a sidebar focus request changes", async () => {
    const definition = workspace.terminals[0];
    const { rerender } = render(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} visible />,
    );
    await waitFor(() => expect(xterm.focus).toHaveBeenCalled());
    xterm.focus.mockClear();

    rerender(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} visible focusRequest={1} />,
    );

    await waitFor(() => expect(xterm.focus).toHaveBeenCalledTimes(1));
  });

  it("refreshes the retained terminal when it becomes visible", async () => {
    const definition = workspace.terminals[0];
    const { rerender } = render(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} visible={false} />,
    );
    xterm.fit.mockClear();
    xterm.refresh.mockClear();
    xterm.focus.mockClear();

    rerender(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} visible />,
    );

    await waitFor(() => expect(xterm.refresh).toHaveBeenCalledWith(0, 23));
    expect(xterm.fit).toHaveBeenCalled();
    expect(xterm.focus).toHaveBeenCalled();
    expect(xterm.dispose).not.toHaveBeenCalled();
  });

  it("reparents one emulator across pane and workspace owners and disposes it only after deletion", async () => {
    vi.mocked(api.attachTerminal).mockResolvedValue(runtime);
    useAppStore.setState({ runtimes: { [runtime.definitionId]: runtime } });
    const definition = workspace.terminals[0];
    const paneA = { type: "pane" as const, id: "pane-a", terminalIds: [definition.id], activeTerminalId: definition.id };
    const paneB = { type: "pane" as const, id: "pane-b", terminalIds: [definition.id], activeTerminalId: definition.id };
    const paneC = { type: "pane" as const, id: "pane-c", terminalIds: [definition.id], activeTerminalId: definition.id };
    const emptyPaneA = { ...paneA, terminalIds: [], activeTerminalId: null };
    const emptyPaneC = { ...paneC, terminalIds: [], activeTerminalId: null };
    const sourceInPaneA = { ...workspace, layout: paneA };
    const sourceInPaneB = { ...workspace, layout: paneB };
    const emptySource = { ...workspace, terminals: [], layout: emptyPaneA };
    const targetBase: Workspace = {
      ...workspace,
      id: "workspace-target",
      name: "Target",
      terminals: [],
      layout: emptyPaneC,
    };
    const movedToTarget = { ...targetBase, terminals: [definition], layout: paneC };

    const Harness = ({ stage }: { stage: "pane-a" | "pane-b" | "workspace" | "deleted" }) => {
      const owner = stage === "pane-a"
        ? { workspaces: [sourceInPaneA, targetBase], workspaceId: workspace.id, paneId: paneA.id }
        : stage === "pane-b"
          ? { workspaces: [sourceInPaneB, targetBase], workspaceId: workspace.id, paneId: paneB.id }
          : stage === "workspace"
            ? { workspaces: [emptySource, movedToTarget], workspaceId: targetBase.id, paneId: paneC.id }
            : { workspaces: [emptySource, targetBase], workspaceId: targetBase.id, paneId: paneC.id };
      const mountKey = terminalMountKey(owner.workspaceId, owner.paneId, definition.id);
      return (
        <>
          <PersistentTerminalSlot key={mountKey} mountKey={mountKey} />
          <PersistentTerminalDeck
            workspaces={owner.workspaces}
            visibleWorkspaceId={owner.workspaceId}
            terminalFocusRequest={null}
          />
        </>
      );
    };

    const { container, rerender } = render(<Harness stage="pane-a" />);
    await waitFor(() => expect(api.attachTerminal).toHaveBeenCalledTimes(1));
    const host = container.querySelector<HTMLElement>(".xterm-host");
    const paneASlot = container.querySelector<HTMLElement>(".persistent-terminal-slot");
    expect(host).toBeTruthy();
    expect(paneASlot?.contains(host ?? null)).toBe(true);
    expect(xterm.construct).toHaveBeenCalledTimes(1);

    rerender(<Harness stage="pane-b" />);
    await waitFor(() => {
      const paneBSlot = container.querySelector<HTMLElement>(".persistent-terminal-slot");
      expect(paneBSlot).not.toBe(paneASlot);
      expect(paneBSlot?.contains(host ?? null)).toBe(true);
    });
    expect(xterm.construct).toHaveBeenCalledTimes(1);
    expect(xterm.dispose).not.toHaveBeenCalled();
    expect(api.attachTerminal).toHaveBeenCalledTimes(1);

    const paneBSlot = container.querySelector<HTMLElement>(".persistent-terminal-slot");
    rerender(<Harness stage="workspace" />);
    await waitFor(() => {
      const targetSlot = container.querySelector<HTMLElement>(".persistent-terminal-slot");
      expect(targetSlot).not.toBe(paneBSlot);
      expect(targetSlot?.contains(host ?? null)).toBe(true);
    });
    expect(xterm.construct).toHaveBeenCalledTimes(1);
    expect(xterm.dispose).not.toHaveBeenCalled();
    expect(api.attachTerminal).toHaveBeenCalledTimes(1);

    rerender(<Harness stage="deleted" />);
    await waitFor(() => expect(xterm.dispose).toHaveBeenCalledTimes(1));
    expect(api.detachTerminal).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".xterm-host")).toBeNull();
  });
});
