import Link from "./link";
import { useMemo, useState, useCallback } from "react";
import type { ScreenState } from "../lib/screen-state";
import { parseScreenState } from "../lib/screen-state";

export type { ScreenState };
export { parseScreenState };

export type ConfidenceLevel = "high" | "medium" | "low";

export function PageTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-6 space-y-2">
      <h1 className="pt-title text-3xl">{title}</h1>
      {subtitle ? <p className="pt-muted max-w-3xl text-sm leading-6">{subtitle}</p> : null}
    </header>
  );
}

export function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-card p-5">
      <header className="mb-3 space-y-1">
        <h2 className="pt-title text-base">{title}</h2>
        {subtitle ? <p className="pt-muted text-xs leading-5">{subtitle}</p> : null}
      </header>
      {children}
    </section>
  );
}

export function CoverageStatusBar({
  freshness,
  quality,
  gapNote,
}: {
  freshness: string;
  quality: "high" | "medium" | "partial";
  gapNote?: string;
}) {
  const palette =
    quality === "high"
      ? "bg-emerald-100 text-emerald-800"
    : quality === "medium"
        ? "bg-[var(--warning-soft)] text-slate-950"
        : "bg-rose-100 text-rose-800";

  return (
    <div className="pt-panel mb-4 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="font-medium text-slate-700">Data freshness:</span>
      <span className="text-slate-950">{freshness}</span>
      <span className={`rounded-full px-2 py-0.5 font-semibold ${palette}`}>
        Coverage: {quality}
      </span>
      {gapNote ? <span className="pt-muted">Gap note: {gapNote}</span> : null}
    </div>
  );
}

export function MethodTag({ label }: { label: string }) {
  return (
    <span className="pt-badge text-slate-700">
      {label}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: ConfidenceLevel }) {
  const style =
    level === "high"
      ? "bg-emerald-100 text-emerald-800"
      : level === "medium"
        ? "bg-[var(--warning-soft)] text-slate-950"
        : "bg-rose-100 text-rose-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${style}`}>
      {level.toUpperCase()} confidence
    </span>
  );
}

export function ClaimCard({
  claim,
  level,
  evidenceCount,
  nonClaim,
  sourceLinks,
}: {
  claim: string;
  level: ConfidenceLevel;
  evidenceCount: number;
  nonClaim: string;
  sourceLinks: { label: string; href: string }[];
}) {
  return (
    <article className="pt-panel space-y-3 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <ConfidenceBadge level={level} />
        <span className="pt-muted text-xs">{evidenceCount} linked sources</span>
      </div>
      <p className="text-sm font-semibold text-slate-950">{claim}</p>
      <UncertaintyNote label="What this does not prove" note={nonClaim} />
      <EvidenceTrailDrawer sources={sourceLinks} />
    </article>
  );
}

export function EvidenceTrailDrawer({
  sources,
}: {
  sources: { label: string; href: string }[];
}) {
  return (
    <details className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
      <summary className="cursor-pointer text-xs font-semibold text-slate-700">
        Open evidence trail
      </summary>
      <ul className="mt-2 space-y-1">
        {sources.map((source) => (
          <li key={`${source.label}-${source.href}`}>
            <SourceDocLink label={source.label} href={source.href} />
          </li>
        ))}
      </ul>
    </details>
  );
}

export function CausalityWarningBlock() {
  return (
    <div className="rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] p-3 text-xs text-slate-950">
      This panel shows public-record links. It does not, by itself, explain why an outcome happened.
    </div>
  );
}

export function UncertaintyNote({ label, note }: { label: string; note: string }) {
  return (
    <p className="pt-muted text-xs">
      <span className="font-semibold text-slate-700">{label}:</span> {note}
    </p>
  );
}

