import { useLayoutEffect, useRef } from "react";

type SlotListener = (slot: HTMLDivElement) => void;

const slots = new Map<string, HTMLDivElement>();
const listeners = new Map<string, Set<SlotListener>>();

export function terminalMountKey(
  workspaceId: string,
  paneId: string,
  terminalId: string,
): string {
  return JSON.stringify([workspaceId, paneId, terminalId]);
}

export function PersistentTerminalSlot({ mountKey }: { mountKey: string }) {
  const slotRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    slots.set(mountKey, slot);
    for (const listener of listeners.get(mountKey) ?? []) listener(slot);

    return () => {
      if (slots.get(mountKey) === slot) slots.delete(mountKey);
    };
  }, [mountKey]);

  return (
    <div
      ref={slotRef}
      className="persistent-terminal-slot"
      data-terminal-slot={mountKey}
    />
  );
}

export function subscribeToTerminalSlot(
  mountKey: string,
  listener: SlotListener,
): () => void {
  const mountListeners = listeners.get(mountKey) ?? new Set<SlotListener>();
  mountListeners.add(listener);
  listeners.set(mountKey, mountListeners);
  const slot = slots.get(mountKey);
  if (slot) listener(slot);

  return () => {
    mountListeners.delete(listener);
    if (mountListeners.size === 0) listeners.delete(mountKey);
  };
}
