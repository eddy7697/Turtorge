// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "../../stores/appStore";
import type { LauncherProfileStatus, PaneNode, ShellProfile, TerminalDefinition, Workspace } from "../../types";
import { TerminalPane } from "./TerminalPane";

const apiMocks = vi.hoisted(() => ({
  closeTerminal: vi.fn(),
  openLauncher: vi.fn(),
  chooseWindowsDirectory: vi.fn(),
  chooseWslDirectory: vi.fn(),
  detectWslShells: vi.fn(),
  validatePath: vi.fn(),
  updateSettings: vi.fn(),
  listLauncherProfiles: vi.fn(),
}));
vi.mock("../../lib/api", () => apiMocks);

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

const explorerStatus: LauncherProfileStatus = {
  profile: {
    id: "builtin-explorer",
    name: "File Explorer",
    program: "explorer.exe",
    arguments: ["{path}"],
    wslArguments: null,
    detectionMode: "auto",
    icon: "explorer",
    accent: null,
    builtIn: true,
  },
  available: true,
  resolvedProgram: "C:\\Windows\\explorer.exe",
  unavailableReason: null,
};

describe("TerminalPane", () => {
  afterEach(cleanup);
  beforeEach(() => {
    useAppStore.setState({
      runtimes: {},
      pendingConnections: {},
      startRequests: {},
      pendingStarts: {},
      errors: {},
      launcherProfiles: [explorerStatus],
      windowsShells: [powerShell],
      wslDistributions: [],
      settings: {
        theme: "system",
        openLastWorkspace: true,
        confirmBeforeClose: true,
        sidebarWidth: 236,
        lastActiveWorkspaceId: null,
        defaultLauncherProfileId: null,
        launcherProfiles: [],
      },
    });
    apiMocks.openLauncher.mockResolvedValue({ profileId: explorerStatus.profile.id, program: explorerStatus.resolvedProgram, arguments: [terminal.workingDirectory.value] });
    apiMocks.validatePath.mockResolvedValue(true);
  });

  it("keeps every persistent terminal slot mounted when the active tab changes", () => {
    const secondTerminal: TerminalDefinition = { ...terminal, id: "terminal-second", name: "Second" };
    const twoTerminalWorkspace: Workspace = { ...workspace, terminals: [terminal, secondTerminal] };
    const twoTerminalPane: PaneNode = { ...pane, terminalIds: [terminal.id, secondTerminal.id] };
    const sharedProps = {
      canDeletePane: false,
      dragging: null,
      dropTarget: null,
      onSelectTerminal: vi.fn(),
      onNewTerminal: vi.fn(),
      onSplit: vi.fn(),
      onDeletePane: vi.fn(),
      onRenameTerminal: vi.fn(),
      terminalContextTargetId: null,
      onTerminalContextMenu: vi.fn(),
      onOpenLauncherSettings: vi.fn(),
      onTabDragStart: vi.fn(),
      onTabDragEnd: vi.fn(),
      onTabDragOver: vi.fn(),
      onTabDrop: vi.fn(),
    };
    const { container, rerender } = render(<TerminalPane {...sharedProps} pane={twoTerminalPane} workspace={twoTerminalWorkspace} />);
    const firstSlot = container.querySelector(`[data-terminal-view="${terminal.id}"] .persistent-terminal-slot`);
    const secondSlot = container.querySelector(`[data-terminal-view="${secondTerminal.id}"] .persistent-terminal-slot`);
    expect(firstSlot).toBeTruthy();
    expect(secondSlot).toBeTruthy();
    expect(container.querySelector(`[data-terminal-view="${terminal.id}"]`)?.classList.contains("active")).toBe(true);

    rerender(<TerminalPane {...sharedProps} pane={{ ...twoTerminalPane, activeTerminalId: secondTerminal.id }} workspace={twoTerminalWorkspace} />);

    expect(container.querySelector(`[data-terminal-view="${terminal.id}"] .persistent-terminal-slot`)).toBe(firstSlot);
    expect(container.querySelector(`[data-terminal-view="${secondTerminal.id}"] .persistent-terminal-slot`)).toBe(secondSlot);
    expect(container.querySelector(`[data-terminal-view="${terminal.id}"]`)?.classList.contains("inactive")).toBe(true);
    expect(container.querySelector(`[data-terminal-view="${secondTerminal.id}"]`)?.classList.contains("active")).toBe(true);
  });

  it("keeps terminal slots mounted while the workspace is hidden", () => {
    const sharedProps = {
      pane,
      workspace,
      canDeletePane: false,
      dragging: null,
      dropTarget: null,
      onSelectTerminal: vi.fn(),
      onNewTerminal: vi.fn(),
      onSplit: vi.fn(),
      onDeletePane: vi.fn(),
      onRenameTerminal: vi.fn(),
      terminalContextTargetId: null,
      onTerminalContextMenu: vi.fn(),
      onOpenLauncherSettings: vi.fn(),
      onTabDragStart: vi.fn(),
      onTabDragEnd: vi.fn(),
      onTabDragOver: vi.fn(),
      onTabDrop: vi.fn(),
    };
    const { container, rerender } = render(<TerminalPane {...sharedProps} workspaceVisible />);
    const slot = container.querySelector(`[data-terminal-view="${terminal.id}"] .persistent-terminal-slot`);
    expect(slot).toBeTruthy();
    expect(container.querySelector(`[data-terminal-view="${terminal.id}"]`)?.getAttribute("aria-hidden")).toBe("false");

    rerender(<TerminalPane {...sharedProps} workspaceVisible={false} />);

    expect(container.querySelector(`[data-terminal-view="${terminal.id}"] .persistent-terminal-slot`)).toBe(slot);
    expect(container.querySelector(`[data-terminal-view="${terminal.id}"]`)?.getAttribute("aria-hidden")).toBe("true");
  });

  it("keeps double-click as the quick rename interaction", async () => {
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
        onRenameTerminal={onRenameTerminal}
        terminalContextTargetId={null}
        onTerminalContextMenu={vi.fn()}
        onOpenLauncherSettings={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("tab", { name: /Original label/ }));
    fireEvent.change(screen.getByLabelText("Terminal name"), { target: { value: "API logs" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    await waitFor(() => expect(onRenameTerminal).toHaveBeenCalledWith("terminal-test", "API logs"));
  });

  it("opens terminal actions from a tab context menu without selecting it", () => {
    const onSelectTerminal = vi.fn();
    const onTerminalContextMenu = vi.fn();
    renderPane({ onSelectTerminal, onTerminalContextMenu });

    fireEvent.contextMenu(screen.getByRole("tab", { name: /Original label/ }), { clientX: 120, clientY: 44 });

    expect(onTerminalContextMenu).toHaveBeenCalledWith(terminal, { x: 120, y: 44 });
    expect(onSelectTerminal).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Edit terminal" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Close Original label/ })).toBeNull();
  });

  it("opens first-run launcher setup with File Explorer selected", () => {
    renderPane();

    fireEvent.click(screen.getByRole("button", { name: "Open working directory" }));

    expect(screen.getByRole("dialog").textContent).toContain("Open working directory");
    expect(screen.getByRole("radio", { name: /File Explorer/ })).toHaveProperty("checked", true);
    expect(apiMocks.openLauncher).not.toHaveBeenCalled();
  });

  it("launches directly after a global default is configured", async () => {
    useAppStore.setState((state) => ({
      settings: { ...state.settings, defaultLauncherProfileId: explorerStatus.profile.id },
    }));
    renderPane();

    fireEvent.click(screen.getByRole("button", { name: "Open working directory in File Explorer" }));

    await waitFor(() => expect(apiMocks.openLauncher).toHaveBeenCalledWith({
      profileId: explorerStatus.profile.id,
      path: terminal.workingDirectory,
    }));
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
        onRenameTerminal={vi.fn()}
        terminalContextTargetId={null}
        onTerminalContextMenu={vi.fn()}
        onOpenLauncherSettings={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tablist", { name: "Terminal tabs" }), { clientX: 400, clientY: 40 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Pane" }));
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
        onRenameTerminal={vi.fn()}
        terminalContextTargetId={null}
        onTerminalContextMenu={vi.fn()}
        onOpenLauncherSettings={vi.fn()}
        onTabDragStart={vi.fn()}
        onTabDragEnd={vi.fn()}
        onTabDragOver={vi.fn()}
        onTabDrop={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("tablist", { name: "Terminal tabs" }), { clientX: 400, clientY: 40 });
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete Pane" }));
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
        onRenameTerminal={vi.fn()}
        terminalContextTargetId={null}
        onTerminalContextMenu={vi.fn()}
        onOpenLauncherSettings={vi.fn()}
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
        onRenameTerminal={vi.fn()}
        terminalContextTargetId={null}
        onTerminalContextMenu={vi.fn()}
        onOpenLauncherSettings={vi.fn()}
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

function renderPane(overrides: Partial<Parameters<typeof TerminalPane>[0]> = {}) {
  return render(
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
      onRenameTerminal={vi.fn()}
      terminalContextTargetId={null}
      onTerminalContextMenu={vi.fn()}
      onOpenLauncherSettings={vi.fn()}
      onTabDragStart={vi.fn()}
      onTabDragEnd={vi.fn()}
      onTabDragOver={vi.fn()}
      onTabDrop={vi.fn()}
      {...overrides}
    />,
  );
}
