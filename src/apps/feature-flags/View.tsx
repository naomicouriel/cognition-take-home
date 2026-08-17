import Link from "next/link";
import { db } from "@/platform/data";
import { asActor, requirePermission } from "@/platform/server";
import { FlagTable } from "./FlagTable";
import { formatDate } from "./format";
import { manifest } from "./manifest";
import {
  ENVIRONMENTS,
  STATES,
  flagFiltersSchema,
  stateOf,
  type FlagFilters,
} from "./schema";

export async function FeatureFlagsView({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await requirePermission(manifest.nav.permission);
  // A stale or hand-edited link should show an unfiltered list, not a 500.
  const filters: FlagFilters =
    flagFiltersSchema.safeParse({
      environment: first(searchParams?.environment),
      state: first(searchParams?.state),
    }).data ?? {};

  const flags = await asActor(actor, () =>
    db.featureFlag.findMany({
      where: {
        environment: filters.environment,
        enabled:
          filters.state === undefined ? undefined : filters.state === "enabled",
      },
      orderBy: [{ environment: "asc" }, { name: "asc" }],
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold">{manifest.name}</h1>
        <p className="text-sm text-slate-500">{manifest.description}</p>
      </div>

      <div className="flex flex-col gap-2">
        <FilterRow
          label="Environment"
          param="environment"
          values={ENVIRONMENTS}
          filters={filters}
        />
        <FilterRow label="State" param="state" values={STATES} filters={filters} />
      </div>

      <FlagTable
        path={manifest.nav.path}
        rows={flags.map((flag) => ({
          id: flag.id,
          key: flag.key,
          name: flag.name,
          description: flag.description,
          environment: flag.environment,
          state: stateOf(flag.enabled),
          lastModifiedBy: flag.lastModifiedBy,
          lastModifiedAt: formatDate(flag.lastModifiedAt),
        }))}
      />
    </div>
  );
}

function FilterRow({
  label,
  param,
  values,
  filters,
}: {
  label: string;
  param: keyof FlagFilters;
  values: readonly string[];
  filters: FlagFilters;
}) {
  const options: Array<{ value: string | undefined; label: string }> = [
    { value: undefined, label: "All" },
    ...values.map((value) => ({ value, label: value })),
  ];

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="w-24 text-slate-500">{label}</span>
      {options.map((option) => {
        const active = filters[param] === option.value;
        return (
          <Link
            key={option.label}
            href={hrefFor(filters, param, option.value)}
            className={`rounded border px-2 py-1 ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white hover:bg-slate-100"
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function hrefFor(
  filters: FlagFilters,
  param: keyof FlagFilters,
  value: string | undefined,
) {
  const next = new URLSearchParams();
  for (const [key, current] of Object.entries({ ...filters, [param]: value })) {
    if (current) next.set(key, current);
  }
  const query = next.toString();
  return query ? `${manifest.nav.path}?${query}` : manifest.nav.path;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
