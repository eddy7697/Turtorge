// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContextMenu } from "./ContextMenu";

describe("ContextMenu", () => {
  afterEach(cleanup);

  it("focuses enabled actions and supports arrow-key selection", () => {
    const first = vi.fn();
    const second = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        point={{ x: 20, y: 30 }}
        label="Test actions"
        onClose={onClose}
        entries={[
          { type: "item", key: "disabled", label: "Disabled", disabled: true, disabledReason: "Unavailable", onSelect: vi.fn() },
          { type: "item", key: "first", label: "First", onSelect: first },
          { type: "separator", key: "separator" },
          { type: "item", key: "second", label: "Second", onSelect: second },
        ]}
      />,
    );

    const menu = screen.getByRole("menu", { name: "Test actions" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "First" }));
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Second" }));
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });

    expect(second).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes with Escape and restores the previous focus", async () => {
    const onClose = vi.fn();
    const previous = document.createElement("button");
    document.body.append(previous);
    previous.focus();
    render(<ContextMenu point={{ x: 0, y: 0 }} label="Test actions" onClose={onClose} entries={[{ type: "item", key: "item", label: "Item", onSelect: vi.fn() }]} />);

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledOnce();
    await waitFor(() => expect(document.activeElement).toBe(previous));
    previous.remove();
  });
});
