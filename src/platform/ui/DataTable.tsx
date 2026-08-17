"use client";

import { useMemo, useState } from "react";

export type Column<T> = {
  key: keyof T & string;
  label: string;
  render?: (row: T) => React.ReactNode;
};

export function DataTable<T extends { id: string }>({
  rows,
  columns,
  onSelect,
  emptyMessage = "Nothing here yet.",
}: {
  rows: T[];
  columns: Column<T>[];
  onSelect?: (row: T) => void;
  emptyMessage?: string;
}) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) =>
        String(row[column.key] ?? "")
          .toLowerCase()
          .includes(needle),
      ),
    );
  }, [rows, columns, filter]);

  return (
    <div className="rounded border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <input
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder="Filter…"
          className="w-64 rounded border border-slate-300 px-2 py-1 text-sm"
        />
      </div>
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect?.(row)}
              className={`border-t border-slate-100 ${
                onSelect ? "cursor-pointer hover:bg-slate-50" : ""
              }`}
            >
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-2">
                  {column.render
                    ? column.render(row)
                    : formatCell(row[column.key])}
                </td>
              ))}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td
                className="px-3 py-6 text-center text-slate-500"
                colSpan={columns.length}
              >
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}
