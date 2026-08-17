import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/platform/data";
import { asActor, requirePermission } from "@/platform/server";
import { DataTable } from "@/platform/ui/DataTable";
import { DetailPanel } from "@/platform/ui/DetailPanel";
import { toggleFlag } from "./actions";
import { formatDate } from "./format";
import { manifest, TOGGLE_PERMISSION } from "./manifest";
import { stateOf } from "./schema";

export async function FeatureFlagDetailView({ id }: { id: string }) {
  const actor = await requirePermission(manifest.nav.permission);

  const { flag, history } = await asActor(actor, async () => ({
    flag: await db.featureFlag.findUnique({ where: { id } }),
    history: await db.auditLog.findMany({
      where: { resource: "FeatureFlag", resourceId: id },
      orderBy: { at: "desc" },
      take: 10,
    }),
  }));

  if (!flag) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link href={manifest.nav.path} className="text-sm text-slate-500 underline">
        ← All flags
      </Link>

      <DetailPanel
        title={flag.name}
        subtitle={flag.description}
        actor={actor}
        fields={[
          { label: "Key", value: <code>{flag.key}</code> },
          { label: "Environment", value: flag.environment },
          { label: "State", value: stateOf(flag.enabled) },
          { label: "Owner", value: flag.owner },
          { label: "Last modified by", value: flag.lastModifiedBy },
          { label: "Last modified at", value: formatDate(flag.lastModifiedAt) },
          { label: "Created", value: formatDate(flag.createdAt) },
        ]}
        approval={{
          permission: TOGGLE_PERMISSION,
          label: flag.enabled ? "Disable flag" : "Enable flag",
          action: toggleFlag,
          hiddenFields: { id: flag.id, enabled: String(!flag.enabled) },
        }}
      />

      <div>
        <h2 className="mb-2 text-lg font-semibold">Change history</h2>
        <DataTable
          emptyMessage="No changes recorded yet."
          rows={history.map((entry) => ({
            id: entry.id,
            at: formatDate(entry.at),
            actor: entry.actorEmail,
            action: entry.action,
            change: describe(entry.before, entry.after),
          }))}
          columns={[
            { key: "at", label: "When" },
            { key: "actor", label: "Actor" },
            { key: "action", label: "Action" },
            { key: "change", label: "Change" },
          ]}
        />
      </div>
    </div>
  );
}

/** Render the audited before/after snapshot as a state transition. */
function describe(before: unknown, after: unknown) {
  const from = enabledOf(before);
  const to = enabledOf(after);
  if (from === undefined && to === undefined) return "—";
  if (from === undefined) return `created ${stateOf(Boolean(to))}`;
  return `${stateOf(Boolean(from))} → ${stateOf(Boolean(to))}`;
}

function enabledOf(snapshot: unknown): boolean | undefined {
  if (snapshot && typeof snapshot === "object" && "enabled" in snapshot) {
    const value = (snapshot as { enabled: unknown }).enabled;
    if (typeof value === "boolean") return value;
  }
  return undefined;
}
