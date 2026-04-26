import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type DatasetKey = "members" | "pacs" | "donors" | "bills" | "votes" | "states" | "congressTrades";

type FeedManifest = {
  schemaVersion: number;
  generatedAt: string;
  runId?: string;
  source: { note: string };
  datasets: Record<DatasetKey, { path: string; count: number; description: string }>;
  caveats: string[];
};

type FeedEntry = {
  id: string;
  label: string;
  href: string;
  datasetPath: string;
  summary?: string;
  amount?: number;
  tags?: string[];
};

type DetailPayload = {
  entityType: string;
  caveats?: string[];
  [key: string]: unknown;
};

const FEED_BASE =
  import.meta.env.VITE_POLITIMONEY_FEED_BASE_URL ||
  import.meta.env.VITE_POLITIRED_FEED_BASE_URL ||
  "/data/latest";
const SECTIONS: DatasetKey[] = ["members", "pacs", "donors", "bills", "votes", "states", "congressTrades"];
const SECTION_META: Record<DatasetKey, { label: string; singular: string; search: string }> = {
  members: { label: "Members", singular: "member", search: "Search by name, chamber, party, or state" },
  pacs: { label: "PACs", singular: "PAC", search: "Search by committee, sponsor, or funding note" },
  donors: { label: "Donors", singular: "donor", search: "Search by donor, amount, or source tag" },
  bills: { label: "Bills", singular: "bill", search: "Search by bill number, title, or policy area" },
  votes: { label: "Votes", singular: "vote", search: "Search by bill, roll call, chamber, or result" },
  states: { label: "States", singular: "state", search: "Search by state name or code" },
  congressTrades: { label: "Congress Trades", singular: "trade", search: "Search by member, ticker, asset, state, or transaction type" },
};

function money(value?: number) {
  if (!Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value as number);
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${FEED_BASE}/${path.replace(/^\//, "")}`);
  if (!response.ok) throw new Error(`Failed to fetch ${path}: ${response.status}`);
  return response.json() as Promise<T>;
}

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash || "#/");

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || "#/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const [section, id] = hash.replace(/^#\/?/, "").split("/");
  return {
    section: SECTIONS.includes(section as DatasetKey) ? (section as DatasetKey) : undefined,
    id: id ? decodeURIComponent(id) : undefined,
  };
}

function aiPrompt(entry?: FeedEntry, detail?: DetailPayload) {
  const target = entry
    ? `${entry.label} (${entry.id})`
    : "this PolitiMoney public-record feed";
  const context = detail
    ? JSON.stringify(detail).slice(0, 2200)
    : "Use the manifest and relevant JSON records from the PolitiMoney feed.";
  return `Analyze ${target} using only public-record evidence. Separate facts from inference, cite the fields used, and do not assert motive, loyalty, or causation without direct evidence.\n\nContext:\n${context}`;
}

function aiLinks(prompt: string) {
  const encoded = encodeURIComponent(prompt);
  return [
    { label: "ChatGPT", href: `https://chat.openai.com/?q=${encoded}` },
    { label: "Claude", href: `https://claude.ai/new?q=${encoded}` },
    { label: "Gemini", href: `https://gemini.google.com/app?q=${encoded}` },
  ];
}

function factRows(entry?: FeedEntry, detail?: DetailPayload) {
  const rows = [
    ["Record ID", entry?.id],
    ["Entity type", detail?.entityType],
    ["Feed path", entry?.datasetPath],
    ["Amount", entry?.amount ? money(entry.amount) : undefined],
    ["Tags", entry?.tags?.join(", ")],
  ];
  return rows.filter((row): row is [string, string] => typeof row[1] === "string" && row[1].length > 0);
}

function Header({ manifest }: { manifest?: FeedManifest }) {
  return (
    <header className="site-header">
      <a className="brand" href="#/">
        <span className="brand-mark">PT</span>
        <span>
          <strong>PolitiMoney</strong>
          <small>public-record feed browser</small>
        </span>
      </a>
      <nav aria-label="Primary navigation">
        {SECTIONS.map((section) => (
          <a key={section} href={`#/${section}`}>
            {SECTION_META[section].label}
            {manifest ? <span>{manifest.datasets[section].count.toLocaleString()}</span> : null}
          </a>
        ))}
      </nav>
    </header>
  );
}

