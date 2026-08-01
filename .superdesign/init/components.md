# Shared UI primitives

## `apps/desktop/src/components/ui/Modal.tsx`

Portal-backed dialog primitive used by terminal, workspace, settings, and confirmation flows.

~~~tsx
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  width?: "small" | "medium" | "large";
}

export function Modal({ title, description, children, footer, onClose, width = "medium" }: ModalProps) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`modal modal-${width}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog" title="Close">
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>,
    document.body,
  );
}
~~~

## `apps/desktop/src/components/ui/EnvironmentEditor.tsx`

Reusable environment-variable key/value editor with plaintext-secret warnings.

~~~tsx
import { Plus, Trash2 } from "lucide-react";
import type { EnvironmentVariable } from "../../types";

const secretPattern = /(token|secret|password|passwd|api[_-]?key|private[_-]?key)/i;

export function EnvironmentEditor({
  value,
  onChange,
}: {
  value: EnvironmentVariable[];
  onChange: (value: EnvironmentVariable[]) => void;
}) {
  const update = (index: number, key: "key" | "value", next: string) => {
    onChange(value.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: next } : item)));
  };

  return (
    <div className="environment-editor">
      {value.map((item, index) => (
        <div className="environment-row" key={index}>
          <input aria-label={`Environment variable ${index + 1} name`} placeholder="NAME" value={item.key} onChange={(event) => update(index, "key", event.target.value)} />
          <input aria-label={`Environment variable ${index + 1} value`} placeholder="Value" value={item.value} onChange={(event) => update(index, "value", event.target.value)} />
          <button type="button" className="icon-button danger-subtle" aria-label="Remove variable" onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}>
            <Trash2 size={14} />
          </button>
          {secretPattern.test(item.key) && <p className="field-warning">This value is stored as plain text. Do not store secrets here.</p>}
        </div>
      ))}
      <button type="button" className="text-button" onClick={() => onChange([...value, { key: "", value: "" }])}>
        <Plus size={14} /> Add variable
      </button>
    </div>
  );
}
~~~
