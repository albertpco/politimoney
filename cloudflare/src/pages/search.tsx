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

const TYPE_DIRECTORY: Record<DatasetKey, string> = {
  members: "/members",
  pacs: "/pacs",
  donors: "/donors",
  bills: "/bills",
  votes: "/votes",
  states: "/states",
  congressTrades: "/congress-trades",
};

function detailHref(type: DatasetKey, entry: FeedIndexEntry): string {
  if (type === "members") return `/members/${entry.id.toLowerCase()}`;
  if (type === "pacs") return `/pacs/${entry.id.toLowerCase()}`;
  if (type === "donors") return `/donors/${entry.id.toLowerCase()}`;
  if (type === "bills") return `/bills/${entry.id.toLowerCase()}`;
  if (type === "states") return `/states/${entry.id.toLowerCase()}`;
  if (type === "congressTrades") return `/congress-trades/${entry.id.toLowerCase()}`;
  if (type === "votes") {
    const seg = entry.datasetPath.split("/")[1];
    return `/votes/${seg ?? "house"}/${entry.id.toLowerCase()}`;
  }
  return entry.href ?? "/";
}

type CombinedEntry = FeedIndexEntry & { __type: DatasetKey; __haystack: string };

const PARTY_SYNONYMS: Record<string, string> = {
  d: "democrat democratic",
  r: "republican gop",
  i: "independent",
  l: "libertarian",
};

function buildHaystack(entry: FeedIndexEntry, type: DatasetKey): string {
  const parts = [
    entry.label,
    entry.id,
    entry.summary ?? "",
    entry.tags?.join(" ") ?? "",
  ];

  // Augment with synonyms so natural-language queries hit.
  if (type === "members") {
    const tags = (entry.tags ?? []).map((t) => t.toLowerCase());
    if (tags.includes("s")) parts.push("senator senate");
    if (tags.includes("h")) parts.push("representative congressman congresswoman house");
    for (const t of tags) {
      const synonym = PARTY_SYNONYMS[t];
      if (synonym) parts.push(synonym);
    }
  }
  if (type === "pacs") parts.push("pac committee");
  if (type === "bills") parts.push("bill legislation");
  if (type === "votes") parts.push("vote roll call");
  if (type === "donors") parts.push("donor contributor");
  if (type === "states") parts.push("state");
  if (type === "congressTrades") parts.push("trade stock disclosure");

  return parts.join(" ").toLowerCase();
}

type Match = { entry: CombinedEntry; score: number };

function scoreEntry(entry: CombinedEntry, tokens: string[]): Match | null {
  if (tokens.length === 0) return null;
  const haystack = entry.__haystack;
  const label = entry.label.toLowerCase();

  let positionSum = 0;
  let labelHits = 0;
  for (const token of tokens) {
    const idx = haystack.indexOf(token);
    if (idx === -1) return null; // every token must appear
    positionSum += idx;
    if (label.includes(token)) labelHits += 1;
  }

  // Score: lower is better. Big bonus when every token hits the label.
  let score = positionSum;
  if (labelHits === tokens.length) score -= 1000;
  if (label.startsWith(tokens[0])) score -= 500;
  // Prefer shorter labels for exact-style matches (e.g., "Adams" should beat
  // "Adams Republican PAC for Adams County").
  score += Math.min(label.length, 200) / 10;

  return { entry, score };
}

