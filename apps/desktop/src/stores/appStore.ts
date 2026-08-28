import { create } from "zustand";
import * as api from "../lib/api";
import { createId } from "../lib/ids";
import { findPaneForTerminal, insertTerminalAfter } from "../lib/layout";
import type {
  ApiError,
  AppSettings,
  DesktopPlatform,
  LauncherProfileStatus,
  ShellProfile,
  TerminalRuntimeSnapshot,
  TerminalStatus,
  TerminalDefinition,
  Workspace,
  WorkspaceMoveTerminalRequest,
  WorkspaceMoveTerminalResult,
  WslDistribution,
} from "../types";

interface AppStore {
  initialized: boolean;
  loading: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  settings: AppSettings;
  platform: DesktopPlatform;
  windowsShells: ShellProfile[];
  nativeShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  launcherProfiles: LauncherProfileStatus[];
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  startRequests: Record<string, number>;
  pendingStarts: Record<string, boolean>;
  pendingConnections: Record<string, number>;
  workspaceMovePending: boolean;
  errors: Record<string, string>;
  sidebarCollapsed: boolean;
  suppressTerminalCloseConfirm: boolean;
  initialize: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  saveWorkspace: (workspace: Workspace) => Promise<Workspace>;
  reorderPinnedWorkspaces: (sourceId: string, targetIndex: number) => Promise<void>;
  moveTerminalToWorkspace: (request: WorkspaceMoveTerminalRequest) => Promise<WorkspaceMoveTerminalResult>;
  duplicateTerminal: (workspaceId: string, terminalId: string) => Promise<TerminalDefinition>;
  deleteWorkspace: (id: string) => Promise<void>;
  updateSettings: (settings: AppSettings) => Promise<void>;
  setRuntime: (runtime: TerminalRuntimeSnapshot) => void;
  setRuntimeStatus: (definitionId: string, status: TerminalStatus, exitCode?: number) => void;
  setTerminalError: (definitionId: string, message: string) => void;
  removeRuntime: (definitionId: string) => void;
  requestTerminalStart: (definitionId: string) => void;
  beginTerminalConnection: (definitionId: string) => void;
  endTerminalConnection: (definitionId: string) => void;
  suppressCloseConfirmForSession: () => void;
  toggleSidebar: () => void;
}

const defaultSettings: AppSettings = {
  theme: "system",
  openLastWorkspace: true,
  confirmBeforeClose: true,
  sidebarWidth: 236,
  lastActiveWorkspaceId: null,
  defaultLauncherProfileId: null,
  launcherProfiles: [],
};

