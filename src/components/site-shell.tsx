"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/search", label: "Search" },
  { href: "/members", label: "Members" },
  { href: "/pacs", label: "PACs" },
  { href: "/bills", label: "Bills" },
  { href: "/votes", label: "Votes" },
  { href: "/states", label: "States" },
  { href: "/compare", label: "Compare" },
];

type IngestHealth = {
  ok: boolean;
  isStale: boolean;
  latestFinishedAt?: string;
  latestRunId?: string;
  warningCount: number;
  message: string;
  sourceStatus: Record<string, { ok: boolean; records: number; error?: string }>;
};


function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    return { href, label: segment.replace(/-/g, " ") };
  });

  return (
    <nav aria-label="Breadcrumbs" className="pt-muted text-xs">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link className="pt-link" href="/">
            home
          </Link>
        </li>
        {crumbs.map((crumb) => (
          <li key={crumb.href} className="flex items-center gap-1">
            <span>/</span>
            <Link className="pt-link" href={crumb.href}>
              {crumb.label}
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <header className="pt-shell sticky top-0 z-30 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 px-4 py-2.5">
        <Link href="/" className="shrink-0">
          <span className="pt-title text-base">Politired</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "bg-[var(--civic)] text-white"
                    : "text-slate-700 hover:bg-[var(--surface-soft)]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <form action="/search" className="hidden items-center gap-2 sm:flex">
            <input
              name="q"
              placeholder="Search members, PACs, bills..."
              className="pt-input w-44 px-3 py-1.5 text-xs md:w-64"
            />
            <button
              type="submit"
              className="pt-button-primary px-3 py-1.5 text-xs"
            >
              Search
            </button>
          </form>
          <Link
            href="/search"
            className="pt-button-primary p-1.5 sm:hidden"
            aria-label="Search"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 text-slate-700 hover:bg-[var(--surface-soft)] md:hidden"
            aria-label="Toggle navigation"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
              {mobileOpen ? (
                <path d="M5 5l10 10M15 5L5 15" />
              ) : (
                <path d="M3 6h14M3 10h14M3 14h14" />
              )}
            </svg>
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="border-t border-[var(--line)] px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`rounded-md px-3 py-2 text-sm font-semibold ${
                    active ? "bg-[var(--civic)] text-white" : "text-slate-700 hover:bg-[var(--surface-soft)]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <form action="/search" className="mt-2 flex items-center gap-2">
              <input
                name="q"
                placeholder="Search members, PACs, bills..."
                className="pt-input flex-1 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="pt-button-primary px-3 py-2 text-sm"
              >
                Search
              </button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}

function IngestHealthBanner() {
  const [health, setHealth] = useState<IngestHealth | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadHealth = async () => {
      try {
        const response = await fetch("/api/ingest/health", { cache: "no-store" });
        if (!response.ok) throw new Error(`Health endpoint failed (${response.status})`);
        const payload = (await response.json()) as { computed?: IngestHealth };
        if (!active) return;
        setHealth(payload.computed ?? null);
        setError(null);
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "unknown error");
      }
    };

    loadHealth();
    const timer = window.setInterval(loadHealth, 120_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (error) {
    return (
      <div className="mb-3 rounded-md border border-[var(--danger)] bg-[var(--danger-soft)] px-3 py-2 text-xs text-slate-950">
        Data health unavailable: {error}
      </div>
    );
  }

  if (!health) {
    return (
      <div className="pt-panel mb-3 px-3 py-2 text-xs text-slate-700">
        Checking latest ingestion health...
      </div>
    );
  }

  const failingSources = Object.entries(health.sourceStatus).filter(
    ([, source]) => !source.ok,
  ).length;
  const tone =
    health.ok && health.warningCount === 0
      ? "border-[var(--success)] bg-[var(--success-soft)] text-slate-950"
      : health.isStale
        ? "border-[var(--danger)] bg-[var(--danger-soft)] text-slate-950"
        : "border-[var(--warning)] bg-[var(--warning-soft)] text-slate-950";
  const status =
    health.ok && health.warningCount === 0
      ? "Healthy"
      : health.isStale
        ? "Stale"
        : "Degraded";

  return (
      <div className={`mb-3 rounded-md border px-3 py-2 text-xs ${tone}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">Ingest status: {status}</span>
        <span>{health.message}</span>
        <span>
          Last run:{" "}
          {health.latestFinishedAt
            ? new Date(health.latestFinishedAt).toLocaleString()
            : "unknown"}
        </span>
        <span>Warnings: {health.warningCount}</span>
        <span>Failing sources: {failingSources}</span>
        <Link className="pt-link" href="/data-coverage/freshness">
          Freshness details
        </Link>
      </div>
    </div>
  );
}

function ContextFilterBar() {
  return (
    <div className="pt-panel mb-4 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="pt-kicker">
        Quick Starts
      </span>
      {[
        ["Rank all PACs by total receipts", "/search?q=Rank%20all%20PACs%20by%20total%20receipts"],
        ["Who are the top funded members of Congress?", "/search?q=Who%20are%20the%20top%20funded%20members%20of%20Congress%3F"],
        ["Compare California and Texas on outcomes", "/search?q=Compare%20California%20and%20Texas%20on%20outcomes"],
      ].map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="pt-button-secondary px-3 py-1 text-slate-700"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function ConditionalIngestBanner() {
  const pathname = usePathname();
  if (!pathname.startsWith("/data-coverage")) return null;
  return <IngestHealthBanner />;
}

export function SiteShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <ConditionalIngestBanner />
        <Breadcrumbs />
        <ContextFilterBar />
        {children}
      </div>
      <footer className="pt-shell mt-10 border-t">
        <div className="pt-muted mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs">
          <p>Public record browser. Nonpartisan. Source-linked.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/methodology">Methodology</Link>
            <Link href="/methodology/legal-context">Legal Context</Link>
            <Link href="/data-coverage/sources">Source Inventory</Link>
            <Link href="/data-coverage/changelog">Changelog</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
