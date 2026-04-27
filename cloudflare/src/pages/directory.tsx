/**
 * Generic dataset directory page — used for sections that haven't yet been
 * given a dedicated explorer. Loads the index from the static feed and
 * provides a simple search-and-link list.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "../components/link";
import { SectionCard } from "../components/ui-primitives";
import { loadIndex, type DatasetKey, type FeedIndexEntry } from "../lib/feed";

const SECTION_META: Record<DatasetKey, { label: string; singular: string; placeholder: string; description: string }> = {
  members: {
    label: "Members",
    singular: "member",
    placeholder: "Search by name, chamber, party, or state",
    description: "Bioguide-anchored profiles for current and recent members of Congress.",
  },
  pacs: {
    label: "PACs",
    singular: "PAC",
    placeholder: "Search by committee, sponsor, or funding note",
    description: "Committees and PACs from the FEC dataset, ranked by total receipts.",
  },
  donors: {
    label: "Donors",
    singular: "donor",
    placeholder: "Search by donor, amount, or source tag",
    description: "Top donor profiles aggregated from FEC contribution filings.",
  },
  bills: {
    label: "Bills",
    singular: "bill",
    placeholder: "Search by bill number, title, or policy area",
    description: "Recent bills indexed from Congress.gov with linked roll-call votes.",
  },
  votes: {
    label: "Votes",
    singular: "vote",
    placeholder: "Search by bill, roll call, chamber, or result",
    description: "House and Senate roll-call votes with member breakdowns and funding context.",
  },
  states: {
    label: "States",
    singular: "state",
    placeholder: "Search by state name or code",
    description: "State-level outcome dashboards with federal delegation context.",
  },
  congressTrades: {
    label: "Congress Trades",
    singular: "trade",
    placeholder: "Search by member, ticker, asset, state, or transaction type",
    description: "STOCK Act disclosures and SEC Form 4 insider trades for sitting members.",
  },
};

const DETAIL_HREF: Partial<Record<DatasetKey, (id: string) => string>> = {
  members: (id) => `/members/${id.toLowerCase()}`,
  pacs: (id) => `/pacs/${id.toLowerCase()}`,
  donors: (id) => `/donors/${id.toLowerCase()}`,
  bills: (id) => `/bills/${id.toLowerCase()}`,
  states: (id) => `/states/${id.toLowerCase()}`,
  congressTrades: (id) => `/congress-trades/${id.toLowerCase()}`,
};

function money(value?: number) {
  if (!Number.isFinite(value)) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value as number);
}

export function DirectoryPage({ section }: { section: DatasetKey }) {
  const meta = SECTION_META[section];
  const [entries, setEntries] = useState<FeedIndexEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    loadIndex(section)
      .then((rows) => {
        if (!cancelled) {
          setEntries(rows);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load index");
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [section]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return entries.filter((entry) => {
      const haystack = `${entry.label} ${entry.id} ${entry.summary ?? ""} ${entry.tags?.join(" ") ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query]);
  const visible = filtered.slice(0, 200);

  return (
    <main className="space-y-5">
      <SectionCard title={meta.label} subtitle={meta.description}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <input
            aria-label={`Search ${meta.label}`}
            placeholder={meta.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pt-input flex-1 min-w-[220px] px-3 py-2 text-sm"
          />
          <span className="pt-muted text-xs">
            Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} matches
          </span>
        </div>

        {loading ? <p className="pt-muted text-sm">Loading {meta.label} index…</p> : null}
        {error ? <p className="pt-muted text-sm">{error}</p> : null}
        {!loading && !error && filtered.length === 0 ? (
          <p className="pt-muted text-sm">No {meta.singular} records match this search.</p>
        ) : null}

        <div className="grid gap-2">
          {visible.map((entry) => {
            const detailHref = DETAIL_HREF[section]?.(entry.id) ?? entry.href ?? `/${section}/${entry.id.toLowerCase()}`;
            const amount = money(entry.amount);
            return (
              <Link
                key={`${entry.id}-${entry.datasetPath}`}
                href={detailHref}
                className="pt-panel flex items-baseline justify-between gap-3 px-3 py-3 text-sm hover:border-[var(--ink)]"
                style={{ textDecoration: "none", color: "var(--ink)" }}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{entry.label}</strong>
                  <span className="pt-muted block truncate text-xs">{entry.summary ?? entry.id}</span>
                </span>
                <span className="pt-muted shrink-0 text-xs">
                  {amount ?? entry.tags?.slice(0, 2).join(" · ") ?? entry.id}
                </span>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </main>
  );
}

export default DirectoryPage;
