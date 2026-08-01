import { describe, expect, it } from "vitest";
import { SHIFT_ENTER_SEQUENCE, terminalKeySequence } from "./terminalKeymap";

const keyEvent = (overrides: Partial<KeyboardEvent> = {}) => ({
  altKey: false,
  ctrlKey: false,
  key: "Enter",
  metaKey: false,
  shiftKey: true,
  type: "keydown",
  ...overrides,
}) as KeyboardEvent;

describe("terminal keymap", () => {
  it("encodes Shift+Enter independently of the terminal's startup profile", () => {
    expect(terminalKeySequence(keyEvent())).toBe(SHIFT_ENTER_SEQUENCE);
  });

  it("leaves ordinary Enter to xterm", () => {
    expect(terminalKeySequence(keyEvent({ shiftKey: false }))).toBeNull();
  });

  it("does not remap modified Shift+Enter chords or keyup", () => {
    expect(terminalKeySequence(keyEvent({ ctrlKey: true }))).toBeNull();
    expect(terminalKeySequence(keyEvent({ type: "keyup" }))).toBeNull();
  });
});
