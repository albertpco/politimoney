import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

type DatasetKey = "members" | "pacs" | "donors" | "bills" | "votes" | "states";

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

const FEED_BASE = import.meta.env.VITE_POLITIRED_FEED_BASE_URL || "/data/latest";
const SECTIONS: DatasetKey[] = ["members", "pacs", "donors", "bills", "votes", "states"];

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
            {section}
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
              <dd>{manifest ? new Date(manifest.generatedAt).toLocaleString() : "Loading"}</dd>
            </div>
            <div>
              <dt>Run</dt>
              <dd>{manifest?.runId ?? "local/static"}</dd>
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
            <span className="kicker">{section}</span>
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

  return (
    <main className="stack">
      <section className="page-title">
        <p className="kicker">Dataset</p>
        <h1>{section}</h1>
        <p>{manifest?.datasets[section].description ?? "Loading index metadata."}</p>
      </section>

      <div className="toolbar">
        <input
          aria-label={`Search ${section}`}
          placeholder={`Search ${section}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span>{filtered.length.toLocaleString()} visible</span>
      </div>

      {state.error ? <p className="error">{state.error}</p> : null}
      {state.loading ? <p className="notice">Loading {section} index…</p> : null}

      <section className="result-list">
        {filtered.slice(0, 200).map((entry) => (
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

function Detail({ section, id, selected }: { section: DatasetKey; id: string; selected?: FeedEntry }) {
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
        const entries = await fetchJson<FeedEntry[]>(`indexes/${section}.json`);
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
  }, [id, section, selected]);

  const prompt = aiPrompt(state.entry, state.detail);

  return (
    <main className="stack">
      <a className="back-link" href={`#/${section}`}>← Back to {section}</a>
      <section className="page-title detail-title">
        <div>
          <p className="kicker">Record detail</p>
          <h1>{state.entry?.label ?? id}</h1>
          <p>{state.entry?.summary ?? "Route-sized JSON detail from the public feed."}</p>
        </div>
        <div className="ai-links">
          {aiLinks(prompt).map((link) => (
            <a key={link.label} href={link.href} target="_blank" rel="noreferrer">
              Ask {link.label}
            </a>
          ))}
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
        <Detail section={route.section} id={route.id} selected={selected} />
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
