// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import macosConfig from "../../../src-tauri/tauri.macos.conf.json";
import { TitleBar } from "./TitleBar";

describe("TitleBar", () => {
  afterEach(cleanup);

  it("makes the empty action area draggable without marking its buttons", () => {
    const { container } = render(
      <TitleBar
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onQuickOpen={vi.fn()}
        onNewTerminal={vi.fn()}
        onSettings={vi.fn()}
        onRequestQuit={vi.fn()}
      />,
    );

    const actionArea = container.querySelector(".title-bar-actions");
    const newTerminalButton = screen.getByRole("button", { name: "New terminal" });

    expect(actionArea?.hasAttribute("data-tauri-drag-region")).toBe(true);
    expect(newTerminalButton.hasAttribute("data-tauri-drag-region")).toBe(false);
  });

  it("uses Command shortcuts and native window controls on macOS", () => {
    const { container } = render(
      <TitleBar
        platform="macos"
        sidebarCollapsed={false}
        onToggleSidebar={vi.fn()}
        onQuickOpen={vi.fn()}
        onNewTerminal={vi.fn()}
        onSettings={vi.fn()}
        onRequestQuit={vi.fn()}
      />,
    );

    expect(screen.getByText("⌘ P")).toBeTruthy();
    expect(container.querySelector(".window-controls")).toBeNull();
    expect(screen.getByRole("button", { name: "New terminal" }).getAttribute("title")).toContain("⌘");
  });

  it("centers the native traffic lights in the 40px custom title bar", () => {
    const mainWindow = macosConfig.app.windows.find((window) => window.label === "main");

    expect(mainWindow?.trafficLightPosition).toEqual({ x: 14, y: 18 });
  });
});
