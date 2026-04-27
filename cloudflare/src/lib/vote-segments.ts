export type VoteSegment = {
  label: string;
  count: number;
  color: string;
};

/** Builds standard vote segments from a map of voteCast → count. */
export function buildVoteSegments(
  voteCounts: Record<string, number>,
): VoteSegment[] {
  const palette: Record<string, string> = {
    Yea: "bg-emerald-600",
    Aye: "bg-emerald-600",
    Yes: "bg-emerald-600",
    Nay: "bg-rose-600",
    No: "bg-rose-600",
    "Not Voting": "bg-stone-400",
    Present: "bg-amber-500",
  };
  // Stable order: Yea-like first, Nay-like second, then the rest
  const order = ["Yea", "Aye", "Yes", "Nay", "No", "Not Voting", "Present"];
  const sorted = Object.entries(voteCounts).sort(([a], [b]) => {
    const ai = order.indexOf(a);
    const bi = order.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
  return sorted.map(([label, count]) => ({
    label,
    count,
    color: palette[label] ?? "bg-stone-500",
  }));
}
