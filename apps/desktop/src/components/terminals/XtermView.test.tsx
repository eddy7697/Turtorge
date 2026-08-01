// @vitest-environment jsdom

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { TerminalEvent, TerminalRuntimeSnapshot, Workspace } from "../../types";
import { XtermView } from "./XtermView";
import { SHIFT_ENTER_SEQUENCE } from "./terminalKeymap";

const xterm = vi.hoisted(() => ({
  keyHandler: null as ((event: KeyboardEvent) => boolean) | null,
  writes: [] as Array<string | number[]>,
  fit: vi.fn(),
  focus: vi.fn(),
  dispose: vi.fn(),
}));

vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = xterm.fit; } }));
vi.mock("@xterm/addon-web-links", () => ({ WebLinksAddon: class {} }));
vi.mock("@xterm/xterm", () => ({
  Terminal: class {
    cols = 80;
    rows = 24;
    options: Record<string, unknown> = {};
    loadAddon() {}
    open() {}
    attachCustomKeyEventHandler(handler: (event: KeyboardEvent) => boolean) { xterm.keyHandler = handler; }
    onData() { return { dispose: vi.fn() }; }
    onResize() { return { dispose: vi.fn() }; }
    write(data: string | Uint8Array) { xterm.writes.push(typeof data === "string" ? data : Array.from(data)); }
    focus() { xterm.focus(); }
    dispose() { xterm.dispose(); }
  },
}));

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
    xterm.keyHandler = null;
    xterm.writes.length = 0;
    xterm.fit.mockClear();
    xterm.focus.mockClear();
    xterm.dispose.mockClear();
    vi.mocked(api.attachTerminal).mockReset();
    vi.mocked(api.detachTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.resizeTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.startTerminal).mockReset();
    vi.mocked(api.writeTerminal).mockReset().mockResolvedValue(undefined);
    vi.mocked(api.writeTerminalDefinition).mockReset().mockResolvedValue(undefined);
    useAppStore.setState({ runtimes: {}, errors: {}, pendingConnections: {}, startRequests: {} });
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("crypto", { randomUUID: () => "connection-test" });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("sends Shift+Enter as an extended key without passing Enter to xterm", async () => {
    render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate={false} connectionGeneration={0} />);
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

  it("replays the snapshot before queued live output and attaches only once", async () => {
    let emit: ((event: TerminalEvent) => void) | undefined;
    let resolveAttach: ((snapshot: TerminalRuntimeSnapshot) => void) | undefined;
    vi.mocked(api.attachTerminal).mockImplementation((_runtimeId, _connectionId, onEvent) => {
      emit = onEvent;
      return new Promise((resolve) => { resolveAttach = resolve; });
    });
    useAppStore.setState({ runtimes: { [runtime.definitionId]: runtime } });
    const { unmount } = render(<XtermView workspace={workspace} definition={workspace.terminals[0]} activate connectionGeneration={0} />);

    await waitFor(() => expect(emit).toBeDefined());
    emit!({ event: "output", data: [2] });
    expect(xterm.writes).toEqual([]);
    resolveAttach!({ ...runtime, scrollback: [1] });

    await waitFor(() => expect(xterm.writes).toEqual([[1], [2]]));
    expect(api.attachTerminal).toHaveBeenCalledTimes(1);

    unmount();
    expect(api.detachTerminal).toHaveBeenCalledWith(runtime.id, "workspace-test:terminal-claude:0:connection-test");
  });

  it("focuses the terminal when a sidebar focus request changes", async () => {
    const definition = workspace.terminals[0];
    const { rerender } = render(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} />,
    );
    expect(xterm.focus).not.toHaveBeenCalled();

    rerender(
      <XtermView workspace={workspace} definition={definition} activate={false} connectionGeneration={0} focusRequest={1} />,
    );

    await waitFor(() => expect(xterm.focus).toHaveBeenCalledTimes(1));
  });
});
