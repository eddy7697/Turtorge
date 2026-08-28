// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { DragEvent as ReactDragEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "./lib/api";
import { useAppStore } from "./stores/appStore";
import type { AppSettings, ShellProfile, TerminalDefinition, Workspace } from "./types";

vi.mock("./components/terminals/PersistentTerminalDeck", () => ({
  PersistentTerminalDeck: () => null,
}));

vi.mock("./components/terminals/TerminalWorkspace", () => ({
  TerminalWorkspace: (props: {
    workspace: Workspace;
    layoutError: string | null;
    onTabDragStart: (
      drag: { sourceWorkspaceId: string; sourcePaneId: string; terminalId: string },
      event: ReactDragEvent<HTMLButtonElement>,
    ) => void;
  }) => {
    if (props.workspace.layout.type !== "pane") return null;
    const terminalId = props.workspace.layout.terminalIds[0];
    return (
      <div data-testid={`terminal-workspace-${props.workspace.id}`}>
        {terminalId && (
          <button
            draggable
            data-testid={`drag-terminal-${props.workspace.id}`}
            onDragStart={(event) => props.onTabDragStart({
              sourceWorkspaceId: props.workspace.id,
              sourcePaneId: props.workspace.layout.type === "pane" ? props.workspace.layout.id : "",
              terminalId,
            }, event)}
          >
            Drag terminal
          </button>
        )}
        {props.layoutError && <div role="alert">{props.layoutError}</div>}
      </div>
    );
  },
}));

import { TurtorgeApp } from "./App";

const shell: ShellProfile = {
  id: "powershell-7",
  name: "PowerShell 7",
  kind: "powerShell",
  executable: "pwsh.exe",
  version: "7.5.2",
  distribution: null,
  shell: null,
  loginShell: false,
  available: true,
};

const definition: TerminalDefinition = {
  id: "terminal-drag",
  name: "Drag me",
  profile: "shell",
  shellProfile: shell,
  workingDirectory: { kind: "windows", value: "E:\\Projects\\Source", distribution: null },
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
};

const settings: AppSettings = {
  theme: "dark",
  openLastWorkspace: true,
  confirmBeforeClose: true,
  sidebarWidth: 236,
  lastActiveWorkspaceId: "workspace-a",
  defaultLauncherProfileId: null,
  launcherProfiles: [],
};

function workspace(id: string, name: string, terminals: TerminalDefinition[] = []): Workspace {
  return {
    id,
    name,
    description: null,
    color: "#72d8c9",
    rootDirectory: { kind: "windows", value: `E:\\Projects\\${name}`, distribution: null },
    defaultShellProfile: shell,
    terminals,
    environmentVariables: [],
    layout: {
      type: "pane",
      id: `pane-${id}`,
      terminalIds: terminals.map(({ id: terminalId }) => terminalId),
      activeTerminalId: terminals[0]?.id ?? null,
    },
    pinned: true,
    favorite: false,
    createdAt: "2026-08-28T00:00:00Z",
    updatedAt: "2026-08-28T00:00:00Z",
    lastOpenedAt: null,
    openCount: 0,
  };
}

function dataTransfer(): DataTransfer {
  const values = new Map<string, string>();
  return {
    effectAllowed: "none",
    dropEffect: "none",
    getData: (type: string) => values.get(type) ?? "",
    setData: (type: string, value: string) => values.set(type, value),
  } as unknown as DataTransfer;
}

function workspaceRow(name: string): HTMLElement {
  const label = screen.getByText(name, { selector: ".workspace-name" });
  const row = label.closest<HTMLElement>(".workspace-tree-item");
  if (!row) throw new Error(`Workspace row not found: ${name}`);
  return row;
}

function visibleWorkspaceId(container: HTMLElement): string | null {
  return container
    .querySelector<HTMLElement>(".workspace-terminal-layer.active [data-testid^='terminal-workspace-']")
    ?.dataset.testid
    ?.replace("terminal-workspace-", "") ?? null;
}

describe("App terminal drag orchestration", () => {
  const source = workspace("workspace-a", "Alpha", [definition]);
  const preview = workspace("workspace-b", "Bravo");
  const target = workspace("workspace-c", "Charlie");

  beforeEach(() => {
    vi.useFakeTimers();
    useAppStore.setState({
      initialized: true,
      loading: false,
      workspaces: [source, preview, target],
      activeWorkspaceId: source.id,
      settings,
      runtimes: {},
      startRequests: {},
      pendingStarts: {},
      pendingConnections: {},
      workspaceMovePending: false,
      errors: {},
      sidebarCollapsed: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("previews after 600 ms, restores the source, drops on the latest target, and blocks a second drag", async () => {
    let resolveMove!: (result: Awaited<ReturnType<typeof api.moveTerminalToWorkspace>>) => void;
    vi.spyOn(api, "moveTerminalToWorkspace").mockReturnValueOnce(new Promise((resolve) => {
      resolveMove = resolve;
    }));
    vi.spyOn(api, "updateSettings").mockImplementation(async (next) => next);
    vi.spyOn(api, "listLauncherProfiles").mockResolvedValue([]);

    const movedSource: Workspace = {
      ...source,
      terminals: [],
      layout: {
        type: "pane",
        id: `pane-${source.id}`,
        terminalIds: [],
        activeTerminalId: null,
      },
    };
    const movedTarget: Workspace = {
      ...target,
      terminals: [definition],
      layout: {
        type: "pane",
        id: `pane-${target.id}`,
        terminalIds: [definition.id],
        activeTerminalId: definition.id,
      },
      lastOpenedAt: "2026-08-28T01:00:00Z",
      openCount: 1,
    };

    const { container } = render(<TurtorgeApp />);
    const transfer = dataTransfer();
    fireEvent.dragStart(screen.getByTestId(`drag-terminal-${source.id}`), { dataTransfer: transfer });

    fireEvent.dragOver(workspaceRow(preview.name), { dataTransfer: transfer });
    act(() => vi.advanceTimersByTime(599));
    expect(visibleWorkspaceId(container)).toBe(source.id);
    act(() => vi.advanceTimersByTime(1));
    expect(visibleWorkspaceId(container)).toBe(preview.id);

    fireEvent.dragOver(workspaceRow(source.name), { dataTransfer: transfer });
    expect(visibleWorkspaceId(container)).toBe(source.id);

    fireEvent.dragOver(workspaceRow(preview.name), { dataTransfer: transfer });
    act(() => vi.advanceTimersByTime(600));
    expect(visibleWorkspaceId(container)).toBe(preview.id);
    fireEvent.dragOver(workspaceRow(target.name), { dataTransfer: transfer });
    fireEvent.drop(workspaceRow(target.name), { dataTransfer: transfer });
    expect(visibleWorkspaceId(container)).toBe(target.id);
    expect(container.querySelector(".app-body")?.getAttribute("aria-busy")).toBe("true");

    fireEvent.dragStart(screen.getByTestId(`drag-terminal-${source.id}`), { dataTransfer: dataTransfer() });
    expect(screen.getByRole("alert").textContent).toContain("current terminal move");

    await act(async () => {
      resolveMove({
        sourceWorkspace: movedSource,
        targetWorkspace: movedTarget,
        runtime: null,
      });
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(useAppStore.getState().activeWorkspaceId).toBe(target.id);
    expect(useAppStore.getState().workspaceMovePending).toBe(false);
    expect(visibleWorkspaceId(container)).toBe(target.id);
    expect(container.querySelector(".app-body")?.getAttribute("aria-busy")).toBe("false");
  });
});
