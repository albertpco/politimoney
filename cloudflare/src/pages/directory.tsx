/**
 * Generic dataset directory page — used for sections that haven't yet been
 * given a dedicated explorer. Loads the index from the static feed and
 * provides a simple search-and-link list.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "../components/link";
import { SectionCard } from "../components/ui-primitives";
import {
  fetchJson,
  loadIndex,
  loadManifest,
  type BillDetail,
  type CongressTradeDetail,
  type DatasetKey,
  type FeedIndexEntry,
  type FeedManifest,
} from "../lib/feed";

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

type DirectoryEntry = FeedIndexEntry & {
  chamber?: string;
  state?: string;
  party?: string;
  hasFunding?: boolean;
  committeeType?: string;
  committeeParty?: string;
  billChamber?: string;
  billType?: string;
  congress?: string;
  hasLinkedVote?: boolean;
  ticker?: string;
  memberName?: string;
  transactionType?: string;
  transactionDate?: string;
  voteDate?: string;
  voteResult?: string;
  rollCallNumber?: string;
};

type SortKey =
  | "labelAsc"
  | "amountDesc"
  | "amountAsc"
  | "dateDesc"
  | "dateAsc"
  | "congressDesc"
  | "recordOrder";

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

function parseDate(value?: string) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function uniqueOptions(values: Array<string | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function tagAt(entry: FeedIndexEntry, index: number) {
  return entry.tags?.[index];
}

async function hydrateEntries(section: DatasetKey, rows: FeedIndexEntry[]): Promise<DirectoryEntry[]> {
  if (section === "members") {
    return rows.map((entry) => ({
      ...entry,
      chamber: tagAt(entry, 0),
      state: tagAt(entry, 1),
      party: tagAt(entry, 2),
      hasFunding: Number.isFinite(entry.amount),
    }));
  }

  if (section === "pacs") {
    const committees = await fetchJson<
      Array<{ committeeId: string; committeeType?: string | null; party?: string | null }>
    >("committees.json").catch(() => []);
    const committeeById = new Map(committees.map((committee) => [committee.committeeId.toUpperCase(), committee]));
    return rows.map((entry) => {
      const committee = committeeById.get(entry.id.toUpperCase());
      return {
        ...entry,
        committeeType: committee?.committeeType ?? entry.tags?.[0],
        committeeParty: committee?.party ?? undefined,
      };
    });
  }

  if (section === "bills") {
    const details = await Promise.all(
      rows.map((entry) =>
        fetchJson<BillDetail>(entry.datasetPath).catch(() => null),
      ),
    );
    return rows.map((entry, index) => {
      const detail = details[index];
      const billType = detail?.bill.billType ?? tagAt(entry, 1);
      const billChamber = billType?.startsWith("S") ? "S" : billType?.startsWith("H") ? "H" : undefined;
      return {
        ...entry,
        billChamber,
        billType,
        congress: String(detail?.bill.congress ?? tagAt(entry, 0) ?? ""),
        hasLinkedVote: Boolean(detail?.linkedVotes?.length),
      };
    });
  }

  if (section === "congressTrades") {
    const details = await Promise.all(
      rows.map((entry) =>
        fetchJson<CongressTradeDetail>(entry.datasetPath).catch(() => null),
      ),
    );
    return rows.map((entry, index) => {
      const trade = details[index]?.trade;
      return {
        ...entry,
        chamber: trade?.chamber ?? tagAt(entry, 0),
        state: trade?.state ?? tagAt(entry, 1),
        transactionType: trade?.transactionType ?? tagAt(entry, 2),
        ticker: trade?.ticker,
        memberName: trade?.memberName,
        transactionDate: trade?.transactionDate,
      };
    });
  }

  if (section === "votes") {
    return rows.map((entry) => {
      const chamber = tagAt(entry, 0);
      const rollCallNumber = String(tagAt(entry, 2) ?? "");
      return {
        ...entry,
        chamber,
        congress: String(tagAt(entry, 1) ?? ""),
        rollCallNumber,
        voteResult: entry.summary,
      };
    });
  }

  return rows;
}

function defaultSort(section: DatasetKey): SortKey {
  if (section === "pacs") return "amountDesc";
  if (section === "congressTrades") return "dateDesc";
  if (section === "votes") return "recordOrder";
  if (section === "bills") return "congressDesc";
  return "labelAsc";
}

function sourceNote(manifest: FeedManifest | null, section: DatasetKey) {
  const description = manifest?.datasets[section]?.description;
  const caveat = manifest?.caveats?.[0];
  return [description, caveat, "Records show public filings and official actions; they do not explain motive by themselves."]
    .filter(Boolean)
    .join(" ");
}

export function DirectoryPage({ section }: { section: DatasetKey }) {
  const meta = SECTION_META[section];
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [manifest, setManifest] = useState<FeedManifest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(() => defaultSort(section));
  const [chamber, setChamber] = useState("all");
  const [state, setState] = useState("all");
  const [party, setParty] = useState("all");
  const [funding, setFunding] = useState("all");
  const [committeeType, setCommitteeType] = useState("all");
  const [committeeParty, setCommitteeParty] = useState("all");
  const [billType, setBillType] = useState("all");
  const [congress, setCongress] = useState("all");
  const [linkedVote, setLinkedVote] = useState("all");
  const [transactionType, setTransactionType] = useState("all");
  const [visibleLimit, setVisibleLimit] = useState(200);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setQuery("");
    setSort(defaultSort(section));
    setVisibleLimit(200);
    Promise.all([loadManifest().catch(() => null), loadIndex(section)])
      .then(async ([nextManifest, rows]) => {
        const hydrated = await hydrateEntries(section, rows);
        if (!cancelled) {
          setManifest(nextManifest);
          setEntries(hydrated);
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

  const filterOptions = useMemo(
    () => ({
      chambers: uniqueOptions(entries.map((entry) => entry.chamber ?? entry.billChamber)),
      states: uniqueOptions(entries.map((entry) => entry.state)),
      parties: uniqueOptions(entries.map((entry) => entry.party)),
      committeeTypes: uniqueOptions(entries.map((entry) => entry.committeeType)),
      committeeParties: uniqueOptions(entries.map((entry) => entry.committeeParty)),
      billTypes: uniqueOptions(entries.map((entry) => entry.billType)),
      congresses: uniqueOptions(entries.map((entry) => entry.congress)).sort((a, b) => Number(b) - Number(a)),
      transactionTypes: uniqueOptions(entries.map((entry) => entry.transactionType)),
    }),
    [entries],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const matches = entries.filter((entry) => {
      const haystack =
        `${entry.label} ${entry.id} ${entry.summary ?? ""} ${entry.tags?.join(" ") ?? ""} ${entry.committeeType ?? ""} ${entry.memberName ?? ""} ${entry.ticker ?? ""}`.toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (chamber !== "all" && (entry.chamber ?? entry.billChamber) !== chamber) return false;
      if (state !== "all" && entry.state !== state) return false;
      if (party !== "all" && entry.party !== party) return false;
      if (funding === "with" && !entry.hasFunding) return false;
      if (funding === "without" && entry.hasFunding) return false;
      if (committeeType !== "all" && entry.committeeType !== committeeType) return false;
      if (committeeParty !== "all" && entry.committeeParty !== committeeParty) return false;
      if (billType !== "all" && entry.billType !== billType) return false;
      if (congress !== "all" && entry.congress !== congress) return false;
      if (linkedVote === "with" && !entry.hasLinkedVote) return false;
      if (linkedVote === "without" && entry.hasLinkedVote) return false;
      if (transactionType !== "all" && entry.transactionType !== transactionType) return false;
      return true;
    });
    return matches.sort((a, b) => {
      if (sort === "recordOrder") return 0;
      if (sort === "amountDesc") return (b.amount ?? -1) - (a.amount ?? -1);
      if (sort === "amountAsc") return (a.amount ?? Number.MAX_SAFE_INTEGER) - (b.amount ?? Number.MAX_SAFE_INTEGER);
      if (sort === "dateDesc") return parseDate(b.transactionDate ?? b.voteDate ?? b.summary) - parseDate(a.transactionDate ?? a.voteDate ?? a.summary);
      if (sort === "dateAsc") return parseDate(a.transactionDate ?? a.voteDate ?? a.summary) - parseDate(b.transactionDate ?? b.voteDate ?? b.summary);
      if (sort === "congressDesc") return Number(b.congress ?? 0) - Number(a.congress ?? 0) || a.label.localeCompare(b.label);
      return a.label.localeCompare(b.label);
    });
  }, [billType, chamber, committeeParty, committeeType, congress, entries, funding, linkedVote, party, query, sort, state, transactionType]);
  const visible = filtered.slice(0, visibleLimit);
  const hasActiveFilter =
    Boolean(query) ||
    [chamber, state, party, funding, committeeType, committeeParty, billType, congress, linkedVote, transactionType].some(
      (value) => value !== "all",
    );

  function resetFilters() {
    setQuery("");
    setChamber("all");
    setState("all");
    setParty("all");
    setFunding("all");
    setCommitteeType("all");
    setCommitteeParty("all");
    setBillType("all");
    setCongress("all");
    setLinkedVote("all");
    setTransactionType("all");
    setVisibleLimit(200);
  }

  return (
    <main className="space-y-5">
      <SectionCard title={meta.label} subtitle={meta.description}>
        <div className="mb-4 grid gap-3">
          <input
            aria-label={`Search ${meta.label}`}
            placeholder={meta.placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pt-input flex-1 min-w-[220px] px-3 py-2 text-sm"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <label className="directory-control">
              <span>Sort</span>
              <select className="pt-input px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                {section === "votes" ? <option value="recordOrder">Newest first</option> : null}
                <option value="labelAsc">Name A-Z</option>
                <option value="amountDesc">Receipts high-low</option>
                <option value="amountAsc">Receipts low-high</option>
                <option value="dateDesc">Newest transaction</option>
                <option value="dateAsc">Oldest transaction</option>
                <option value="congressDesc">Congress newest</option>
              </select>
            </label>

            {(section === "members" || section === "congressTrades" || section === "votes") ? (
              <>
                <FilterSelect label="Chamber" value={chamber} onChange={setChamber} options={filterOptions.chambers} />
                <FilterSelect label="State" value={state} onChange={setState} options={filterOptions.states} />
              </>
            ) : null}

            {section === "members" ? (
              <>
                <FilterSelect label="Party" value={party} onChange={setParty} options={filterOptions.parties} />
                <label className="directory-control">
                  <span>Funding</span>
                  <select className="pt-input px-3 py-2 text-sm" value={funding} onChange={(e) => setFunding(e.target.value)}>
                    <option value="all">All records</option>
                    <option value="with">With funding</option>
                    <option value="without">Without funding</option>
                  </select>
                </label>
              </>
            ) : null}

            {section === "pacs" ? (
              <>
                <FilterSelect label="Committee type" value={committeeType} onChange={setCommitteeType} options={filterOptions.committeeTypes} />
                <FilterSelect label="Party" value={committeeParty} onChange={setCommitteeParty} options={filterOptions.committeeParties} />
              </>
            ) : null}

            {section === "bills" ? (
              <>
                <FilterSelect label="Chamber" value={chamber} onChange={setChamber} options={filterOptions.chambers} />
                <FilterSelect label="Type" value={billType} onChange={setBillType} options={filterOptions.billTypes} />
                <FilterSelect label="Congress" value={congress} onChange={setCongress} options={filterOptions.congresses} />
                <label className="directory-control">
                  <span>Linked vote</span>
                  <select className="pt-input px-3 py-2 text-sm" value={linkedVote} onChange={(e) => setLinkedVote(e.target.value)}>
                    <option value="all">All bills</option>
                    <option value="with">Has linked vote</option>
                    <option value="without">No linked vote</option>
                  </select>
                </label>
              </>
            ) : null}

            {section === "congressTrades" ? (
              <FilterSelect label="Transaction" value={transactionType} onChange={setTransactionType} options={filterOptions.transactionTypes} />
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="pt-muted text-xs">
              Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} matches
            </span>
            {hasActiveFilter ? (
              <button type="button" className="pt-button-secondary px-3 py-1.5 text-xs" onClick={resetFilters}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {loading ? <p className="pt-muted text-sm">Loading {meta.label} index…</p> : null}
        {error ? <p className="pt-muted text-sm">{error}</p> : null}
        {!loading && !error && filtered.length === 0 ? (
          <div className="pt-panel p-4 text-sm">
            <strong>No {meta.singular} records match these filters.</strong>
            <p className="pt-muted mt-1">Try clearing a filter or using a broader search term.</p>
          </div>
        ) : null}

        <div className="directory-results">
          {visible.map((entry) => {
            const detailHref = DETAIL_HREF[section]?.(entry.id) ?? entry.href ?? `/${section}/${entry.id.toLowerCase()}`;
            const amount = money(entry.amount);
            return (
              <Link
                key={`${entry.id}-${entry.datasetPath}`}
                href={detailHref}
                className="pt-panel directory-row px-3 py-3 text-sm hover:border-[var(--ink)]"
                style={{ textDecoration: "none", color: "var(--ink)" }}
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{entry.label}</strong>
                  <span className="pt-muted block text-xs">{entry.summary ?? entry.id}</span>
                </span>
                <span className="directory-meta pt-muted text-xs">
                  {amount ?? [entry.committeeType, entry.transactionDate ?? entry.voteDate, entry.rollCallNumber ? `Roll call ${entry.rollCallNumber}` : null, entry.tags?.slice(0, 2).join(" · ")].filter(Boolean)[0] ?? entry.id}
                </span>
              </Link>
            );
          })}
        </div>

        {visible.length < filtered.length ? (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              className="pt-button-secondary px-4 py-2 text-sm"
              onClick={() => setVisibleLimit((current) => current + 200)}
            >
              Show 200 more
            </button>
          </div>
        ) : null}

        <div className="caveat mt-4">
          <span className="badge">Source</span>
          <div>{sourceNote(manifest, section)}</div>
        </div>
      </SectionCard>
    </main>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="directory-control">
      <span>{label}</span>
      <select className="pt-input px-3 py-2 text-sm" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="all">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default DirectoryPage;