function Home({ manifest }: { manifest?: FeedManifest }) {
  return (
    <main className="stack">
      <section className="hero">
        <div>
          <p className="kicker">Open, inspectable, reproducible</p>
          <h1>American public records, packaged for humans and LLMs.</h1>
          <p>
            This shell reads a static JSON feed. It does not need a hosted
            database, and it avoids pushing raw bulk files to every visitor.
          </p>
          <div className="actions">
            <a className="button primary" href="#/members">Browse members</a>
            <a className="button secondary" href={`${FEED_BASE}/manifest.json`}>Open manifest</a>
          </div>
        </div>
        <aside className="hero-card">
          <p className="kicker">Feed status</p>
          <dl>
            <div>
              <dt>Generated</dt>
              <dd>{manifest ? new Date(manifest.generatedAt).toLocaleString() : "Loading manifest"}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{manifest?.runId ?? (manifest ? "static export" : "Loading manifest")}</dd>
            </div>
            <div>
              <dt>Contract</dt>
              <dd>manifest → index → detail JSON</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="grid">
        {SECTIONS.map((section) => (
          <a className="section-card" href={`#/${section}`} key={section}>
            <span className="kicker">{SECTION_META[section].label}</span>
            <strong>{manifest?.datasets[section].count.toLocaleString() ?? "—"} records</strong>
            <p>{manifest?.datasets[section].description ?? "Loading feed metadata."}</p>
          </a>
        ))}
      </section>

      <section className="notice">
        <h2>Claim Boundary</h2>
        {(manifest?.caveats ?? [
          "Records show public filings and official actions.",
          "The feed does not assert motive, loyalty, or causation.",
        ]).map((caveat) => (
          <p key={caveat}>{caveat}</p>
        ))}
      </section>
    </main>
  );
}

