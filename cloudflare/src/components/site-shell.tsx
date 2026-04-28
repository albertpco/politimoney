import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Link from "./link";
import {
  AiContextProvider,
  buildPromptFromContext,
  useAiContextValue,
} from "../lib/ai-context";

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
            href="/mcp"
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
            MCP setup
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

function useAiPromptForPage() {
  const pathname = usePathname();
  const ctx = useAiContextValue();
  const url = typeof window === "undefined" ? pathname : window.location.href;
  return buildPromptFromContext(pathname, url, ctx);
}

const AI_TOOL_ICON: Record<string, ReactNode> = {
  ChatGPT: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M22.282 9.821a6 6 0 0 0-.516-4.91a6.05 6.05 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a6 6 0 0 0-3.998 2.9a6.05 6.05 0 0 0 .743 7.097a5.98 5.98 0 0 0 .51 4.911a6.05 6.05 0 0 0 6.515 2.9A6 6 0 0 0 13.26 24a6.06 6.06 0 0 0 5.772-4.206a6 6 0 0 0 3.997-2.9a6.06 6.06 0 0 0-.747-7.073M13.26 22.43a4.48 4.48 0 0 1-2.876-1.04l.141-.081l4.779-2.758a.8.8 0 0 0 .392-.681v-6.737l2.02 1.168a.07.07 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085l4.783 2.759a.77.77 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646M2.34 7.896a4.5 4.5 0 0 1 2.366-1.973V11.6a.77.77 0 0 0 .388.677l5.815 3.354l-2.02 1.168a.08.08 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.08.08 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667m2.01-3.023l-.141-.085l-4.774-2.782a.78.78 0 0 0-.785 0L9.409 9.23V6.897a.07.07 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.8.8 0 0 0-.393.681zm1.097-2.365l2.602-1.5l2.607 1.5v2.999l-2.597 1.5l-2.607-1.5Z"
      />
    </svg>
  ),
  Claude: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="m4.714 15.956l4.718-2.648l.079-.23l-.08-.128h-.23l-.79-.048l-2.695-.073l-2.337-.097l-2.265-.122l-.57-.121l-.535-.704l.055-.353l.48-.321l.685.06l1.518.104l2.277.157l1.651.098l2.447.255h.389l.054-.158l-.133-.097l-.103-.098l-2.356-1.596l-2.55-1.688l-1.336-.972l-.722-.491L2 6.223l-.158-1.008l.656-.722l.88.06l.224.061l.893.686l1.906 1.476l2.49 1.833l.364.304l.146-.104l.018-.072l-.164-.274l-1.354-2.446l-1.445-2.49l-.644-1.032l-.17-.619a3 3 0 0 1-.103-.729L6.287.133L6.7 0l.995.134l.42.364l.619 1.415L9.735 4.14l1.555 3.03l.455.898l.243.832l.09.255h.159V9.01l.127-1.706l.237-2.095l.23-2.695l.08-.76l.376-.91l.747-.492l.583.28l.48.685l-.067.444l-.286 1.851l-.558 2.903l-.365 1.942h.213l.243-.242l.983-1.306l1.652-2.064l.728-.82l.85-.904l.547-.431h1.032l.759 1.129l-.34 1.166l-1.063 1.347l-.88 1.142l-1.263 1.7l-.79 1.36l.074.11l.188-.02l2.853-.606l1.542-.28l1.84-.315l.832.388l.09.395l-.327.807l-1.967.486l-2.307.462l-3.436.813l-.043.03l.049.061l1.548.146l.662.036h1.62l3.018.225l.79.522l.473.638l-.08.485l-1.213.62l-1.64-.389l-3.825-.91l-1.31-.329h-.183v.11l1.093 1.068l2.003 1.81l2.508 2.33l.127.578l-.321.455l-.34-.049l-2.204-1.657l-.85-.747l-1.925-1.62h-.127v.17l.443.649l2.343 3.521l.122 1.08l-.17.353l-.607.213l-.668-.122l-1.372-1.924l-1.415-2.168l-1.141-1.943l-.14.08l-.674 7.254l-.316.37l-.728.28l-.607-.461l-.322-.747l.322-1.476l.388-1.924l.316-1.53l.285-1.9l.17-.632l-.012-.042l-.14.018l-1.432 1.967l-2.18 2.945l-1.724 1.845l-.413.164l-.716-.37l.066-.662l.401-.589l2.386-3.036l1.439-1.882l.929-1.086l-.006-.158h-.055L4.138 18.56l-1.13.146l-.485-.456l.06-.746l.231-.243l1.907-1.312Z"
      />
    </svg>
  ),
  Gemini: (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68q.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58a12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68q-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96q2.19.93 3.81 2.55t2.55 3.81"
      />
    </svg>
  ),
  Copy: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  Copied: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
};

function AiDock() {
  const prompt = useAiPromptForPage();
  const encodedPrompt = encodeURIComponent(prompt);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(prompt);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = prompt;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const linkTools = [
    {
      label: "ChatGPT",
      href: `https://chatgpt.com/?q=${encodedPrompt}`,
      title: "Open this page with ChatGPT (prompt is pre-filled)",
    },
    {
      label: "Claude",
      href: `https://claude.ai/new?q=${encodedPrompt}`,
      title: "Open this page with Claude (prompt is pre-filled)",
    },
    {
      label: "Gemini",
      href: "https://gemini.google.com/app",
      title: "Open Gemini — use the Copy button first to grab the prompt",
    },
  ];

  return (
    <aside className="ai-dock" aria-label="Open this page with an AI assistant">
      <div className="ai-dock-header">
        <span className="ai-dock-title">Open with</span>
        <button
          type="button"
          onClick={handleCopy}
          className="ai-dock-copy"
          aria-label="Copy prompt to clipboard"
          title="Copy prompt — paste into any model"
        >
          {copied ? AI_TOOL_ICON.Copied : AI_TOOL_ICON.Copy}
          <span>{copied ? "Copied" : "Copy"}</span>
        </button>
      </div>
      <div className="ai-dock-actions">
        {linkTools.map((tool) => (
          <a
            key={tool.label}
            href={tool.href}
            target="_blank"
            rel="noopener noreferrer"
            className="ai-dock-button"
            aria-label={tool.title}
            title={tool.title}
          >
            {AI_TOOL_ICON[tool.label]}
            <span>{tool.label}</span>
          </a>
        ))}
      </div>
    </aside>
  );
}

function ContextFilterBar() {
  return (
    <div className="pt-panel mb-4 flex flex-wrap items-center gap-2 px-3 py-2 text-xs">
      <span className="pt-kicker">Quick Starts</span>
      {[
        ["Top PACs", "/pacs"],
        ["Members", "/members"],
        ["Bills", "/bills"],
        ["Compare states", "/compare"],
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
    <AiContextProvider>
      <TopNav />
      <div className="mx-auto w-full max-w-7xl px-4 py-4">
        <Breadcrumbs />
        <ContextFilterBar />
        {children}
      </div>
      <AiDock />
      <footer className="pt-shell mt-10 border-t">
        <div className="pt-muted mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs">
          <p>Public record browser. Nonpartisan. Source-linked.</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/methodology">Methodology</Link>
            <Link href="/mcp">Open Source + MCP</Link>
            <Link href="/methodology/legal-context">Legal Context</Link>
            <Link href="/data-coverage/sources">Source Inventory</Link>
            <Link href="/data-coverage/changelog">Changelog</Link>
          </div>
        </div>
      </footer>
    </AiContextProvider>
  );
}
