import type { ReactNode } from "react";

/**
 * Design primitives for the PolitiMoney design system.
 * See politired/project/design_handoff_politimoney/README.md.
 */

export function Kicker({ children }: { children: ReactNode }) {
  return <div className="kicker">{children}</div>;
}

type PillVariant = "default" | "civic" | "source" | "money" | "good" | "warn" | "solid" | "dashed";

export function Pill({
  variant = "default",
  children,
}: {
  variant?: PillVariant;
  children: ReactNode;
}) {
  const cls = variant === "default" ? "pill" : `pill ${variant}`;
  return <span className={cls}>{children}</span>;
}

export function MoneyValue({
  value,
  className,
}: {
  value: string | number;
  className?: string;
}) {
  const text = typeof value === "number" ? formatMoney(value) : value;
  return (
    <span
      className={`money${className ? ` ${className}` : ""}`}
      style={{
        fontFamily: "var(--font-jetbrains-mono)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {text}
    </span>
  );
}

function formatMoney(n: number): string {
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

export function Metric({
  label,
  value,
  delta,
  kind,
}: {
  label: string;
  value: ReactNode;
  delta?: { text: string; direction?: "up" | "down" };
  kind?: "money";
}) {
  return (
    <div className={kind === "money" ? "metric money" : "metric"}>
      <div className="label">{label}</div>
      <div className="value" data-kind={kind}>{value}</div>
      {delta && (
        <div className={`delta${delta.direction ? ` ${delta.direction}` : ""}`}>
          {delta.text}
        </div>
      )}
    </div>
  );
}

/**
 * Sketchy hand-font callout in --money. Hidden when [data-annotations="off"]
 * is set on <html>. Uses inline positioning when needed.
 */
export function Annotation({
  children,
  side = "left",
  style,
}: {
  children: ReactNode;
  side?: "left" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <span className={side === "right" ? "annot right" : "annot"} style={style}>
      {children}
    </span>
  );
}

export function Caveat({ children }: { children: ReactNode }) {
  return (
    <div className="caveat">
      <span className="badge">*</span>
      <div>{children}</div>
    </div>
  );
}

/**
 * Rank-card: small "top N" list with a serif title, optional "more →" link,
 * and dashed-divider rows. Use on homepage / hub layouts.
 */
type RankCardRow = {
  label: ReactNode;
  value: ReactNode;
  href?: string;
};

export function RankCard({
  title,
  more,
  rows,
}: {
  title: ReactNode;
  more?: { label: string; href: string };
  rows: RankCardRow[];
}) {
  return (
    <section className="rank-card">
      <header className="head">
        <h3>{title}</h3>
        {more ? (
          <a className="more" href={more.href}>
            {more.label}
          </a>
        ) : null}
      </header>
      <div>
        {rows.map((row, i) => {
          const Body = (
            <>
              <span className="r">{String(i + 1).padStart(2, "0")}</span>
              <span>{row.label}</span>
              <span className="v">{row.value}</span>
            </>
          );
          return row.href ? (
            <a key={i} className="rank-row" href={row.href}>
              {Body}
            </a>
          ) : (
            <div key={i} className="rank-row">
              {Body}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * PeerRail: sticky entity-rank widget — renders a window of peers with
 * the current entity highlighted via the `.you` row. Skipped ranks render
 * a "…" gap-skip divider.
 */
type PeerRailRow = {
  rank: number;
  label: ReactNode;
  value: ReactNode;
  isYou?: boolean;
  href?: string;
};

export function PeerRail({
  title,
  totalLabel,
  rows,
}: {
  title: ReactNode;
  totalLabel: ReactNode;
  rows: PeerRailRow[];
}) {
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);

  const items: ReactNode[] = [];
  let prev: number | null = null;
  for (const row of sorted) {
    if (prev !== null && row.rank > prev + 1) {
      items.push(
        <div key={`gap-${prev}-${row.rank}`} className="gap-skip">
          … {row.rank - prev - 1} ranks omitted …
        </div>,
      );
    }
    const cls = row.isYou ? "peer-row you" : "peer-row";
    const Body = (
      <>
        <span className="r">#{row.rank}</span>
        <span>{row.label}</span>
        <span className="v">{row.value}</span>
      </>
    );
    items.push(
      row.href && !row.isYou ? (
        <a key={row.rank} className={cls} href={row.href}>
          {Body}
        </a>
      ) : (
        <div key={row.rank} className={cls}>
          {Body}
        </div>
      ),
    );
    prev = row.rank;
  }

  return (
    <aside className="peer-rail">
      <header className="head">
        <h4>{title}</h4>
        <span className="of">{totalLabel}</span>
      </header>
      <div>{items}</div>
    </aside>
  );
}

/**
 * FeedRow: single-line activity row — when (mono) · what (sans) · actions.
 */
export function FeedRow({
  when,
  children,
  actions,
}: {
  when: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="feed-row">
      <span className="when">{when}</span>
      <span className="what">{children}</span>
      <span>{actions}</span>
    </div>
  );
}
