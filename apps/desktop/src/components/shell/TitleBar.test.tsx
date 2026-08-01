// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
});
