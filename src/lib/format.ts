/** Shared formatting utilities used across pages. */

/** Format a number as compact USD (e.g., "$1.2M"). */
export function fmtCompact(v: number): string {
  return v > 0
    ? new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: 1,
        style: "currency",
        currency: "USD",
      }).format(v)
    : "—";
}

/** Format a number as full USD (e.g., "$1,234,567"). */
export function fmtMoney(v: number | undefined): string {
  if (!v || !Number.isFinite(v)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(v);
}

/** Convert "CRUZ, RAFAEL EDWARD TED" to "Rafael Edward Ted Cruz". */
export function toProperCase(name: string): string {
  if (!name) return name;
  const titleCase = (s: string) =>
    s.replace(/\b\w+/g, (w) => {
      if (w.length <= 2 && w === w.toUpperCase()) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    });
  if (name.includes(",")) {
    const [last, ...rest] = name.split(",");
    const first = rest.join(",").trim();
    return titleCase(`${first} ${last.trim()}`).trim();
  }
  return titleCase(name);
}

/** Normalize party labels: "DEMOCRATIC PARTY" -> "D" */
export function normalizeParty(party: string | undefined | null): string {
  if (!party) return "—";
  const p = party.trim().toUpperCase();
  if (p.startsWith("DEM")) return "D";
  if (p.startsWith("REP")) return "R";
  if (p.startsWith("LIB")) return "L";
  if (p.startsWith("IND")) return "I";
  if (p === "D" || p === "R" || p === "L" || p === "I" || p === "ID") return p;
  if (p.length <= 3) return p;
  return p.slice(0, 3);
}

export function donorTypeLabel(donorType: "person" | "organization" | "unknown"): string {
  if (donorType === "person") return "Person";
  if (donorType === "organization") return "Organization";
  return "Unclassified";
}

export function formatCycleLabel(cycles: number[] | undefined): string {
  if (!cycles?.length) return "cycle unavailable";
  if (cycles.length === 1) return `cycle ${cycles[0]}`;
  return `cycles ${cycles.join(", ")}`;
}
