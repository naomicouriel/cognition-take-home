"use client";

import { useFormStatus } from "react-dom";

export type FormField = {
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  required: boolean;
  options?: string[];
};

/** Schema driven form: fields come from the zod schema, not hand written JSX. */
export function SchemaForm({
  fields,
  action,
  submitLabel = "Save",
  error,
}: {
  fields: FormField[];
  action: (formData: FormData) => void | Promise<void>;
  submitLabel?: string;
  error?: string;
}) {
  return (
    <form action={action} className="flex max-w-md flex-col gap-3">
      {fields.map((field) => (
        <label key={field.name} className="flex flex-col gap-1 text-sm">
          <span className="font-medium">
            {field.label}
            {field.required && <span className="text-red-500"> *</span>}
          </span>
          {field.type === "select" ? (
            <select
              name={field.name}
              required={field.required}
              className="rounded border border-slate-300 px-2 py-1"
            >
              {(field.options ?? []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : field.type === "textarea" ? (
            <textarea
              name={field.name}
              required={field.required}
              className="rounded border border-slate-300 px-2 py-1"
            />
          ) : (
            <input
              name={field.name}
              type={field.type}
              required={field.required}
              className="rounded border border-slate-300 px-2 py-1"
            />
          )}
        </label>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <SubmitButton label={submitLabel} />
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Working…" : label}
    </button>
  );
}