export function SourceDocLink({ label, href }: { label: string; href: string }) {
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="pt-link text-xs"
      >
        {label}
      </a>
    );
  }

  return (
    <Link className="pt-link text-xs" href={href}>
      {label}
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  delta,
  period,
}: {
  label: string;
  value: string;
  delta: string;
  period: string;
  quality?: "high" | "medium" | "partial";
}) {
  const isMoney = /^[-(]?\$/.test(value);
  const direction = /^(\+|▲|up\b|gain)/i.test(delta)
    ? "up"
    : /^(-|▼|down\b|loss)/i.test(delta)
      ? "down"
      : undefined;
  return (
    <div className="pt-card p-4">
      <div className="metric">
        <span className="label">{label}</span>
        <span className="value" data-kind={isMoney ? "money" : undefined}>
          {value}
        </span>
        <span className={direction ? `delta ${direction}` : "delta"}>
          {delta} <span className="muted">({period})</span>
        </span>
      </div>
    </div>
  );
}

export function FundingSourceBreakdown({
  title = "Funding sources",
  sources,
}: {
  title?: string;
  sources: Array<{ label: string; value: number | undefined; detail?: string }>;
}) {
  const normalized = sources.map((source) => ({
    ...source,
    value: Number.isFinite(source.value) ? Math.max(source.value ?? 0, 0) : 0,
  }));
  const total = normalized.reduce((sum, source) => sum + source.value, 0);
  const visibleSources = normalized.filter((source) => source.value > 0);

  if (!visibleSources.length) return null;

  return (
    <div className="pt-panel space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="pt-title text-sm">{title}</h3>
        <p className="pt-muted text-xs">Total classified: {formatCurrency(total)}</p>
      </div>
      <div className="flex h-4 overflow-hidden rounded-sm border border-[var(--line)] bg-white">
        {visibleSources.map((source, index) => {
          const pct = total > 0 ? (source.value / total) * 100 : 0;
          const colors = [
            "bg-[var(--civic)]",
            "bg-[var(--accent)]",
            "bg-[var(--warning)]",
            "bg-[var(--danger)]",
            "bg-[var(--success)]",
          ];
          return (
            <div
              key={source.label}
              className={colors[index % colors.length]}
              style={{ width: `${Math.max(pct, 2)}%` }}
              title={`${source.label}: ${formatCurrency(source.value)} (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>
      <dl className="grid gap-2 md:grid-cols-2">
        {visibleSources.map((source) => {
          const pct = total > 0 ? (source.value / total) * 100 : 0;
          return (
            <div key={source.label} className="rounded-md border border-[var(--line)] bg-white px-3 py-2">
              <dt className="text-xs font-semibold text-slate-700">{source.label}</dt>
              <dd className="mt-1 text-sm font-semibold text-slate-950">
                {formatCurrency(source.value)}
                <span className="pt-muted ml-2 text-xs font-normal">{pct.toFixed(1)}%</span>
              </dd>
              {source.detail ? <dd className="pt-muted mt-1 text-xs">{source.detail}</dd> : null}
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

import type { VoteSegment } from "@/lib/vote-segments";
export type { VoteSegment };
export { buildVoteSegments } from "@/lib/vote-segments";

const STATE_CARTOGRAM: Record<string, { col: number; row: number }> = {
  AK: { col: 1, row: 7 },
  HI: { col: 2, row: 8 },
  WA: { col: 2, row: 1 },
  OR: { col: 2, row: 2 },
  CA: { col: 2, row: 4 },
  ID: { col: 3, row: 2 },
  NV: { col: 3, row: 3 },
  AZ: { col: 4, row: 5 },
  MT: { col: 4, row: 1 },
  WY: { col: 4, row: 2 },
  UT: { col: 4, row: 4 },
  CO: { col: 5, row: 4 },
  NM: { col: 5, row: 5 },
  ND: { col: 5, row: 1 },
  SD: { col: 5, row: 2 },
  NE: { col: 5, row: 3 },
  KS: { col: 6, row: 4 },
  OK: { col: 6, row: 5 },
  TX: { col: 6, row: 6 },
  MN: { col: 6, row: 1 },
  IA: { col: 6, row: 3 },
  MO: { col: 7, row: 4 },
  AR: { col: 7, row: 5 },
  LA: { col: 7, row: 6 },
  WI: { col: 7, row: 2 },
  IL: { col: 7, row: 3 },
  MI: { col: 8, row: 2 },
  IN: { col: 8, row: 3 },
  KY: { col: 8, row: 4 },
  TN: { col: 8, row: 5 },
  MS: { col: 8, row: 6 },
  AL: { col: 9, row: 6 },
  OH: { col: 9, row: 3 },
  WV: { col: 9, row: 4 },
  GA: { col: 10, row: 6 },
  FL: { col: 11, row: 7 },
  PA: { col: 10, row: 3 },
  VA: { col: 10, row: 4 },
  NC: { col: 10, row: 5 },
  SC: { col: 10, row: 6 },
  NY: { col: 11, row: 2 },
  VT: { col: 12, row: 1 },
  NH: { col: 13, row: 1 },
  ME: { col: 14, row: 1 },
  MA: { col: 13, row: 2 },
  RI: { col: 14, row: 3 },
  CT: { col: 13, row: 3 },
  NJ: { col: 12, row: 4 },
  DE: { col: 13, row: 5 },
  MD: { col: 12, row: 5 },
};

/** Stacked horizontal bar showing vote split (Yea/Nay/Not Voting/Present). */
export function VoteBreakdownBar({
  title,
  segments,
}: {
  title?: string;
  segments: VoteSegment[];
}) {
  const total = segments.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      {title ? <h3 className="text-sm font-semibold text-slate-800">{title}</h3> : null}
      <div className="flex h-7 overflow-hidden rounded-md">
        {segments.map((seg) => {
          const pct = (seg.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={seg.label}
              className={`${seg.color} flex items-center justify-center text-[10px] font-bold leading-none text-white`}
              style={{ width: `${pct}%`, minWidth: pct > 0 ? "1.5rem" : 0 }}
              title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
            >
              {pct >= 8 ? seg.count : null}
            </div>
          );
        })}
      </div>
      <div className="pt-muted flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {segments.map((seg) => (
          <span key={seg.label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${seg.color}`} />
            {seg.label}: {seg.count}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Party-split horizontal bars: one bar per party showing their vote breakdown. */
export function PartySplitBars({
  title,
  parties,
}: {
  title?: string;
  parties: { party: string; segments: VoteSegment[] }[];
}) {
  return (
    <div className="space-y-3">
      {title ? <h3 className="text-sm font-semibold text-slate-800">{title}</h3> : null}
      {parties.map((p) => {
        const total = p.segments.reduce((s, seg) => s + seg.count, 0);
        return (
          <div key={p.party} className="space-y-1">
            <p className="text-xs font-semibold text-slate-700">
              {p.party} <span className="font-normal text-slate-500">({total})</span>
            </p>
            <VoteBreakdownBar segments={p.segments} />
          </div>
        );
      })}
    </div>
  );
}

/** Small inline badge showing the vote cast with a color dot. */
export function VoteCastBadge({ voteCast }: { voteCast: string }) {
  const dot =
    voteCast === "Yea" || voteCast === "Aye" || voteCast === "Yes"
      ? "bg-emerald-500"
      : voteCast === "Nay" || voteCast === "No"
        ? "bg-rose-500"
        : voteCast === "Not Voting"
          ? "bg-stone-400"
          : "bg-amber-500";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
      {voteCast}
    </span>
  );
}

export function TrendChart({
  title,
  points,
}: {
  title: string;
  points: { label: string; value: number }[];
}) {
  const max = Math.max(...points.map((p) => p.value), 1);
  return (
    <div className="pt-card space-y-2 p-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <ul className="space-y-2">
        {points.map((point) => (
          <li key={`${title}-${point.label}`} className="text-xs">
            <div className="mb-1 flex justify-between text-slate-600">
              <span>{point.label}</span>
              <span>{point.value}</span>
            </div>
            <div className="h-2 rounded-sm bg-slate-100">
              <div
                className="h-2 rounded-sm bg-[var(--accent)]"
                style={{ width: `${Math.max((point.value / max) * 100, 6)}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StateValueMap({
  title,
  metricLabel,
  items,
  metrics,
}: {
  title: string;
  metricLabel: string;
  items: { code: string; value?: number; href?: string }[];
  metrics?: Array<{
    key: string;
    label: string;
    metricLabel: string;
    items: { code: string; value?: number; href?: string }[];
  }>;
}) {
  const [activeMetricKey, setActiveMetricKey] = useState(metrics?.[0]?.key ?? "default");
  const activeMetric = metrics?.find((metric) => metric.key === activeMetricKey);
  const activeItems = activeMetric?.items ?? items;
  const activeMetricLabel = activeMetric?.metricLabel ?? metricLabel;
  const validValues = activeItems
    .map((item) => item.value)
    .filter((value): value is number => Number.isFinite(value));
  const min = validValues.length ? Math.min(...validValues) : 0;
  const max = validValues.length ? Math.max(...validValues) : 1;
  const span = Math.max(max - min, 1);

  function tone(value: number | undefined): string {
    if (value === undefined) return "usmap-cell";
    const ratio = (value - min) / span;
    if (ratio > 0.66) return "usmap-cell hot";
    if (ratio > 0.33) return "usmap-cell warm";
    return "usmap-cell";
  }

  return (
    <section className="pt-card space-y-3 p-3">
      <header className="space-y-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="pt-muted text-xs">
          Metric: {activeMetricLabel}. Darker cells indicate higher values.
        </p>
      </header>
      {metrics?.length ? (
        <div className="flex flex-wrap gap-2">
          {metrics.map((metric) => {
            const active = metric.key === activeMetricKey;
            return (
              <button
                key={metric.key}
                type="button"
                onClick={() => setActiveMetricKey(metric.key)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-[var(--civic)] bg-[var(--civic)] text-white"
                    : "border-[var(--line)] bg-white text-slate-700 hover:bg-[var(--surface-soft)]"
                }`}
              >
                {metric.label}
              </button>
            );
          })}
        </div>
      ) : null}
      <div className="overflow-x-auto pb-1">
        <div
          className="grid min-w-[760px] gap-2"
          style={{
            gridTemplateColumns: "repeat(14, minmax(2.75rem, 1fr))",
            gridTemplateRows: "repeat(8, minmax(2rem, auto))",
          }}
        >
        {activeItems
          .filter((item) => STATE_CARTOGRAM[item.code])
          .map((item) => {
          const position = STATE_CARTOGRAM[item.code];
          const cell = (
            <div
              className={tone(item.value)}
              style={{
                gridColumn: position.col,
                gridRow: position.row,
              }}
              title={
                item.value === undefined
                  ? `${item.code}: no data`
                  : `${item.code}: ${item.value.toFixed(1)}`
              }
            >
              {item.code}
            </div>
          );

          if (!item.href) {
            return (
              <div
                key={item.code}
                style={{
                  gridColumn: position.col,
                  gridRow: position.row,
                }}
              >
                {cell}
              </div>
            );
          }

          return (
            <Link
              key={item.code}
              href={item.href}
              className="block"
              style={{
                gridColumn: position.col,
                gridRow: position.row,
              }}
            >
              {cell}
            </Link>
          );
        })}
        </div>
      </div>
    </section>
  );
}

export function TimelineRail({
  events,
}: {
  events: { date: string; title: string; detail: string }[];
}) {
  return (
    <ol className="space-y-3 border-l-2 border-[var(--line)] pl-4">
      {events.map((event) => (
        <li key={`${event.date}-${event.title}`} className="relative">
          <span className="absolute -left-[23px] top-1 h-2 w-2 rounded-full bg-[var(--accent)]" />
          <p className="text-xs text-slate-500">{event.date}</p>
          <p className="text-sm font-medium text-slate-900">{event.title}</p>
          <p className="text-xs text-slate-600">{event.detail}</p>
        </li>
      ))}
    </ol>
  );
}

export function CompareStrip({
  items,
}: {
  items: { label: string; left: string; right: string; diff: string }[];
}) {
  return (
    <div className="pt-table overflow-hidden">
      <table className="w-full text-left text-xs">
        <thead className="pt-table-head">
          <tr>
            <th className="px-3 py-2">Metric</th>
            <th className="px-3 py-2">Entity A</th>
            <th className="px-3 py-2">Entity B</th>
            <th className="px-3 py-2">Variance</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.label} className="border-t border-[var(--line)] bg-white">
              <td className="px-3 py-2 font-medium text-slate-800">{item.label}</td>
              <td className="px-3 py-2 text-slate-700">{item.left}</td>
              <td className="px-3 py-2 text-slate-700">{item.right}</td>
              <td className="px-3 py-2 text-slate-700">{item.diff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const DEFAULT_PAGE_SIZE = 25;

function cellSortValue(cell: TableCellValue): string {
  if (Array.isArray(cell)) {
    return cell.map((c) => (typeof c === "string" ? c : c.label)).join(", ");
  }
  if (typeof cell === "string") return cell;
  return cell.label;
}

export function TableExplorer({
  columns,
  rows,
  pageSize = DEFAULT_PAGE_SIZE,
  emptyState,
}: {
  columns: string[];
  rows: TableCellValue[][];
  pageSize?: number;
  emptyState?: string;
}) {
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = useCallback(
    (colIdx: number) => {
      if (columns[colIdx] === "") return; // don't sort action columns
      if (sortCol === colIdx) {
        setSortAsc((prev) => !prev);
      } else {
        setSortCol(colIdx);
        setSortAsc(true);
      }
      setPage(0);
    },
    [sortCol, columns],
  );

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows;
    return [...rows].sort((a, b) => {
      const aVal = cellSortValue(a[sortCol] ?? "");
      const bVal = cellSortValue(b[sortCol] ?? "");
      // Try numeric comparison first
      const aNum = Number(aVal.replace(/[$,%]/g, ""));
      const bNum = Number(bVal.replace(/[$,%]/g, ""));
      if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
        return sortAsc ? aNum - bNum : bNum - aNum;
      }
      const cmp = aVal.localeCompare(bVal, undefined, { sensitivity: "base" });
      return sortAsc ? cmp : -cmp;
    });
  }, [rows, sortCol, sortAsc]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pagedRows = sortedRows.slice(page * pageSize, (page + 1) * pageSize);

  function renderTableCell(cell: TableCell, key: string) {
    if (typeof cell === "string") {
      if (cell.startsWith("/")) {
        return (
          <Link
            key={key}
            href={cell}
            className="pt-button-primary inline-flex items-center gap-1 px-3 py-1 text-[11px]"
          >
            View <span aria-hidden="true">&rarr;</span>
          </Link>
        );
      }
      if (cell.startsWith("http://") || cell.startsWith("https://")) {
        return (
          <a
            key={key}
            href={cell}
            target="_blank"
            rel="noopener noreferrer"
            className="pt-link"
          >
            {cell}
          </a>
        );
      }
      return <span key={key}>{cell}</span>;
    }

    const isExternal = cell.external ?? (cell.href.startsWith("http://") || cell.href.startsWith("https://"));
    if (isExternal) {
      return (
        <a
          key={key}
          href={cell.href}
          target="_blank"
          rel="noopener noreferrer"
          className="pt-link"
        >
          {cell.label}
        </a>
      );
    }
    return (
      <Link
        key={key}
        href={cell.href}
        className="pt-link"
      >
        {cell.label}
      </Link>
    );
  }

  function renderTableCellValue(cell: TableCellValue, rowIdx: number, cellIdx: number) {
    if (Array.isArray(cell)) {
      return cell.map((item, idx) => (
        <span key={`row-${rowIdx}-cell-${cellIdx}-item-${idx}`}>
          {idx > 0 ? ", " : null}
          {renderTableCell(item, `row-${rowIdx}-cell-${cellIdx}-item-link-${idx}`)}
        </span>
      ));
    }
    return renderTableCell(cell, `row-${rowIdx}-cell-${cellIdx}`);
  }

  function isNumericCell(cell: TableCellValue): boolean {
    const s = typeof cell === "string"
      ? cell
      : Array.isArray(cell)
        ? ""
        : typeof cell.label === "string" ? cell.label : "";
    if (!s) return false;
    return /^[-(]?[$%]?\s?[\d,]+(\.\d+)?[%)kKmMbB]?$/.test(s.trim());
  }

  return (
    <div className="space-y-2">
      <div
        className="overflow-x-auto"
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--r-lg)",
          background: "var(--paper)",
        }}
      >
        <table className="t min-w-full">
          <thead>
            <tr>
              {columns.map((column, colIdx) => {
                const isAction = column === "";
                const isSorted = sortCol === colIdx;
                return (
                  <th
                    key={`col-${colIdx}`}
                    style={{
                      cursor: isAction ? "default" : "pointer",
                      userSelect: "none",
                      position: isAction ? "sticky" : undefined,
                      right: isAction ? 0 : undefined,
                      background: isAction ? "var(--paper-2)" : undefined,
                      width: isAction ? "1%" : undefined,
                      whiteSpace: isAction ? "nowrap" : undefined,
                    }}
                    onClick={isAction ? undefined : () => handleSort(colIdx)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {column}
                      {isSorted ? (
                        <span className="text-[10px]">{sortAsc ? "\u25B2" : "\u25BC"}</span>
                      ) : column ? (
                        <span className="text-[10px] text-slate-400">{"\u25B4"}</span>
                      ) : null}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pagedRows.length ? (
              pagedRows.map((row, idx) => (
                <tr key={`row-${page * pageSize + idx}`}>
                  {row.map((cell, cellIdx) => {
                    const isAction = columns[cellIdx] === "";
                    const isNumeric = isNumericCell(cell);
                    const className = isNumeric ? "num" : isAction ? undefined : "name";
                    return (
                      <td
                        key={`row-${page * pageSize + idx}-cell-${cellIdx}`}
                        className={className}
                        style={
                          isAction
                            ? {
                                position: "sticky",
                                right: 0,
                                background: "var(--paper)",
                                whiteSpace: "nowrap",
                              }
                            : undefined
                        }
                      >
                        {renderTableCellValue(cell, page * pageSize + idx, cellIdx)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ textAlign: "center", color: "var(--ink-3)", padding: "24px 12px" }}
                >
                  {emptyState ?? "No data available."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {totalPages > 1 ? (
        <div className="pt-muted flex items-center justify-between text-xs">
          <span>
            {sortedRows.length.toLocaleString()} row{sortedRows.length === 1 ? "" : "s"} · page {page + 1} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(0)}
              className="rounded-md px-2 py-1 hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >
              First
            </button>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md px-2 py-1 hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >
              Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md px-2 py-1 hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >
              Next
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(totalPages - 1)}
              className="rounded-md px-2 py-1 hover:bg-[var(--surface-soft)] disabled:opacity-40"
            >
              Last
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export type TableCellLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type TableCell = string | TableCellLink;
export type TableCellValue = TableCell | TableCell[];

export function EntityRelationshipGraph({
  nodes,
  edges,
}: {
  nodes: string[];
  edges: { from: string; to: string; type: string }[];
}) {
  const edgesByNode = useMemo(() => {
    const map = new Map<string, { to: string; type: string }[]>();
    for (const edge of edges) {
      const existing = map.get(edge.from) ?? [];
      existing.push({ to: edge.to, type: edge.type });
      map.set(edge.from, existing);
    }
    return map;
  }, [edges]);

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {nodes.map((node) => (
        <div key={node} className="pt-card p-3">
          <p className="text-sm font-semibold text-slate-900">{node}</p>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {(edgesByNode.get(node) ?? []).map((edge) => (
              <li key={`${node}-${edge.to}-${edge.type}`}>
                {edge.type} → {edge.to}
              </li>
            ))}
            {!(edgesByNode.get(node) ?? []).length ? <li>No direct outgoing links</li> : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function FilterChips({ chips }: { chips: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip}
            className="pt-badge px-2 py-1 text-xs text-slate-700"
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

export function UtilityRail() {
  // Placeholder — buttons will be wired when share/export features ship.
  return null;
}

export function StateVariantBlock({ state }: { state: ScreenState }) {
  const blocks: Record<ScreenState, { title: string; text: string; tone: string }> = {
    loading: {
      title: "Loading state",
      text: "The page is loading data and showing skeleton placeholders.",
      tone: "bg-slate-100 text-slate-800 border-slate-200",
    },
    "empty-no-results": {
      title: "No results",
      text: "No entities matched your query. Try broader terms or remove filters.",
      tone: "bg-blue-50 text-blue-900 border-blue-200",
    },
    "empty-no-data": {
      title: "No data in selected range",
      text: "Entity exists, but no coverage appears for the selected timeframe.",
      tone: "bg-violet-50 text-violet-900 border-violet-200",
    },
    "partial-coverage": {
      title: "Partial coverage",
      text: "Some metrics are missing. Gap labels identify unavailable or blocked fields.",
      tone: "bg-amber-50 text-amber-900 border-amber-200",
    },
    "stale-data": {
      title: "Stale data warning",
      text: "This view is older than the freshness threshold.",
      tone: "bg-amber-50 text-amber-900 border-amber-200",
    },
    "source-conflict": {
      title: "Source conflict",
      text: "Two linked sources disagree. Both are displayed with conflict notes.",
      tone: "bg-rose-50 text-rose-900 border-rose-200",
    },
    "recoverable-error": {
      title: "Recoverable error",
      text: "A transient load issue occurred. Retry should restore this panel.",
      tone: "bg-orange-50 text-orange-900 border-orange-200",
    },
    "blocking-error": {
      title: "Blocking error",
      text: "Critical load failure. Use fallback raw-source links while incident is unresolved.",
      tone: "bg-red-50 text-red-900 border-red-200",
    },
  };
  const block = blocks[state];
  return (
    <div className={`rounded-md border p-4 text-sm ${block.tone}`}>
      <p className="font-semibold">{block.title}</p>
      <p className="mt-1">{block.text}</p>
    </div>
  );
}
