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