const SUGGESTIONS: { label: string; href: string }[] = [
  { label: "Pelosi", href: "/search?q=Pelosi" },
  { label: "California senators", href: "/search?q=California+senator" },
  { label: "Pfizer", href: "/search?q=Pfizer" },
  { label: "Top PACs", href: "/pacs" },
  { label: "Browse bills", href: "/bills" },
  { label: "Browse states", href: "/states" },
];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const initialQ = params.get("q") ?? "";
  const initialType = (params.get("type") ?? "all") as DatasetKey | "all";
  const [q, setQ] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState<DatasetKey | "all">(initialType);
  const [allEntries, setAllEntries] = useState<CombinedEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      SEARCH_DATASETS.map(async (key) => {
        const rows = await loadIndex(key).catch(() => [] as FeedIndexEntry[]);
        return rows.map(
          (row) =>
            ({
              ...row,
              __type: key,
              __haystack: buildHaystack(row, key),
            }) as CombinedEntry,
        );
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

  // Sync URL when q or typeFilter change via internal state (form submit / chip click).
  useEffect(() => {
    setQ(params.get("q") ?? "");
    setTypeFilter(((params.get("type") ?? "all") as DatasetKey | "all"));
  }, [params]);

  const allMatches = useMemo(() => {
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return [] as Match[];
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    return allEntries
      .map((entry) => scoreEntry(entry, tokens))
      .filter((m): m is Match => m !== null)
      .sort((a, b) => a.score - b.score);
  }, [q, allEntries]);

  const counts = useMemo(() => {
    const c: Record<DatasetKey | "all", number> = {
      all: allMatches.length,
      members: 0,
      pacs: 0,
      donors: 0,
      bills: 0,
      votes: 0,
      states: 0,
      congressTrades: 0,
    };
    for (const m of allMatches) c[m.entry.__type] += 1;
    return c;
  }, [allMatches]);

  const visible = useMemo(() => {
    const filtered =
      typeFilter === "all"
        ? allMatches
        : allMatches.filter((m) => m.entry.__type === typeFilter);
    return filtered.slice(0, 100);
  }, [allMatches, typeFilter]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next = new URLSearchParams(params);
    if (q.trim()) next.set("q", q.trim());
    else next.delete("q");
    if (typeFilter !== "all") next.set("type", typeFilter);
    else next.delete("type");
    setParams(next);
  };

  const setType = (next: DatasetKey | "all") => {
    setTypeFilter(next);
    const params2 = new URLSearchParams(params);
    if (next !== "all") params2.set("type", next);
    else params2.delete("type");
    setParams(params2);
  };

  // Suggest the directory most likely to help when no rows match.
  const zeroResultDirectory: DatasetKey | null = useMemo(() => {
    if (allMatches.length > 0) return null;
    const trimmed = q.trim().toLowerCase();
    if (!trimmed) return null;
    if (/(senator|representative|congress(man|woman)?|house|senate)/.test(trimmed)) return "members";
    if (/(pac|committee)/.test(trimmed)) return "pacs";
    if (/(bill|hr |s | act)/.test(trimmed)) return "bills";
    if (/(vote|roll call)/.test(trimmed)) return "votes";
    if (/(donor|donation|contribution)/.test(trimmed)) return "donors";
    if (/(state|outcome)/.test(trimmed)) return "states";
    if (/(trade|stock|stock act)/.test(trimmed)) return "congressTrades";
    return null;
  }, [q, allMatches.length]);

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <QueryHero
          title="Search the public record."
          subtitle="Find a person, committee, bill, donor, vote, or state. Multi-word queries match every token."
          examples={SUGGESTIONS}
        />

        <SectionCard title="Query" subtitle="Search members, PACs, donors, bills, votes, states, and congressional trades.">
          <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Try: Pelosi · California senator · Pfizer PAC · HR 1"
              className="pt-input flex-1 min-w-[260px] px-3 py-2 text-sm"
              aria-label="Search query"
            />
            <button type="submit" className="pt-button-primary px-4 py-2 text-sm">Search</button>
          </form>
          <p className="pt-muted mt-2 text-xs">
            {loading
              ? "Loading records…"
              : `${allEntries.length.toLocaleString()} searchable public records across ${SEARCH_DATASETS.length} categories.`}
          </p>
        </SectionCard>

        {q.trim() ? (
          <SectionCard
            title={`Results for "${q.trim()}"`}
            subtitle={`${allMatches.length.toLocaleString()} match${allMatches.length === 1 ? "" : "es"}${typeFilter === "all" ? "" : ` · filtered to ${TYPE_LABELS[typeFilter as DatasetKey]}`}`}
          >
            <div className="mb-3 flex flex-wrap gap-2">
              <TypeChip
                label={`All (${counts.all.toLocaleString()})`}
                active={typeFilter === "all"}
                onClick={() => setType("all")}
              />
              {SEARCH_DATASETS.filter((t) => counts[t] > 0).map((t) => (
                <TypeChip
                  key={t}
                  label={`${TYPE_LABELS[t]} (${counts[t].toLocaleString()})`}
                  active={typeFilter === t}
                  onClick={() => setType(t)}
                />
              ))}
            </div>

            {visible.length === 0 ? (
              <div className="space-y-2">
                <p className="pt-muted text-sm">
                  No records match this query
                  {typeFilter === "all" ? "" : ` in ${TYPE_LABELS[typeFilter as DatasetKey]}`}.
                </p>
                {zeroResultDirectory ? (
                  <p className="text-sm">
                    Try the <Link className="pt-link" href={TYPE_DIRECTORY[zeroResultDirectory]}>
                      {TYPE_LABELS[zeroResultDirectory]} directory
                    </Link>{" "}
                    instead — it lists every record in that category.
                  </p>
                ) : (
                  <p className="text-sm">
                    Try a single keyword, or browse{" "}
                    <Link className="pt-link" href="/members">members</Link>,{" "}
                    <Link className="pt-link" href="/pacs">PACs</Link>,{" "}
                    <Link className="pt-link" href="/bills">bills</Link>, or{" "}
                    <Link className="pt-link" href="/states">states</Link>.
                  </p>
                )}
              </div>
            ) : (
              <TableExplorer
                columns={["Name", "Type", "Context", "Route"]}
                rows={visible.map(({ entry }) => [
                  entry.label,
                  TYPE_LABELS[entry.__type],
                  entry.summary ?? entry.tags?.slice(0, 3).join(" · ") ?? "—",
                  { label: "Open", href: detailHref(entry.__type, entry) },
                ])}
              />
            )}
            {allMatches.length > visible.length ? (
              <p className="pt-muted mt-3 text-xs">
                Showing the top {visible.length.toLocaleString()} of {allMatches.length.toLocaleString()}. Refine with a more specific term or pick a type chip above.
              </p>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard title="Start here" subtitle="Try a keyword, or jump into a directory.">
            <div className="grid gap-3 md:grid-cols-3">
              <Link href="/members" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse members
              </Link>
              <Link href="/pacs" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse PACs
              </Link>
              <Link href="/bills" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse bills
              </Link>
              <Link href="/votes" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse votes
              </Link>
              <Link href="/donors" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse donors
              </Link>
              <Link href="/states" className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50">
                Browse states
              </Link>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}

function TypeChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-full border border-stone-950 bg-stone-950 px-3 py-1 text-xs font-semibold text-white"
          : "rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700 hover:border-stone-400"
      }
    >
      {label}
    </button>
  );
}

export default SearchPage;
