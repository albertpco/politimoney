import type { ReactNode } from "react";

type VoteGroup = {
  voteCast: string;
  memberCount: number;
  matchedCandidateCount: number;
  totalReceipts: number;
};

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function classify(label: string): "yea" | "nay" | "other" {
  const L = label.toLowerCase();
  if (L === "yea" || L === "aye" || L === "yes") return "yea";
  if (L === "nay" || L === "no") return "nay";
  return "other";
}

/**
 * YEA / NAY split-card surface from the design system.
 * Renders the two largest opposing groups side-by-side with serif counts,
 * mono-uppercase labels, and money-tone totals. Other groups (Present,
 * Not Voting) collapse into a small inline strip below.
 */
export function VoteSplitCards({
  groups,
  caveat,
}: {
  groups: VoteGroup[];
  caveat?: ReactNode;
}) {
  const yea = groups.find((g) => classify(g.voteCast) === "yea");
  const nay = groups.find((g) => classify(g.voteCast) === "nay");
  const others = groups.filter((g) => classify(g.voteCast) === "other");

  if (!yea && !nay) return null;

  const Card = ({
    side,
    g,
  }: {
    side: "yea" | "nay";
    g: VoteGroup | undefined;
  }) => {
    if (!g) {
      return (
        <div className={`split-card ${side}`}>
          <div className="head">
            <span className="count" style={{ color: "var(--ink-4)" }}>—</span>
            <span className="label">{side.toUpperCase()}</span>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>No recorded votes on this side.</p>
        </div>
      );
    }
    const avg = g.matchedCandidateCount
      ? g.totalReceipts / g.matchedCandidateCount
      : 0;
    return (
      <div className={`split-card ${side}`}>
        <div className="head">
          <span className="count">{g.memberCount.toLocaleString()}</span>
          <span className="label">
            {side === "yea" ? "Yea · members" : "Nay · members"}
          </span>
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "0 0 4px" }}>
          {g.matchedCandidateCount.toLocaleString()} matched candidate records
        </p>
        <div className="totals">
          <div className="metric money">
            <span className="label">Linked receipts</span>
            <span className="value" data-kind="money">{fmtMoney(g.totalReceipts)}</span>
          </div>
          <div className="metric">
            <span className="label">Avg / candidate</span>
            <span className="value" data-kind="money">{fmtMoney(avg)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {caveat ? (
        <div className="caveat">
          <span className="badge">*</span>
          <div>{caveat}</div>
        </div>
      ) : null}
      <div className="vote-split">
        <Card side="yea" g={yea} />
        <Card side="nay" g={nay} />
      </div>
      {others.length ? (
        <div className="flex flex-wrap items-center gap-2" style={{ fontSize: 12 }}>
          <span className="kicker" style={{ marginRight: 4 }}>Other</span>
          {others.map((o) => (
            <span key={o.voteCast} className="pill">
              {o.voteCast}: {o.memberCount.toLocaleString()}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
