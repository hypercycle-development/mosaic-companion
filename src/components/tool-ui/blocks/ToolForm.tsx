import React, { useState } from "react";
import type { FormBlock } from "../types";
import type { ToolUIActionHandler } from "../ToolUIRenderer";

export const ToolForm: React.FC<FormBlock & { onAction?: ToolUIActionHandler }> = ({ id, submitLabel = "Submit", submitAction, fields, onAction }) => {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) {
      if (f.defaultValue !== undefined) init[f.key] = f.defaultValue;
      else if (f.type === "checkbox") init[f.key] = false;
      else if (f.type === "multiselect") init[f.key] = [];
      else init[f.key] = "";
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const args = { ...submitAction.args, ...values };
      if (onAction) {
        await onAction(submitAction, args);
      } else {
        const fullToolName = `${submitAction.server}:${submitAction.tool}`;
        await (window as any).electronAPI?.tools?.execute?.(fullToolName, args);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const set = (key: string, val: unknown) => setValues((prev) => ({ ...prev, [key]: val }));

  return (
    <form id={id} onSubmit={handleSubmit} className="rounded-lg border border-gray-700 bg-gray-800/40 p-3 flex flex-col gap-3">
      {fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-400">
            {f.label}{f.required && <span className="text-red-400 ml-0.5">*</span>}
          </span>

          {(f.type === "text" || f.type === "date") && (
            <input
              type={f.type}
              placeholder={f.placeholder}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
              className="px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-600"
            />
          )}

          {f.type === "number" && (
            <input
              type="number"
              placeholder={f.placeholder}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.valueAsNumber)}
              min={f.min}
              max={f.max}
              step={f.step}
              required={f.required}
              className="px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-600"
            />
          )}

          {f.type === "textarea" && (
            <textarea
              placeholder={f.placeholder}
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
              rows={3}
              className="px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-blue-600 resize-y"
            />
          )}

          {f.type === "select" && (
            <select
              value={String(values[f.key] ?? "")}
              onChange={(e) => set(f.key, e.target.value)}
              required={f.required}
              className="px-2 py-1.5 rounded bg-gray-900 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-600"
            >
              <option value="">{f.placeholder ?? "Select..."}</option>
              {f.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {f.type === "checkbox" && (
            <input
              type="checkbox"
              checked={Boolean(values[f.key])}
              onChange={(e) => set(f.key, e.target.checked)}
              className="w-4 h-4 rounded border-gray-700 bg-gray-900"
            />
          )}

          {f.type === "slider" && (
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={f.min ?? 0}
                max={f.max ?? 100}
                step={f.step ?? 1}
                value={Number(values[f.key] ?? f.min ?? 0)}
                onChange={(e) => set(f.key, e.target.valueAsNumber)}
                className="flex-1"
              />
              <span className="text-xs text-gray-400 w-10 text-right">{String(values[f.key])}</span>
            </div>
          )}
        </label>
      ))}

      <button
        type="submit"
        disabled={submitting}
        className="self-start px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
      >
        {submitting ? "Running..." : submitLabel}
      </button>
    </form>
  );
};
