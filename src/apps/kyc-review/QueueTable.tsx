"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { DataTable } from "@/platform/ui/DataTable";

export type QueueRow = {
  id: string;
  reference: string;
  customer: string;
  country: string;
  status: string;
  riskLevel: string;
  documents: number;
  submitted: string;
};

/**
 * Selection wrapper around the platform DataTable: it takes a row callback,
 * which a server component cannot pass, so the app supplies it here.
 */
export function QueueTable({ rows }: { rows: QueueRow[] }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <DataTable
      rows={rows}
      emptyMessage="No cases match these filters."
      onSelect={(row) => {
        const next = new URLSearchParams(params.toString());
        next.set("caseId", row.id);
        router.push(`/apps/kyc-review?${next.toString()}`);
      }}
      columns={[
        { key: "reference", label: "Case" },
        { key: "customer", label: "Customer (PII)" },
        { key: "country", label: "Country" },
        { key: "riskLevel", label: "Risk" },
        { key: "status", label: "Status" },
        { key: "documents", label: "Docs" },
        { key: "submitted", label: "Submitted" },
      ]}
    />
  );
}
