import { can, type Actor } from "@/platform/rbac";

export type DetailField = { label: string; value: React.ReactNode };

/**
 * Detail panel with an approval action. The action button is hidden when the
 * actor lacks the permission, and the server action re-checks it anyway.
 */
export function DetailPanel({
  title,
  subtitle,
  fields,
  actor,
  approval,
}: {
  title: string;
  subtitle?: string;
  fields: DetailField[];
  actor: Actor;
  approval?: {
    permission: string;
    label: string;
    action: (formData: FormData) => void | Promise<void>;
    hiddenFields?: Record<string, string>;
    disabled?: boolean;
  };
}) {
  return (
    <section className="rounded border border-slate-200 bg-white p-4">
      <header className="mb-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </header>
      <dl className="grid grid-cols-[10rem_1fr] gap-y-2 text-sm">
        {fields.map((field) => (
          <div key={field.label} className="contents">
            <dt className="text-slate-500">{field.label}</dt>
            <dd>{field.value}</dd>
          </div>
        ))}
      </dl>
      {approval && can(actor, approval.permission) && (
        <form action={approval.action} className="mt-4">
          {Object.entries(approval.hiddenFields ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          <button
            type="submit"
            disabled={approval.disabled}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {approval.label}
          </button>
        </form>
      )}
    </section>
  );
}