function Directory({
  section,
  manifest,
  onSelect,
}: {
  section: DatasetKey;
  manifest?: FeedManifest;
  onSelect: (entry: FeedEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<{
    entries: FeedEntry[];
    error?: string;
    loading: boolean;
  }>({ entries: [], loading: true });

  useEffect(() => {
    let cancelled = false;
    const indexPath = manifest?.datasets[section].path ?? `indexes/${section}.json`;
    fetchJson<FeedEntry[]>(indexPath)
      .then((entries) => {
        if (!cancelled) setState({ entries, loading: false });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            entries: [],
            error: err instanceof Error ? err.message : "Failed to load index",
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manifest, section]);

  const filtered = state.entries.filter((entry) => {
    const haystack = `${entry.label} ${entry.id} ${entry.summary ?? ""} ${entry.tags?.join(" ") ?? ""}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const visible = filtered.slice(0, 200);
  const sectionLabel = SECTION_META[section].label;

  return (
    <main className="stack">
      <section className="page-title">
        <p className="kicker">Dataset</p>
        <h1>{sectionLabel}</h1>
        <p>{manifest?.datasets[section].description ?? "Loading index metadata."}</p>
      </section>

      <div className="toolbar">
        <input
          aria-label={`Search ${sectionLabel}`}
          placeholder={SECTION_META[section].search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>
          Showing {visible.length.toLocaleString()} of {filtered.length.toLocaleString()} matches
        </span>
      </div>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.loading ? <p className="notice">Loading {sectionLabel} index...</p> : null}
      {!state.loading && !state.error && filtered.length === 0 ? (
        <p className="notice">No {SECTION_META[section].singular} records match this search in the beta subset.</p>
      ) : null}
      {filtered.length > visible.length ? (
        <p className="notice">This beta page renders the first {visible.length.toLocaleString()} matches. Narrow the search or use the manifest for the full staged index.</p>
      ) : null}

      <section className="result-list">
        {visible.map((entry) => (
          <a
            href={`#/${section}/${encodeURIComponent(entry.id.toLowerCase())}`}
            className="result-row"
            key={`${entry.id}-${entry.datasetPath}`}
            onClick={() => onSelect(entry)}
          >
            <span>
              <strong>{entry.label}</strong>
              <small>{entry.summary ?? entry.id}</small>
            </span>
            <span className="row-meta">
              {entry.amount ? money(entry.amount) : entry.tags?.slice(0, 2).join(" · ")}
            </span>
          </a>
        ))}
      </section>
    </main>
  );
}

function Detail({
  section,
  id,
  selected,
  manifest,
}: {
  section: DatasetKey;
  id: string;
  selected?: FeedEntry;
  manifest?: FeedManifest;
}) {
  const [state, setState] = useState<{
    detail?: DetailPayload;
    entry?: FeedEntry;
    error?: string;
    loading: boolean;
  }>({ entry: selected, loading: true });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let resolved = selected;
      if (!resolved || resolved.id.toLowerCase() !== id.toLowerCase()) {
        const indexPath = manifest?.datasets[section].path ?? `indexes/${section}.json`;
        const entries = await fetchJson<FeedEntry[]>(indexPath);
        resolved = entries.find((candidate) => candidate.id.toLowerCase() === id.toLowerCase());
      }
      if (!resolved) throw new Error(`No ${section} record found for ${id}`);
      const detail = await fetchJson<DetailPayload>(resolved.datasetPath);
      if (!cancelled) setState({ entry: resolved, detail, loading: false });
    };

    load().catch((err: unknown) => {
      if (!cancelled) {
        setState({
          entry: selected,
          error: err instanceof Error ? err.message : "Failed to load detail",
          loading: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [id, manifest, section, selected]);

  const prompt = aiPrompt(state.entry, state.detail);
  const rows = factRows(state.entry, state.detail);

  return (
    <main className="stack">
      <a className="back-link" href={`#/${section}`}>Back to {SECTION_META[section].label}</a>
      <section className="page-title detail-title">
        <div>
          <p className="kicker">Record detail</p>
          <h1>{state.entry?.label ?? id}</h1>
          <p>{state.entry?.summary ?? "Route-sized JSON detail from the public feed."}</p>
        </div>
        <div className="ai-links">
          {state.entry && state.detail ? (
            aiLinks(prompt).map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
                Ask {link.label}
              </a>
            ))
          ) : (
            <span className="subtle-note">AI links appear after the record loads.</span>
          )}
        </div>
      </section>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.loading ? <p className="notice">Loading detail record…</p> : null}

      <section className="notice">
        <h2>What This Does Not Prove</h2>
        {(state.detail?.caveats ?? ["This record is public context, not a motive or causation claim."]).map((caveat) => (
          <p key={caveat}>{caveat}</p>
        ))}
      </section>

      {rows.length > 0 ? (
        <section className="fact-card">
          <h2>Record Facts</h2>
          <dl className="fact-grid">
            {rows.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="json-card">
        <div>
          <h2>Source JSON</h2>
          <a href={state.entry ? `${FEED_BASE}/${state.entry.datasetPath}` : "#/"}>Open raw record</a>
        </div>
        <pre>{state.detail ? JSON.stringify(state.detail, null, 2) : "Loading..."}</pre>
      </section>
    </main>
  );
}

function App() {
  const [manifest, setManifest] = useState<FeedManifest>();
  const [selected, setSelected] = useState<FeedEntry>();
  const [error, setError] = useState<string>();
  const route = useHashRoute();

  useEffect(() => {
    fetchJson<FeedManifest>("manifest.json")
      .then(setManifest)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Failed to load manifest"));
  }, []);

  return (
    <>
      <Header manifest={manifest} />
      {error ? <main className="stack"><p className="error">{error}</p></main> : null}
      {!route.section ? (
        <Home manifest={manifest} />
      ) : route.id ? (
        <Detail section={route.section} id={route.id} selected={selected} manifest={manifest} />
      ) : (
        <Directory section={route.section} manifest={manifest} onSelect={setSelected} />
      )}
      <footer>
        <span>PolitiMoney reads public records. It does not assert motive or causation.</span>
        <a href={`${FEED_BASE}/manifest.json`}>Manifest</a>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
