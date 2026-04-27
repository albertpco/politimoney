import { useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Link from "./link";

const NAV_ITEMS = [
  { href: "/search", label: "Search" },
  { href: "/members", label: "Members" },
  { href: "/pacs", label: "PACs" },
  { href: "/bills", label: "Bills" },
  { href: "/votes", label: "Votes" },
  { href: "/states", label: "States" },
  { href: "/compare", label: "Compare" },
];

function usePathname() {
  return useLocation().pathname;
}

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
    <header
      className="sticky top-0 z-30 border-b"
      style={{
        background: "color-mix(in oklab, var(--paper) 88%, transparent)",
        borderColor: "var(--line)",
        backdropFilter: "saturate(1.2) blur(8px)",
      }}
    >
      <div className="mx-auto flex w-full max-w-7xl items-center gap-5 px-4 py-3">
        <Link href="/" className="shrink-0">
          <span className="brand">
            Politi<span className="dot">·</span><span className="red">money</span>
          </span>
        </Link>
        <nav
          className="hidden items-center gap-4 md:flex"
          style={{ fontSize: 13, color: "var(--ink-2)" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-0 py-1.5"
                style={{
                  borderBottom: `1.5px solid ${active ? "var(--civic)" : "transparent"}`,
                  color: active ? "var(--ink)" : "var(--ink-2)",
                  fontWeight: active ? 500 : 400,
                  textDecoration: "none",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <form
            action="/search"
            className="hidden items-center gap-2 sm:flex"
            style={{
              background: "var(--paper-2)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r-md)",
              padding: "6px 10px",
              minWidth: 280,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--ink-3)" }}>
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L17 17" />
            </svg>
            <input
              name="q"
              placeholder="Search members, PACs, bills..."
              className="flex-1 bg-transparent outline-none"
              style={{ fontSize: 12.5, color: "var(--ink)" }}
            />
            <kbd
              style={{
                fontFamily: "var(--font-jetbrains-mono)",
                fontSize: 10,
                background: "var(--paper)",
                border: "1px solid var(--line-soft)",
                padding: "1px 5px",
                borderRadius: 3,
                color: "var(--ink-3)",
              }}
            >
              ⌘K
            </kbd>
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
          <Link
            href="/search?mcp=1"
            className="hidden items-center gap-1.5 sm:inline-flex"
            style={{
              background: "var(--ink)",
              color: "var(--paper)",
              padding: "6px 12px",
              borderRadius: "var(--r-md)",
              fontSize: 12.5,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <span
              style={{
                width: 6, height: 6, borderRadius: 999,
                background: "var(--money)",
                display: "inline-block",
              }}
            />
            MCP · Claude
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-md p-1.5 md:hidden"
            style={{ color: "var(--ink-2)" }}
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
        <nav
          className="px-4 py-3 md:hidden"
          style={{ borderTop: "1px solid var(--line-soft)" }}
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2 text-sm"
                  style={{
                    background: active ? "var(--civic-soft)" : "transparent",
                    color: active ? "var(--civic-ink)" : "var(--ink-2)",
                    fontWeight: active ? 600 : 500,
                  }}
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
              <button type="submit" className="pt-button-primary px-3 py-2 text-sm">
                Search
              </button>
            </form>
          </div>
        </nav>
      )}
    </header>
  );
}

function McpDock() {
  return (
    <Link href="/search?mcp=1" className="mcp-dock" aria-label="Ask about this page via MCP">
      <span className="led" />
      <span className="lbl">Ask about this page</span>
    </Link>
  );
}

function ContextFilterBar() {
  return (
    <div className="pt-panel mb-4 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="pt-kicker">Quick Starts</span>
      {[
        ["Rank all PACs by total receipts", "/search?q=Rank%20all%20PACs%20by%20total%20receipts"],
        ["Who are the top funded members of Congress?", "/search?q=Who%20are%20the%20top%20funded%20members%20of%20Congress%3F"],
        ["Compare California and Texas on outcomes", "/search?q=Compare%20California%20and%20Texas%20on%20outcomes"],
      ].map(([label, href]) => (
        <Link key={href} href={href} className="pt-button-secondary px-3 py-1 text-slate-700">
          {label}
        </Link>
      ))}
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <>
      <TopNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <Breadcrumbs />
        <ContextFilterBar />
        {children}
      </div>
      <McpDock />
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
