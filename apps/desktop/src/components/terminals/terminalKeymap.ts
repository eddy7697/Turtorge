export const SHIFT_ENTER_SEQUENCE = "\u001b[13;2u";

type TerminalKeyEvent = Pick<KeyboardEvent, "altKey" | "ctrlKey" | "key" | "metaKey" | "shiftKey" | "type">;

export function terminalKeySequence(event: TerminalKeyEvent): string | null {
  if (
    event.type === "keydown"
    && event.key === "Enter"
    && event.shiftKey
    && !event.altKey
    && !event.ctrlKey
    && !event.metaKey
  ) {
    return SHIFT_ENTER_SEQUENCE;
  }
  return null;
}
