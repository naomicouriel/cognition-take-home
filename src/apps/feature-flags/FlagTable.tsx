"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/platform/ui/DataTable";

export type FlagRow = {
  id: string;
  key: string;
  name: string;
  description: string;
  environment: string;
  state: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
};

export function FlagTable({ rows, path }: { rows: FlagRow[]; path: string }) {
  const router = useRouter();
  return (
    <DataTable
      rows={rows}
      onSelect={(row) => router.push(`${path}/${row.id}`)}
      emptyMessage="No flags match these filters."
      columns={[
        { key: "name", label: "Name" },
        { key: "description", label: "Description" },
        { key: "environment", label: "Environment" },
        { key: "state", label: "State" },
        { key: "lastModifiedBy", label: "Last modified by" },
        { key: "lastModifiedAt", label: "Modified" },
      ]}
    />
  );
}
