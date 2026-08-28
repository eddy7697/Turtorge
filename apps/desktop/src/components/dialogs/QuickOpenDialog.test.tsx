// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShellProfile, Workspace } from "../../types";
import { QuickOpenDialog } from "./QuickOpenDialog";

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

function workspace(id: string, name: string, pinned: boolean, lastOpenedAt: string): Workspace {
  return {
    id,
    name,
    description: null,
    color: "#72d8c9",
    rootDirectory: { kind: "windows", value: `E:\\Projects\\${name}`, distribution: null },
    defaultShellProfile: shell,
    terminals: [],
    environmentVariables: [],
    layout: { type: "pane", id: `pane-${id}`, terminalIds: [], activeTerminalId: null },
    pinned,
    favorite: false,
    createdAt: "2026-08-01T00:00:00Z",
    updatedAt: "2026-08-01T00:00:00Z",
    lastOpenedAt,
    openCount: 0,
  };
}

describe("QuickOpenDialog", () => {
  afterEach(cleanup);

  it("keeps manual Pinned order while sorting Recent by last opened time", () => {
    const pinnedFirst = workspace("pinned-first", "Pinned first", true, "2026-08-01T00:00:00Z");
    const recentOlder = workspace("recent-older", "Recent older", false, "2026-08-10T00:00:00Z");
    const pinnedSecond = workspace("pinned-second", "Pinned second", true, "2026-08-25T00:00:00Z");
    const recentNewer = workspace("recent-newer", "Recent newer", false, "2026-08-20T00:00:00Z");
    render(
      <QuickOpenDialog
        workspaces={[pinnedFirst, recentOlder, pinnedSecond, recentNewer]}
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const names = Array.from(document.querySelectorAll(".quick-open-results strong"))
      .map((element) => element.textContent);
    expect(names).toEqual(["Pinned first", "Pinned second", "Recent newer", "Recent older"]);
  });
});
