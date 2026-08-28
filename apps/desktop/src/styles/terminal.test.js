import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync(new URL("./terminal.css", import.meta.url), "utf8");

describe("terminal platform spacing", () => {
  it("keeps terminal padding outside xterm on Windows", () => {
    expect(styles).toMatch(/\.xterm-host\s*\{[^}]*padding:\s*8px 9px 6px;/s);
    expect(styles).toMatch(/\.xterm-host \.xterm\s*\{[^}]*height:\s*100%;\s*\}/s);
  });

  it("keeps the FitAddon-aware padding on macOS only", () => {
    expect(styles).toMatch(/\.platform-macos \.xterm-host\s*\{[^}]*padding:\s*0;/s);
    expect(styles).toMatch(/\.platform-macos \.xterm-host \.xterm\s*\{[^}]*padding:\s*8px 9px 6px;/s);
  });

  it("keeps a hidden drag source rendered during workspace hover preview", () => {
    expect(styles).toMatch(/\.workspace-terminal-layer\.inactive\.drag-source\s*\{[^}]*visibility:\s*visible;[^}]*opacity:\s*0;[^}]*pointer-events:\s*none;/s);
  });

  it("gives persistent terminal slots a stable full-surface mount target", () => {
    expect(styles).toMatch(/\.persistent-terminal-slot\s*\{[^}]*position:\s*absolute;[^}]*inset:\s*0;/s);
  });
});