export const useAppStore = create<AppStore>((set, get) => ({
  initialized: false,
  loading: false,
  workspaces: [],
  activeWorkspaceId: null,
  settings: defaultSettings,
  platform: "windows",
  windowsShells: [],
  nativeShells: [],
  wslDistributions: [],
  launcherProfiles: [],
  runtimes: {},
  startRequests: {},
  pendingStarts: {},
  pendingConnections: {},
  workspaceMovePending: false,
  errors: {},
  sidebarCollapsed: false,
  suppressTerminalCloseConfirm: false,

  initialize: async () => {
    if (get().loading || get().initialized) return;
    set({ loading: true });
    try {
      const [payload, runtimes] = await Promise.all([api.bootstrap(), api.listRuntimes()]);
      const runtimeMap = Object.fromEntries(
        runtimes.map((runtime) => [runtime.definitionId, runtime]),
      );
      const requestedActive = payload.settings.openLastWorkspace
        ? payload.settings.lastActiveWorkspaceId
        : null;
      const activeWorkspaceId = payload.workspaces.some(
        (workspace) => workspace.id === requestedActive,
      )
        ? requestedActive ?? null
        : payload.workspaces[0]?.id ?? null;
      set({
        initialized: true,
        loading: false,
        workspaces: payload.workspaces,
        settings: payload.settings,
        platform: payload.platform,
        windowsShells: payload.windowsShells,
        nativeShells: payload.nativeShells,
        wslDistributions: payload.wslDistributions,
        launcherProfiles: payload.launcherProfiles,
        activeWorkspaceId,
        runtimes: runtimeMap,
      });
    } catch (error) {
      set({ loading: false, initialized: true, errors: { app: messageFromError(error) } });
    }
  },

  selectWorkspace: async (id) => {
    set({ activeWorkspaceId: id });
    try {
      const opened = await api.openWorkspace(id);
      set((state) => ({
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === opened.id ? opened : workspace,
        ),
        settings: { ...state.settings, lastActiveWorkspaceId: opened.id },
      }));
    } catch (error) {
      set((state) => ({ errors: { ...state.errors, workspace: messageFromError(error) } }));
    }
  },

  saveWorkspace: async (workspace) => {
    if (get().workspaceMovePending) {
      throw new Error("Wait for the current terminal move to finish before changing a workspace.");
    }
    const saved = await api.saveWorkspace(workspace);
    set((state) => {
      const exists = state.workspaces.some((item) => item.id === saved.id);
      return {
        workspaces: exists
          ? state.workspaces.map((item) => (item.id === saved.id ? saved : item))
          : [...state.workspaces, saved],
        activeWorkspaceId: state.activeWorkspaceId ?? saved.id,
      };
    });
    return saved;
  },

  reorderPinnedWorkspaces: async (sourceId, targetIndex) => {
    const current = get().workspaces;
    const source = current.find((workspace) => workspace.id === sourceId);
    if (!source?.pinned) throw new Error("Pinned workspace not found.");

    const pinned = current.filter((workspace) => workspace.pinned);
    const remaining = pinned.filter((workspace) => workspace.id !== sourceId);
    const boundedTargetIndex = Number.isFinite(targetIndex)
      ? Math.min(Math.max(Math.trunc(targetIndex), 0), remaining.length)
      : remaining.length;
    remaining.splice(boundedTargetIndex, 0, source);

    let pinnedIndex = 0;
    const next = current.map((workspace) => (
      workspace.pinned ? remaining[pinnedIndex++] : workspace
    ));
    if (next.every((workspace, index) => workspace.id === current[index]?.id)) return;

    const saved = await api.reorderWorkspaces(next.map((workspace) => workspace.id));
    set({ workspaces: saved });
  },

  moveTerminalToWorkspace: async (request) => {
    if (get().workspaceMovePending) {
      throw new Error("Another terminal move is already in progress.");
    }
    set({ workspaceMovePending: true });
    try {
      const result = await api.moveTerminalToWorkspace(request);
      set((state) => ({
        workspaces: state.workspaces.map((workspace) => {
          if (workspace.id === result.sourceWorkspace.id) return result.sourceWorkspace;
          if (workspace.id === result.targetWorkspace.id) return result.targetWorkspace;
          return workspace;
        }),
        activeWorkspaceId: result.targetWorkspace.id,
        settings: {
          ...state.settings,
          lastActiveWorkspaceId: result.targetWorkspace.id,
        },
        runtimes: result.runtime
          ? { ...state.runtimes, [result.runtime.definitionId]: result.runtime }
          : state.runtimes,
      }));
      return result;
    } finally {
      set({ workspaceMovePending: false });
    }
  },

  duplicateTerminal: async (workspaceId, terminalId) => {
    const workspace = get().workspaces.find((item) => item.id === workspaceId);
    const source = workspace?.terminals.find((terminal) => terminal.id === terminalId);
    if (!workspace || !source) throw new Error("Terminal not found.");
    if (!findPaneForTerminal(workspace.layout, terminalId)) {
      throw new Error("Terminal is not assigned to a pane.");
    }

    const duplicate: TerminalDefinition = {
      ...source,
      id: createId("terminal"),
      name: nextTerminalCopyName(source.name, workspace.terminals.map((terminal) => terminal.name)),
      shellProfile: { ...source.shellProfile },
      workingDirectory: { ...source.workingDirectory },
      environmentVariables: source.environmentVariables.map((variable) => ({ ...variable })),
    };
    const sourceIndex = workspace.terminals.findIndex((terminal) => terminal.id === terminalId);
    const terminals = [...workspace.terminals];
    terminals.splice(sourceIndex + 1, 0, duplicate);

    await get().saveWorkspace({
      ...workspace,
      terminals,
      layout: insertTerminalAfter(workspace.layout, terminalId, duplicate.id),
      updatedAt: new Date().toISOString(),
    });
    if (get().activeWorkspaceId !== workspaceId) await get().selectWorkspace(workspaceId);
    get().requestTerminalStart(duplicate.id);
    return duplicate;
  },

  deleteWorkspace: async (id) => {
    await api.deleteWorkspace(id);
    set((state) => {
      const workspaces = state.workspaces.filter((workspace) => workspace.id !== id);
      return {
        workspaces,
        activeWorkspaceId:
          state.activeWorkspaceId === id ? workspaces[0]?.id ?? null : state.activeWorkspaceId,
      };
    });
  },

  updateSettings: async (settings) => {
    const saved = await api.updateSettings(settings);
    set({ settings: saved });
    try {
      const launcherProfiles = await api.listLauncherProfiles();
      set({ launcherProfiles });
    } catch {
      // The settings were persisted successfully; keep the last detection snapshot until restart.
    }
  },

  setRuntime: (runtime) =>
    set((state) => ({
      runtimes: { ...state.runtimes, [runtime.definitionId]: runtime },
      errors: { ...state.errors, [runtime.definitionId]: "" },
    })),

  setRuntimeStatus: (definitionId, status, exitCode) =>
    set((state) => {
      const runtime = state.runtimes[definitionId];
      if (!runtime) return state;
      return {
        runtimes: {
          ...state.runtimes,
          [definitionId]: { ...runtime, status, exitCode: exitCode ?? runtime.exitCode },
        },
      };
    }),

  setTerminalError: (definitionId, message) =>
    set((state) => ({
      errors: { ...state.errors, [definitionId]: message },
      runtimes: state.runtimes[definitionId]
        ? {
            ...state.runtimes,
            [definitionId]: { ...state.runtimes[definitionId], status: "failed" },
          }
        : state.runtimes,
    })),

  removeRuntime: (definitionId) =>
    set((state) => {
      const runtimes = { ...state.runtimes };
      const pendingStarts = { ...state.pendingStarts };
      delete runtimes[definitionId];
      delete pendingStarts[definitionId];
      return { runtimes, pendingStarts };
    }),

  requestTerminalStart: (definitionId) =>
    set((state) => ({
      startRequests: {
        ...state.startRequests,
        [definitionId]: (state.startRequests[definitionId] ?? 0) + 1,
      },
      pendingStarts: {
        ...state.pendingStarts,
        [definitionId]: true,
      },
    })),

  beginTerminalConnection: (definitionId) =>
    set((state) => {
      const pendingStarts = { ...state.pendingStarts };
      delete pendingStarts[definitionId];
      return {
        pendingStarts,
        pendingConnections: {
        ...state.pendingConnections,
        [definitionId]: (state.pendingConnections[definitionId] ?? 0) + 1,
        },
      };
    }),

  endTerminalConnection: (definitionId) =>
    set((state) => {
      const pendingConnections = { ...state.pendingConnections };
      const remaining = (pendingConnections[definitionId] ?? 1) - 1;
      if (remaining > 0) pendingConnections[definitionId] = remaining;
      else delete pendingConnections[definitionId];
      return { pendingConnections };
    }),

  suppressCloseConfirmForSession: () => set({ suppressTerminalCloseConfirm: true }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));

export const selectActiveWorkspace = (state: AppStore): Workspace | undefined =>
  state.workspaces.find((workspace) => workspace.id === state.activeWorkspaceId);

function messageFromError(error: unknown): string {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as ApiError).message);
  }
  return error instanceof Error ? error.message : String(error);
}

function nextTerminalCopyName(sourceName: string, existingNames: string[]): string {
  const baseName = sourceName.replace(/ Copy(?: \d+)?$/i, "").trimEnd();
  const usedNames = new Set(existingNames.map((name) => name.toLocaleLowerCase()));
  for (let copyNumber = 1; ; copyNumber += 1) {
    const suffix = copyNumber === 1 ? " Copy" : ` Copy ${copyNumber}`;
    const candidate = `${baseName.slice(0, 80 - suffix.length).trimEnd()}${suffix}`;
    if (!usedNames.has(candidate.toLocaleLowerCase())) return candidate;
  }
}
