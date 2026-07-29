import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { useEffect, useRef, useState } from "react";
import { useResolvedTheme } from "../../app/ThemeProvider";
import { attachTerminal, detachTerminal, resizeTerminal, startTerminal, writeTerminal, writeTerminalDefinition } from "../../lib/api";
import { useAppStore } from "../../stores/appStore";
import type { TerminalDefinition, TerminalEvent, Workspace } from "../../types";

const terminalThemes = {
  dark: {
    background: "#061014",
    foreground: "#d8e7e8",
    cursor: "#72d8c9",
    cursorAccent: "#061014",
    selectionBackground: "#27564f99",
    black: "#071014",
    red: "#ef7d84",
    green: "#6fd6a4",
    yellow: "#e7b866",
    blue: "#79b8e8",
    magenta: "#b99be2",
    cyan: "#72d8c9",
    white: "#d8e7e8",
  },
  light: {
    background: "#0b171b",
    foreground: "#d8e7e8",
    cursor: "#80f0e0",
    cursorAccent: "#0b171b",
    selectionBackground: "#2d686099",
    black: "#071014",
    red: "#ef7d84",
    green: "#6fd6a4",
    yellow: "#e7b866",
    blue: "#79b8e8",
    magenta: "#b99be2",
    cyan: "#72d8c9",
    white: "#d8e7e8",
  },
} as const;

export function XtermView({ workspace, definition, activate, connectionGeneration }: { workspace: Workspace; definition: TerminalDefinition; activate: boolean; connectionGeneration: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const resizeTimer = useRef<number | null>(null);
  const startingRef = useRef(false);
  const runtimeIdRef = useRef<string | null>(null);
  const pendingInputRef = useRef<Uint8Array[]>([]);
  const [ready, setReady] = useState(false);
  const theme = useResolvedTheme();
  const runtime = useAppStore((state) => state.runtimes[definition.id]);
  const setRuntime = useAppStore((state) => state.setRuntime);
  const setRuntimeStatus = useAppStore((state) => state.setRuntimeStatus);
  const setTerminalError = useAppStore((state) => state.setTerminalError);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const terminal = new Terminal({
      allowProposedApi: false,
      cursorBlink: true,
      cursorStyle: "bar",
      fontFamily: 'ui-monospace, "Cascadia Mono", "Consolas", monospace',
      fontSize: 13,
      lineHeight: 1.28,
      scrollback: 5000,
      theme: terminalThemes[theme],
      convertEol: false,
    });
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(container);
    terminalRef.current = terminal;
    fitRef.current = fit;
    requestAnimationFrame(() => {
      fit.fit();
      setReady(true);
    });

    const inputDisposable = terminal.onData((data) => {
      const lineCount = data.split(/\r\n|\r|\n/).length;
      if (lineCount > 1 && !window.confirm(`Paste ${lineCount} lines into ${definition.name}?\n\nReview multi-line commands before executing them.`)) return;
      const current = useAppStore.getState().runtimes[definition.id];
      const bytes = new TextEncoder().encode(data);
      const runtimeId = current?.id ?? runtimeIdRef.current;
      if (runtimeId) void writeTerminal(runtimeId, bytes);
      else {
        void writeTerminalDefinition(definition.id, bytes).catch(() => {
          const connectedRuntimeId = runtimeIdRef.current;
          if (connectedRuntimeId) void writeTerminal(connectedRuntimeId, bytes);
          else pendingInputRef.current.push(bytes);
        });
      }
    });
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      const current = useAppStore.getState().runtimes[definition.id];
      if (!current) return;
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
      resizeTimer.current = window.setTimeout(() => void resizeTerminal(current.id, cols, rows), 40);
    });
    const observer = new ResizeObserver(() => {
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
      resizeTimer.current = window.setTimeout(() => fit.fit(), 40);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      inputDisposable.dispose();
      resizeDisposable.dispose();
      terminal.dispose();
      terminalRef.current = null;
      fitRef.current = null;
      if (resizeTimer.current) window.clearTimeout(resizeTimer.current);
    };
    // Terminal instances intentionally survive theme changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [definition.id]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.options.theme = terminalThemes[theme];
  }, [theme]);

  useEffect(() => {
    if (!ready || !activate || startingRef.current) return;
    let disposed = false;
    let attachedRuntimeId = runtime?.id;
    runtimeIdRef.current = runtime?.id ?? null;
    const onEvent = (event: TerminalEvent) => {
      if (disposed) return;
      if (event.event === "output" || event.event === "snapshot") {
        terminalRef.current?.write(new Uint8Array(event.data));
      } else if (event.event === "status") {
        setRuntimeStatus(definition.id, event.data);
      } else if (event.event === "exited") {
        setRuntimeStatus(definition.id, "exited", event.data.exitCode);
        terminalRef.current?.write(`\r\n\u001b[90mProcess exited with code ${event.data.exitCode}.\u001b[0m\r\n`);
      } else if (event.event === "error") {
        setTerminalError(definition.id, event.data.message);
      }
    };

    startingRef.current = true;
    const connect = runtime
      ? attachTerminal(runtime.id, onEvent)
      : startTerminal(
          {
            workspaceId: workspace.id,
            definition,
            workspaceEnvironment: workspace.environmentVariables,
            cols: terminalRef.current?.cols ?? 80,
            rows: terminalRef.current?.rows ?? 24,
          },
          onEvent,
        );
    void connect
      .then((snapshot) => {
        if (disposed) return;
        attachedRuntimeId = snapshot.id;
        runtimeIdRef.current = snapshot.id;
        if (runtime && snapshot.scrollback.length > 0) {
          terminalRef.current?.write(new Uint8Array(snapshot.scrollback));
        }
        setRuntime(snapshot);
        const pendingInput = pendingInputRef.current.splice(0);
        for (const bytes of pendingInput) void writeTerminal(snapshot.id, bytes);
        void resizeTerminal(snapshot.id, terminalRef.current?.cols ?? snapshot.cols, terminalRef.current?.rows ?? snapshot.rows);
        terminalRef.current?.focus();
      })
      .catch((error) => !disposed && setTerminalError(definition.id, String(error?.message ?? error)))
      .finally(() => {
        startingRef.current = false;
      });

    return () => {
      disposed = true;
      if (attachedRuntimeId) void detachTerminal(attachedRuntimeId);
    };
  }, [activate, connectionGeneration, definition, ready, setRuntime, setRuntimeStatus, setTerminalError, workspace.environmentVariables, workspace.id]);

  return <div className="xterm-host" ref={containerRef} aria-label={`${definition.name} terminal`} />;
}
