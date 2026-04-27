/**
 * Receipts/votes timeline — 8-cell horizontal mono axis showing recent
 * vote positions distributed by date. Yea/Nay/Other are color-coded;
 * the axis labels in mono uppercase.
 */
type Vote = { date: string | Date; voteCast: string; question?: string };

function classify(label: string): "yea" | "nay" | "other" {
  const L = label.toLowerCase();
  if (L === "yea" || L === "aye" || L === "yes") return "yea";
  if (L === "nay" || L === "no") return "nay";
  return "other";
}

function toneFor(kind: "yea" | "nay" | "other"): string {
  if (kind === "yea") return "var(--good)";
  if (kind === "nay") return "var(--money)";
  return "var(--ink-4)";
}

export function MemberTimeline({ votes }: { votes: Vote[] }) {
  const points = votes
    .map((v) => ({
      ...v,
      ts: new Date(v.date).getTime(),
      kind: classify(v.voteCast),
    }))
    .filter((v) => Number.isFinite(v.ts))
    .sort((a, b) => a.ts - b.ts);

  if (!points.length) return null;

  const minTs = points[0].ts;
  const maxTs = points[points.length - 1].ts;
  const span = Math.max(maxTs - minTs, 1);

  // 8 evenly spaced labels across span
  const ticks: Array<{ x: number; label: string }> = [];
  for (let i = 0; i < 8; i++) {
    const t = minTs + (span * i) / 7;
    const d = new Date(t);
    ticks.push({
      x: (i / 7) * 100,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    });
  }

  return (
    <div
      className="timeline"
      style={{
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        background: "var(--paper)",
      }}
    >
      <div
        style={{
          position: "relative",
          height: 56,
          marginBottom: 8,
        }}
      >
        {/* center axis line */}
        <div
          style={{
            position: "absolute",
            left: 0, right: 0, top: "50%",
            borderTop: "1px dashed var(--line-soft)",
          }}
        />
        {points.map((p, i) => {
          const left = ((p.ts - minTs) / span) * 100;
          const top = p.kind === "nay" ? 70 : p.kind === "yea" ? 20 : 50;
          return (
            <div
              key={i}
              title={`${new Date(p.ts).toLocaleDateString()} · ${p.voteCast}${p.question ? ` · ${p.question}` : ""}`}
              style={{
                position: "absolute",
                left: `${left}%`,
                top: `${top}%`,
                transform: "translate(-50%, -50%)",
                width: 8,
                height: 8,
                borderRadius: 999,
                background: toneFor(p.kind),
                boxShadow: "0 0 0 2px var(--paper)",
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 4,
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginTop: 6,
        }}
      >
        {ticks.map((t, i) => (
          <div
            key={i}
            style={{
              textAlign: "center",
              padding: "2px 0",
              borderTop: "1px solid var(--line-soft)",
            }}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 10,
          fontFamily: "var(--font-jetbrains-mono)",
          fontSize: 10,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--good)" }} />
          Yea
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--money)" }} />
          Nay
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--ink-4)" }} />
          Other
        </span>
      </div>
    </div>
  );
}
