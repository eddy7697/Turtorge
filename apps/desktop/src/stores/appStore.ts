import { create } from "zustand";
import * as api from "../lib/api";
import type {
  ApiError,
  AppSettings,
  ShellProfile,
  TerminalRuntimeSnapshot,
  TerminalStatus,
  Workspace,
  WslDistribution,
} from "../types";

interface AppStore {
  initialized: boolean;
  loading: boolean;
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  settings: AppSettings;
  windowsShells: ShellProfile[];
  wslDistributions: WslDistribution[];
  runtimes: Record<string, TerminalRuntimeSnapshot>;
  startRequests: Record<string, number>;
  pendingConnections: Record<string, number>;
  errors: Record<string, string>;
  sidebarCollapsed: boolean;
  suppressTerminalCloseConfirm: boolean;
  initialize: () => Promise<void>;
  selectWorkspace: (id: string) => Promise<void>;
  saveWorkspace: (workspace: Workspace) => Promise<Workspace>;
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
};

export const useAppStore = create<AppStore>((set, get) => ({
  initialized: false,
  loading: false,
  workspaces: [],
  activeWorkspaceId: null,
  settings: defaultSettings,
  windowsShells: [],
  wslDistributions: [],
  runtimes: {},
  startRequests: {},
  pendingConnections: {},
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
        windowsShells: payload.windowsShells,
        wslDistributions: payload.wslDistributions,
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
      delete runtimes[definitionId];
      return { runtimes };
    }),

  requestTerminalStart: (definitionId) =>
    set((state) => ({
      startRequests: {
        ...state.startRequests,
        [definitionId]: (state.startRequests[definitionId] ?? 0) + 1,
      },
    })),

  beginTerminalConnection: (definitionId) =>
    set((state) => ({
      pendingConnections: {
        ...state.pendingConnections,
        [definitionId]: (state.pendingConnections[definitionId] ?? 0) + 1,
      },
    })),

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
