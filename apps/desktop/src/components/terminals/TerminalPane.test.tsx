// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../stores/appStore";
import type { PaneNode, ShellProfile, TerminalDefinition, Workspace } from "../../types";
import { TerminalPane } from "./TerminalPane";

vi.mock("../../lib/api", () => ({ closeTerminal: vi.fn() }));
const xtermLifecycle = vi.hoisted(() => ({ mount: vi.fn(), unmount: vi.fn() }));
vi.mock("./XtermView", async () => {
  const { useEffect } = await import("react");
  return {
    XtermView: ({ workspace }: { workspace: { id: string } }) => {
      useEffect(() => {
        xtermLifecycle.mount(workspace.id);
        return () => xtermLifecycle.unmount(workspace.id);
      }, []);
      return <div data-testid="xterm-view" />;
    },
  };
});

const powerShell: ShellProfile = {
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

const terminal: TerminalDefinition = {
  id: "terminal-test",
  name: "Original label",
  profile: "shell",
  shellProfile: powerShell,
  workingDirectory: { kind: "windows", value: "E:\\Projects\\Test", distribution: null },
  startupCommand: null,
  environmentVariables: [],
  autoStart: false,
};

const pane: PaneNode = {
  type: "pane",
  id: "pane-test",
  terminalIds: [terminal.id],
  activeTerminalId: terminal.id,
};

const workspace: Workspace = {
  id: "workspace-test",
  name: "Test",
  description: null,
  color: "#72d8c9",
  rootDirectory: terminal.workingDirectory,
  defaultShellProfile: powerShell,
  terminals: [terminal],
  environmentVariables: [],
  layout: pane,
  pinned: false,
  favorite: false,
  createdAt: "2026-07-29T00:00:00Z",
  updatedAt: "2026-07-29T00:00:00Z",
  lastOpenedAt: null,
  openCount: 0,
};

describe("TerminalPane", () => {
  afterEach(cleanup);
  beforeEach(() => {
    xtermLifecycle.mount.mockClear();
    xtermLifecycle.unmount.mockClear();
    useAppStore.setState({
      runtimes: {},
      pendingConnections: {},
      startRequests: {},
      errors: {},
    });
  });

  it("remounts the xterm view when the workspace identity changes", () => {
    const sharedProps = {
      pane,
      canDeletePane: false,
      dragging: null,
      dropTarget: null,
      onSelectTerminal: vi.fn(),
      onNewTerminal: vi.fn(),
      onSplit: vi.fn(),
      onDeletePane: vi.fn(),
      onRemoveTerminal: vi.fn(),
      onRenameTerminal: vi.fn(),
      onTabDragStart: vi.fn(),
      onTabDragEnd: vi.fn(),
      onTabDragOver: vi.fn(),
      onTabDrop: vi.fn(),
    };
    const { rerender } = render(<TerminalPane {...sharedProps} workspace={workspace} />);
    expect(xtermLifecycle.mount).toHaveBeenCalledWith("workspace-test");

    rerender(<TerminalPane {...sharedProps} workspace={{ ...workspace, id: "workspace-other" }} />);

    expect(xtermLifecycle.unmount).toHaveBeenCalledWith("workspace-test");
    expect(xtermLifecycle.mount).toHaveBeenCalledWith("workspace-other");
  });

  it("renames the active terminal from the pane action", async () => {
    const onRenameTerminal = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminalPane
        pane={pane}
        workspace={workspace}
        canDeletePane={false}
        dragging={null}
        dropTarget={null}
        onSelectTerminal={vi.fn()}
        onNewTerminal={vi.fn()}
        onSplit={vi.fn()}
        onDeletePane={vi.fn()}
        onRemoveTerminal={vi.fn()}
        onRenameTerminal={onRenameTerminal}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename terminal" }));
    fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "API logs" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(onRenameTerminal).toHaveBeenCalledWith("terminal-test", "API logs"));
  });

  it("confirms deletion of a non-empty pane", async () => {
    const onDeletePane = vi.fn().mockResolvedValue(undefined);
    render(
      <TerminalPane
        pane={pane}
        workspace={workspace}
        canDeletePane
        dragging={null}
        dropTarget={null}
        onSelectTerminal={vi.fn()}
        onNewTerminal={vi.fn()}
        onSplit={vi.fn()}
        onDeletePane={onDeletePane}
        onRemoveTerminal={vi.fn()}
        onRenameTerminal={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete pane" }));
    expect(screen.getByText("1 saved terminal will be deleted.")).toBeTruthy();
    expect(screen.getByText("0 running processes will be terminated.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Pane" }));

    await waitFor(() => expect(onDeletePane).toHaveBeenCalledWith("pane-test"));
  });

  it("blocks pane deletion while a terminal connection is pending", () => {
    useAppStore.setState({ pendingConnections: { [terminal.id]: 1 } });
    render(
      <TerminalPane
        pane={pane}
        workspace={workspace}
        canDeletePane
        dragging={null}
        dropTarget={null}
        onSelectTerminal={vi.fn()}
        onNewTerminal={vi.fn()}
        onSplit={vi.fn()}
        onDeletePane={vi.fn()}
        onRemoveTerminal={vi.fn()}
        onRenameTerminal={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete pane" }));
    expect(screen.getByText("Wait for terminal activity to settle.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete Pane" }).hasAttribute("disabled")).toBe(true);
  });

  it("forwards native tab drag events and appends a surface drop", () => {
    const onTabDragStart = vi.fn();
    const onTabDragOver = vi.fn();
    const onTabDrop = vi.fn();
    const { container } = render(
      <TerminalPane
        pane={pane}
        workspace={workspace}
        canDeletePane={false}
        dragging={{ paneId: pane.id, terminalId: terminal.id }}
        dropTarget={null}
        onSelectTerminal={vi.fn()}
        onNewTerminal={vi.fn()}
        onSplit={vi.fn()}
        onDeletePane={vi.fn()}
        onRemoveTerminal={vi.fn()}
        onRenameTerminal={vi.fn()}
        onTabDragStart={onTabDragStart}
        onTabDragEnd={vi.fn()}
        onTabDragOver={onTabDragOver}
        onTabDrop={onTabDrop}
      />,
    );
    const dataTransfer = { dropEffect: "none", effectAllowed: "none", setData: vi.fn() };
    const tab = screen.getByRole("tab", { name: /Original label/ });
    const surface = container.querySelector(".terminal-surface");

    fireEvent.dragStart(tab, { dataTransfer });
    expect(onTabDragStart).toHaveBeenCalledWith(pane.id, terminal.id, expect.anything());

    expect(surface).toBeTruthy();
    fireEvent.dragOver(surface!, { dataTransfer });
    fireEvent.drop(surface!, { dataTransfer });

    expect(onTabDragOver).toHaveBeenCalledWith(pane.id, 0);
    expect(onTabDrop).toHaveBeenCalledWith(pane.id, 0);
  });

  it("maps a vertical mouse wheel to horizontal tab scrolling and leaves horizontal gestures native", () => {
    const { container } = render(
      <TerminalPane
        pane={pane}
        workspace={workspace}
        canDeletePane={false}
        dragging={null}
        dropTarget={null}
        onSelectTerminal={vi.fn()}
        onNewTerminal={vi.fn()}
        onSplit={vi.fn()}
        onDeletePane={vi.fn()}
        onRemoveTerminal={vi.fn()}
        onRenameTerminal={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );
    const strip = container.querySelector<HTMLElement>(".terminal-tab-strip");
    expect(strip).toBeTruthy();
    Object.defineProperty(strip!, "scrollWidth", { configurable: true, value: 600 });
    Object.defineProperty(strip!, "clientWidth", { configurable: true, value: 200 });
    strip!.scrollLeft = 100;

    fireEvent.wheel(strip!, { deltaX: 0, deltaY: 40, deltaMode: 0 });
    expect(strip!.scrollLeft).toBe(140);

    fireEvent.wheel(strip!, { deltaX: 0, deltaY: -30, deltaMode: 0 });
    expect(strip!.scrollLeft).toBe(110);

    fireEvent.wheel(strip!, { deltaX: 35, deltaY: 4, deltaMode: 0 });
    expect(strip!.scrollLeft).toBe(110);
  });
});
