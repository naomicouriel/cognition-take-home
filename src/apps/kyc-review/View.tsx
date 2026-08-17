import Link from "next/link";
import { db } from "@/platform/data";
import { asActor, requirePermission } from "@/platform/server";
import { Can } from "@/platform/ui/Can";
import { DetailPanel } from "@/platform/ui/DetailPanel";
import { SchemaForm } from "@/platform/ui/SchemaForm";
import { fieldsFromSchema } from "@/platform/ui/fields";
import { decideCase } from "./actions";
import { DECIDE_PERMISSION, manifest } from "./manifest";
import { QueueTable } from "./QueueTable";
import {
  CASE_STATUSES,
  RISK_LEVELS,
  decisionSchema,
  queueFilterSchema,
  type QueueFilter,
} from "./schema";

export async function KycReviewView({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const actor = await requirePermission(manifest.nav.permission);
  // Unknown filter values in a stale or hand-edited link fall back to the
  // unfiltered queue rather than an error page.
  const parsed = queueFilterSchema.safeParse({
    status: single(searchParams?.status),
    riskLevel: single(searchParams?.riskLevel),
    caseId: single(searchParams?.caseId),
  });
  const filter: QueueFilter = parsed.success
    ? parsed.data
    : { caseId: single(searchParams?.caseId) };

  const { cases, selected } = await asActor(actor, async () => ({
    cases: await db.kycCase.findMany({
      where: {
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.riskLevel ? { riskLevel: filter.riskLevel } : {}),
      },
      include: { _count: { select: { documents: true } } },
      orderBy: { submittedAt: "asc" },
    }),
    selected: filter.caseId
      ? await db.kycCase.findUnique({
          where: { id: filter.caseId },
          include: { documents: { orderBy: { uploadedAt: "asc" } } },
        })
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="mb-1 text-xl font-semibold">{manifest.name}</h1>
        <p className="text-sm text-slate-500">
          {manifest.description} Customer name, document number and date of
          birth are declared PII and are removed server side for roles without
          the permission.
        </p>
      </header>

      <div className="flex flex-wrap gap-6">
        <FilterGroup label="Status" param="status" options={CASE_STATUSES} filter={filter} />
        <FilterGroup label="Risk" param="riskLevel" options={RISK_LEVELS} filter={filter} />
      </div>

      <QueueTable
        rows={queueOrder(cases).map((kycCase) => ({
          id: kycCase.id,
          reference: kycCase.reference,
          customer: pii(kycCase, "customerName"),
          country: kycCase.country,
          status: kycCase.status,
          riskLevel: kycCase.riskLevel,
          documents: kycCase._count.documents,
          submitted: kycCase.submittedAt.toISOString().slice(0, 10),
        }))}
      />

      {selected && (
        <div className="flex flex-col gap-4">
          <DetailPanel
            title={`${selected.reference} — ${pii(selected, "customerName")}`}
            subtitle={`${selected.status} · ${selected.riskLevel} risk`}
            actor={actor}
            fields={[
              { label: "Customer name (PII)", value: pii(selected, "customerName") },
              { label: "Document number (PII)", value: pii(selected, "documentNumber") },
              {
                label: "Date of birth (PII)",
                value:
                  "dateOfBirth" in selected && selected.dateOfBirth
                    ? selected.dateOfBirth.toISOString().slice(0, 10)
                    : RESTRICTED,
              },
              { label: "Country", value: selected.country },
              { label: "Risk level", value: selected.riskLevel },
              { label: "Risk notes", value: selected.riskNotes },
              {
                label: "Submitted",
                value: selected.submittedAt.toISOString().slice(0, 16),
              },
              {
                label: "Documents",
                value: (
                  <ul className="flex flex-col gap-1">
                    {selected.documents.map((document) => (
                      <li key={document.id}>
                        {DOCUMENT_LABELS[document.kind] ?? document.kind} —{" "}
                        <span className="text-slate-500">
                          {document.fileName} · issued by {document.issuer} ·
                          uploaded {document.uploadedAt.toISOString().slice(0, 10)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ),
              },
              {
                label: "Decision",
                value:
                  selected.status === "pending"
                    ? "Awaiting review"
                    : `${selected.status} by ${selected.decidedByEmail ?? "—"} — ${
                        selected.decisionNote ?? ""
                      }`,
              },
            ]}
          />

          <Can
            actor={actor}
            permission={DECIDE_PERMISSION}
            fallback={
              <p className="text-sm text-slate-500">
                Your role can read the queue but not decide cases.
              </p>
            }
          >
            {selected.status === "pending" ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">Record a decision</h3>
                <SchemaForm
                  // Remount per case so notes typed for one case cannot be
                  // submitted against the next one.
                  key={selected.id}
                  fields={fieldsFromSchema(decisionSchema)}
                  action={decideCase.bind(null, selected.id)}
                  submitLabel="Submit decision"
                />
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                This case is already {selected.status}; decisions are final and
                recorded in the audit log.
              </p>
            )}
          </Can>
        </div>
      )}
    </div>
  );
}

const RESTRICTED = "restricted";

const DOCUMENT_LABELS: Record<string, string> = {
  passport: "Passport",
  national_id: "National ID",
  proof_of_address: "Proof of address",
  selfie: "Liveness selfie",
  source_of_funds: "Source of funds",
};

/** PII columns are absent, not null, when the platform gates them. */
function pii<T extends object>(row: T, field: string): string {
  const value = (row as Record<string, unknown>)[field];
  if (!(field in row) || value === null || value === undefined) return RESTRICTED;
  return String(value);
}

/**
 * Work first: `status` is a string column, so the database can only order it
 * alphabetically ("approved" before "pending"). Rank it here instead, keeping
 * the oldest-first order inside each group.
 */
function queueOrder<T extends { status: string }>(rows: T[]): T[] {
  const rank = (status: string) => (status === "pending" ? 0 : 1);
  return [...rows].sort((a, b) => rank(a.status) - rank(b.status));
}

function single(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value;
  return first && first.length > 0 ? first : undefined;
}

function FilterGroup({
  label,
  param,
  options,
  filter,
}: {
  label: string;
  param: "status" | "riskLevel";
  options: readonly string[];
  filter: { status?: string; riskLevel?: string };
}) {
  const href = (value?: string) => {
    const params = new URLSearchParams();
    const next = { ...filter, [param]: value };
    if (next.status) params.set("status", next.status);
    if (next.riskLevel) params.set("riskLevel", next.riskLevel);
    const query = params.toString();
    return query ? `${manifest.nav.path}?${query}` : manifest.nav.path;
  };

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-500">{label}:</span>
      {[undefined, ...options].map((option) => {
        const active = (filter[param] ?? undefined) === option;
        return (
          <Link
            key={option ?? "all"}
            href={href(option)}
            className={`rounded border px-2 py-1 ${
              active
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 bg-white hover:bg-slate-100"
            }`}
          >
            {option ?? "all"}
          </Link>
        );
      })}
    </div>
  );
}
