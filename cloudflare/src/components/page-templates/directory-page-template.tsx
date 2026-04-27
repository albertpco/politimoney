import type { ReactNode } from "react";
import { PageScaffold } from "./page-scaffold";

type DirectoryColumn = {
  header: string;
  align?: "left" | "right";
};

type DirectoryCell = ReactNode;

export function DirectoryPageTemplate({
  title,
  subtitle,
  columns,
  rows,
  emptyState = "No records available.",
  actions,
  sidebar,
  eyebrow,
  rowKeyPrefix = "row",
}: {
  title: string;
  subtitle?: string;
  columns: DirectoryColumn[];
  rows: DirectoryCell[][];
  emptyState?: ReactNode;
  actions?: ReactNode;
  sidebar?: ReactNode;
  eyebrow?: string;
  rowKeyPrefix?: string;
}) {
  return (
    <PageScaffold title={title} subtitle={subtitle} sidebar={sidebar} eyebrow={eyebrow}>
      {actions ? <div>{actions}</div> : null}
      <section className="pt-table overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="pt-table-head">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.header}
                    className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] ${column.align === "right" ? "text-right" : "text-left"}`}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((row, rowIndex) => (
                  <tr key={`${rowKeyPrefix}-${rowIndex}`} className="border-t border-[var(--line)] hover:bg-[var(--surface-soft)]">
                    {row.map((cell, cellIndex) => (
                      <td
                        key={`${rowKeyPrefix}-${rowIndex}-${cellIndex}`}
                        className={`px-4 py-3 align-top text-slate-700 ${columns[cellIndex]?.align === "right" ? "text-right" : "text-left"}`}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="pt-muted px-4 py-6" colSpan={columns.length}>
                    {emptyState}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PageScaffold>
  );
}
