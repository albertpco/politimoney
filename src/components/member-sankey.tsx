/**
 * Sketchy sankey — a hand-drawn-style money-flow diagram from receipt
 * sources into a single recipient node. Sized proportionally to value;
 * stroke uses dasharray + slight rotation jitter for the "sketchy" energy
 * the design system reserves for diagrams.
 */
type Source = { label: string; value: number };

function fmtMoney(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function MemberSankey({
  sources,
  targetLabel,
}: {
  sources: Source[];
  targetLabel: string;
}) {
  const visible = sources.filter((s) => s.value > 0);
  const total = visible.reduce((sum, s) => sum + s.value, 0);
  if (!visible.length || total === 0) return null;

  const W = 720;
  const H = 320;
  const padX = 24;
  const leftX = padX + 90;
  const rightX = W - padX - 110;

  // distribute source nodes vertically by share, with small gaps between
  const gap = 8;
  const usableH = H - padX * 2 - gap * (visible.length - 1);
  let cursor = padX;
  const sourceNodes = visible.map((s) => {
    const h = Math.max(18, (s.value / total) * usableH);
    const node = { ...s, y: cursor, h };
    cursor += h + gap;
    return node;
  });

  const targetY = padX;
  const targetH = H - padX * 2;

  // give each ribbon a slightly different rotation seed for sketchiness
  return (
    <div
      className="diagram"
      style={{
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--r-lg)",
        padding: 18,
        background: "var(--paper)",
        position: "relative",
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Money flow into ${targetLabel}`}
      >
        <defs>
          <filter id="sankey-rough">
            <feTurbulence type="fractalNoise" baseFrequency="0.015" numOctaves="1" seed="3" />
            <feDisplacementMap in="SourceGraphic" scale="2.2" />
          </filter>
        </defs>

        {/* axis labels */}
        <text
          x={padX}
          y={14}
          fontFamily="var(--font-jetbrains-mono)"
          fontSize="10"
          letterSpacing="0.12em"
          fill="var(--ink-3)"
        >
          SOURCES →
        </text>
        <text
          x={W - padX}
          y={14}
          textAnchor="end"
          fontFamily="var(--font-jetbrains-mono)"
          fontSize="10"
          letterSpacing="0.12em"
          fill="var(--ink-3)"
        >
          → CAMPAIGN
        </text>

        {/* ribbons */}
        {sourceNodes.map((node, i) => {
          // ribbon thickness scales with value vs total for the target side
          const rh = Math.max(8, (node.value / total) * (targetH - 8));
          const ry = targetY + (i / Math.max(visible.length - 1, 1)) * (targetH - rh);
          const c1x = leftX + (rightX - leftX) * 0.35;
          const c2x = leftX + (rightX - leftX) * 0.65;
          const path = [
            `M ${leftX} ${node.y + node.h / 2}`,
            `C ${c1x} ${node.y + node.h / 2}, ${c2x} ${ry + rh / 2}, ${rightX} ${ry + rh / 2}`,
          ].join(" ");
          return (
            <path
              key={i}
              d={path}
              stroke="var(--money)"
              strokeWidth={Math.max(2, rh * 0.6)}
              strokeOpacity={0.18 + 0.10 * (i % 2)}
              fill="none"
              strokeLinecap="round"
              filter="url(#sankey-rough)"
            />
          );
        })}

        {/* source nodes */}
        {sourceNodes.map((node, i) => (
          <g key={`s-${i}`}>
            <rect
              x={padX}
              y={node.y}
              width={leftX - padX}
              height={node.h}
              fill="var(--paper-2)"
              stroke="var(--ink)"
              strokeWidth="1"
              strokeDasharray="3 2"
              rx="3"
              filter="url(#sankey-rough)"
            />
            <text
              x={padX + 6}
              y={node.y + node.h / 2 - 2}
              fontFamily="var(--font-inter)"
              fontSize="11"
              fill="var(--ink)"
            >
              {node.label}
            </text>
            <text
              x={padX + 6}
              y={node.y + node.h / 2 + 12}
              fontFamily="var(--font-jetbrains-mono)"
              fontSize="10"
              fill="var(--money)"
            >
              {fmtMoney(node.value)}
            </text>
          </g>
        ))}

        {/* target node */}
        <rect
          x={rightX}
          y={targetY}
          width={W - rightX - padX}
          height={targetH}
          fill="var(--civic-soft)"
          stroke="var(--ink)"
          strokeWidth="1.5"
          rx="4"
          filter="url(#sankey-rough)"
        />
        <text
          x={rightX + 10}
          y={targetY + targetH / 2 - 4}
          fontFamily="var(--font-fraunces)"
          fontSize="14"
          fontWeight="500"
          fill="var(--ink)"
        >
          {targetLabel}
        </text>
        <text
          x={rightX + 10}
          y={targetY + targetH / 2 + 14}
          fontFamily="var(--font-jetbrains-mono)"
          fontSize="11"
          fill="var(--money)"
        >
          {fmtMoney(total)}
        </text>

        {/* hand annotation */}
        <text
          x={W / 2}
          y={H - 6}
          textAnchor="middle"
          fontFamily="var(--font-caveat)"
          fontSize="14"
          fill="var(--money)"
        >
          ribbon thickness ≈ share of receipts
        </text>
      </svg>
    </div>
  );
}
