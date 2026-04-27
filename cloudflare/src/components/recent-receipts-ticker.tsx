import { useEffect, useState } from "react";
import { fetchJson } from "../lib/feed";

type Contribution = {
  committeeId: string;
  committeeName?: string;
  donorName?: string;
  amount?: number;
  contributionDate?: string;
};

type Committee = { committeeId: string; name: string };

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDate(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toProperCase(s: string | null | undefined): string {
  if (!s) return "—";
  return s.toLowerCase().replace(/\b\w+/g, (w) => w[0].toUpperCase() + w.slice(1));
}

export function RecentReceiptsTicker({ limit = 8 }: { limit?: number }) {
  const [items, setItems] = useState<Contribution[] | null>(null);
  const [committeeMap, setCommitteeMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [contributions, committees] = await Promise.all([
          fetchJson<Contribution[]>("recent-receipts.json").catch(() => [] as Contribution[]),
          fetchJson<Committee[]>("committees.json").catch(() => [] as Committee[]),
        ]);
        if (cancelled) return;
        setCommitteeMap(Object.fromEntries(committees.map((c) => [c.committeeId, c.name])));
        const filtered = contributions
          .filter(
            (c) =>
              Number.isFinite(c.amount) &&
              (c.amount ?? 0) > 0 &&
              c.contributionDate &&
              !Number.isNaN(new Date(c.contributionDate).getTime()),
          )
          .sort(
            (a, b) =>
              new Date(b.contributionDate as string).getTime() -
              new Date(a.contributionDate as string).getTime(),
          )
          .slice(0, limit);
        setItems(filtered);
      } catch {
        if (!cancelled) setItems([]);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (!items || items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <span className="kicker">Fresh receipts</span>
        <span className="hand" style={{ fontSize: 16, transform: "rotate(-1.5deg)", display: "inline-block" }}>
          latest reported checks
        </span>
      </div>
      <div
        className="overflow-x-auto"
        style={{
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--r-md)",
          background: "var(--paper)",
          padding: "10px 12px",
        }}
      >
        <div style={{ display: "flex", gap: 18, whiteSpace: "nowrap", alignItems: "baseline" }}>
          {items.map((c, i) => {
            const recipient = c.committeeName ?? committeeMap[c.committeeId] ?? c.committeeId;
            return (
              <div
                key={`${c.committeeId}-${i}`}
                style={{
                  display: "inline-flex",
                  alignItems: "baseline",
                  gap: 8,
                  paddingRight: 18,
                  borderRight: i < items.length - 1 ? "1px dashed var(--line-soft)" : "none",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontSize: 11,
                    color: "var(--ink-3)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {fmtDate(c.contributionDate as string)}
                </span>
                <span style={{ fontSize: 13, color: "var(--ink)" }}>
                  <b style={{ fontWeight: 600 }}>{toProperCase(c.donorName)}</b>
                  <span style={{ color: "var(--ink-3)", margin: "0 6px" }}>→</span>
                  <span>{toProperCase(recipient)}</span>
                </span>
                <span
                  className="money"
                  style={{
                    fontFamily: "var(--font-jetbrains-mono)",
                    fontVariantNumeric: "tabular-nums",
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {fmtMoney(c.amount as number)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
