import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuPoint {
  x: number;
  y: number;
}

export type ContextMenuEntry =
  | { type: "separator"; key: string }
  | {
      type: "item";
      key: string;
      label: string;
      icon?: ReactNode;
      hint?: string;
      danger?: boolean;
      disabled?: boolean;
      disabledReason?: string;
      onSelect: () => void;
    };

export function contextMenuPoint(event: ReactMouseEvent<HTMLElement>): ContextMenuPoint {
  if (event.clientX || event.clientY) return { x: event.clientX, y: event.clientY };
  const bounds = event.currentTarget.getBoundingClientRect();
  return { x: bounds.left + 12, y: bounds.top + Math.min(bounds.height, 28) };
}

export function ContextMenu({
  point,
  label,
  entries,
  onClose,
}: {
  point: ContextMenuPoint;
  label: string;
  entries: ContextMenuEntry[];
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [position, setPosition] = useState(point);

  const closeAndRestoreFocus = () => {
    onClose();
    queueMicrotask(() => {
      if (previousFocusRef.current?.isConnected) previousFocusRef.current.focus();
    });
  };

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const margin = 6;
    const bounds = menu.getBoundingClientRect();
    setPosition({
      x: Math.max(margin, Math.min(point.x, window.innerWidth - bounds.width - margin)),
      y: Math.max(margin, Math.min(point.y, window.innerHeight - bounds.height - margin)),
    });
  }, [point]);

  useEffect(() => {
    const menu = menuRef.current;
    const firstEnabled = menu?.querySelector<HTMLButtonElement>("button:not(:disabled)");
    firstEnabled?.focus();

    const close = (event: Event) => {
      if (menu?.contains(event.target as Node)) return;
      onClose();
    };
    const closeImmediately = () => onClose();
    document.addEventListener("pointerdown", close, true);
    window.addEventListener("blur", closeImmediately);
    window.addEventListener("resize", closeImmediately);
    window.addEventListener("scroll", closeImmediately, true);
    return () => {
      document.removeEventListener("pointerdown", close, true);
      window.removeEventListener("blur", closeImmediately);
      window.removeEventListener("resize", closeImmediately);
      window.removeEventListener("scroll", closeImmediately, true);
    };
  }, [onClose]);

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const buttons = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (event.key === "Escape") {
      event.preventDefault();
      closeAndRestoreFocus();
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && event.target instanceof HTMLButtonElement) {
      event.preventDefault();
      event.target.click();
      return;
    }
    if (!buttons.length || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? buttons.length - 1
        : event.key === "ArrowDown"
          ? (currentIndex + 1 + buttons.length) % buttons.length
          : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex]?.focus();
  };

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      role="menu"
      aria-label={label}
      style={{ left: position.x, top: position.y }}
      onKeyDown={moveFocus}
      onContextMenu={(event) => event.preventDefault()}
    >
      {entries.map((entry) => entry.type === "separator"
        ? <div key={entry.key} className="context-menu-separator" role="separator" />
        : (
          <button
            key={entry.key}
            type="button"
            role="menuitem"
            className={`context-menu-item ${entry.danger ? "danger" : ""}`}
            disabled={entry.disabled}
            title={entry.disabled ? entry.disabledReason : undefined}
            onClick={() => {
              if (entry.disabled) return;
              onClose();
              entry.onSelect();
            }}
          >
            <span className="context-menu-icon" aria-hidden="true">{entry.icon}</span>
            <span className="context-menu-label">{entry.label}</span>
            {(entry.hint || (entry.disabled && entry.disabledReason)) && (
              <span className="context-menu-hint">{entry.disabled ? entry.disabledReason : entry.hint}</span>
            )}
          </button>
        ))}
    </div>,
    document.body,
  );
}
