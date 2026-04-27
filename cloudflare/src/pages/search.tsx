import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Link from "../components/link";
import { QueryHero } from "../components/politired-surfaces";
import { SectionCard, TableExplorer } from "../components/ui-primitives";
import { loadIndex, type DatasetKey, type FeedIndexEntry } from "../lib/feed";

const SEARCH_DATASETS: DatasetKey[] = [
  "members",
  "pacs",
  "donors",
  "bills",
  "votes",
  "states",
  "congressTrades",
];

const TYPE_LABELS: Record<DatasetKey, string> = {
  members: "Member",
  pacs: "Committee/PAC",
  donors: "Donor",
  bills: "Bill",
  votes: "Vote",
  states: "State",
  congressTrades: "Congress trade",
};

function detailHref(type: DatasetKey, entry: FeedIndexEntry): string {
  if (type === "members") return `/members/${entry.id.toLowerCase()}`;
  if (type === "pacs") return `/pacs/${entry.id.toLowerCase()}`;
  if (type === "donors") return `/donors/${entry.id.toLowerCase()}`;
  if (type === "bills") return `/bills/${entry.id.toLowerCase()}`;
  if (type === "states") return `/states/${entry.id.toLowerCase()}`;
  if (type === "congressTrades") return `/congress-trades/${entry.id.toLowerCase()}`;
  if (type === "votes") {
    // Determine chamber from datasetPath: votes/house/* or votes/senate/*
    const seg = entry.datasetPath.split("/")[1];
    return `/votes/${seg ?? "house"}/${entry.id.toLowerCase()}`;
  }
  return entry.href ?? "/";
}

type CombinedEntry = FeedIndexEntry & { __type: DatasetKey };

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const [q, setQ] = useState(initialQ);
  const [allEntries, setAllEntries] = useState<CombinedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SEARCH_DATASETS.map(async (key) => {
        const rows = await loadIndex(key).catch(() => [] as FeedIndexEntry[]);
        return rows.map((row) => ({ ...row, __type: key } as CombinedEntry));
      }),
    ).then((groups) => {
      if (cancelled) return;
      setAllEntries(groups.flat());
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return allEntries
      .map((entry) => {
        const haystack = `${entry.label} ${entry.id} ${entry.summary ?? ""} ${entry.tags?.join(" ") ?? ""}`.toLowerCase();
        const idx = haystack.indexOf(needle);
        if (idx === -1) return null;
        return { entry, score: idx + (entry.label.toLowerCase().startsWith(needle) ? -100 : 0) };
      })
      .filter((row): row is { entry: CombinedEntry; score: number } => row !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 100);
  }, [q, allEntries]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    setParams(next);
  };

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <QueryHero
          title="Search the public record."
          subtitle="Start with a person, PAC, bill, or donor and explore the public record."
          examples={[
            { label: "Top funded members of Congress", href: "/search?q=Top%20funded%20members%20of%20Congress" },
            { label: "Rank PACs by total receipts", href: "/search?q=Rank%20PACs%20by%20total%20receipts" },
            { label: "Compare state outcomes on child poverty", href: "/search?q=Compare%20state%20outcomes%20on%20child%20poverty" },
          ]}
        />

        <SectionCard title="Query" subtitle="Search members, PACs, donors, bills, votes, states, and congressional trades.">
          <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try a member name, committee name, bill number, or donor name."
              className="pt-input flex-1 min-w-[260px] px-3 py-2 text-sm"
              aria-label="Search query"
            />
            <button type="submit" className="pt-button-primary px-4 py-2 text-sm">Search</button>
          </form>
          <p className="pt-muted mt-2 text-xs">
            {loading ? "Loading records…" : `${allEntries.length.toLocaleString()} searchable public records across ${SEARCH_DATASETS.length} categories.`}
          </p>
        </SectionCard>

        {q.trim() ? (
          <SectionCard title={`Results for "${q.trim()}"`} subtitle={`${results.length} matches found.`}>
            {results.length === 0 ? (
              <p className="pt-muted text-sm">No records match this query. Try a different term or browse a directory.</p>
            ) : (
              <TableExplorer
                columns={["Name", "Type", "Context", "Route"]}
                rows={results.map(({ entry }) => [
                  entry.label,
                  TYPE_LABELS[entry.__type],
                  entry.summary ?? entry.tags?.slice(0, 3).join(" · ") ?? "—",
                  { label: "Open", href: detailHref(entry.__type, entry) },
                ])}
              />
            )}
          </SectionCard>
        ) : (
          <SectionCard title="Start here" subtitle="Use the search box above or jump into a primary directory.">
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/members" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse members
              </Link>
              <Link href="/pacs" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse PACs
              </Link>
              <Link href="/search?q=Rank%20PACs%20by%20total%20receipts" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Run an example question
              </Link>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}

export default SearchPage;
