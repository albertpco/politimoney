# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

The repo has two halves:

1. **`cloudflare/`** — the **live public site** (Vite SPA, React Router, deployed on Cloudflare Pages). This is the user-facing app; touch this for any UI/UX work.
2. **`src/`** — the **ingest + feed-export layer** (Next.js project + tsx scripts). Pulls public data sources, writes JSON artifacts, and exports the static feed the SPA consumes. Also hosts the MCP server entry point.

The Next.js app under `src/app/` is legacy from before the Cloudflare port (commits `1cd8ac1`, `febac95`) and is not deployed. New UI work goes in `cloudflare/`.

## Commands

```bash
# Cloudflare SPA (the live site)
npm run cf:dev           # Vite dev server (serves dist/public-feed/latest at /data/latest)
npm run cf:build         # Production SPA build
npm run cf:preview       # Preview the production build locally
npm run cf:build:beta    # feed:export → cf:build → stage to beta
npm run cf:check         # cf:build:beta → feed:validate:beta

# Public feed (what the SPA reads)
npm run feed:export      # Exports JSON feed from data/ingest/latest into dist/public-feed/latest
npm run feed:validate:beta

# Lint / test
npm run lint             # ESLint
npm run test             # Vitest smoke tests
npm run test:watch

# Ingestion pipeline (requires FEC_API_KEY and CONGRESS_API_KEY in .env.local)
npm run ingest           # Full pipeline pull (uses --max-old-space-size=8192)
npm run ingest:status
npm run ingest:validate
npm run beta:refresh     # ingest → validate → cf:build:beta → feed:validate:beta
npm run parse:bulk
npm run fetch:votes
npm run fetch:financials
npm run fetch:lobbying
npm run fetch:efilings
npm run fetch:insider-trades

# Database (PostgreSQL via Docker container politimoney-postgres on port 5432; optional)
npm run db:generate
npm run db:push
npm run db:migrate
npm run db:studio

# MCP server (stdio transport for Claude Desktop and other MCP clients)
npm run mcp:server

# Legacy Next.js app (not deployed; kept for reference + ingest API routes)
npm run dev
npm run build
npm run start
```

## Architecture

**Static-feed site.** The Cloudflare SPA reads JSON artifacts produced by the ingest pipeline. PostgreSQL is optional for ingest-side drill-down; the SPA never talks to a database.

### Data Flow

```
Data Sources (FEC, Congress, FARA, USASpending, SEC, LDA, Census/CDC)
  → Ingestion Pipeline (src/lib/ingest/pipeline.ts)
    → JSON artifacts (data/ingest/latest/*.json)
    → Optional: PostgreSQL persist (src/lib/db/ingest-writer.ts)
      → feed:export → dist/public-feed/latest/*.json
        → Cloudflare SPA fetches at /data/latest/*.json
```

### Cloudflare SPA (live site)

- **`cloudflare/src/main.tsx`** — Router. Routes: `/`, `/members`, `/members/:id`, `/states/:id`, `/votes/house/:id`, `/votes/senate/:id`, `/pacs/:id`, `/donors/:id`, `/bills/:id`, `/congress-trades/:id`, `/search`, `/compare`, `/methodology/*`, `/data-coverage/*`, `/mcp`.
- **`cloudflare/src/components/site-shell.tsx`** — TopNav, Breadcrumbs, ContextFilterBar, AiDock (floating bottom-right LLM handoff).
- **`cloudflare/src/components/politired-surfaces.tsx`** — `AiHandoffPanel`, `QueryHero`, fact-check panels.
- **`cloudflare/src/components/ui-primitives.tsx`** — `MetricCard`, `TableExplorer`, `FundingSourceBreakdown`, `StateValueMap`, `VoteBreakdownBar`, etc.
- **`cloudflare/src/lib/feed.ts`** — Loaders for the static feed.
- **`cloudflare/src/pages/*.tsx`** — One page component per route.
- **`cloudflare/src/styles.css`** — All styles (Tailwind + custom). The `.ai-dock` floating widget is here.

### Ingest + feed (src/)

- **`src/lib/ingest/pipeline.ts`** — Orchestrates 7 data source pulls in sequence: FEC → FARA → Congress → Outcomes → USASpending → SEC → LDA
- **`src/lib/ingest/storage.ts`** — JSON file read/write layer with in-memory cache
- **`src/lib/data/repository.ts`** (~2300 lines) — Data access layer with ~30 async functions, each tries Prisma then falls back to JSON (with `warnFallback` logging). Used by the legacy Next.js app and MCP tools.
- **`src/lib/format.ts`** — Shared formatting utilities (fmtCompact, fmtMoney, toProperCase, normalizeParty)
- **`src/lib/mcp/register-tools.ts`** — MCP tool registration (26 tools), shared between stdio and HTTP transports
- **`src/scripts/mcp-server.ts`** — Stdio MCP server entry point
- **`src/scripts/export-public-feed.ts`** — Builds the static feed the SPA reads
- **`src/scripts/stage-pages-beta-feed.ts`** — Stages the feed into the Cloudflare Pages build
- **`src/app/api/mcp/route.ts`** — HTTP MCP endpoint (legacy Next.js, stateless, optional `MCP_BEARER_TOKEN` auth)

### Ingestion Providers

Located in `src/lib/ingest/providers/`:
- `fec.ts` — FEC API (current cycle, paginated)
- `fec-bulk/` — FEC bulk ZIP files (historical cycles, pipe-delimited with backpressure: high-water 10K, low-water 1K)
- `congress.ts` + `senate-roll-calls.ts` — Congress.gov API + Senate XML votes
- `fara.ts` — Foreign agent registrations
- `outcomes.ts` — Census + CDC state-level metrics
- `usaspending.ts` — Federal contracts
- `lda.ts` — Senate lobbying disclosures
- `sec-insider.ts` — SEC Form 4 insider trades
- `congress-trades.ts` — House STOCK Act disclosures

### FEC Bulk File Conventions

- Pipe-delimited ZIPs use UPPERCASE columns (`CAND_ID`, `CMTE_ID`)
- Independent expenditure CSV uses lowercase abbreviated names (`spe_id`, `exp_amo`)
- Electioneering/Communication CSVs use UPPERCASE full names (`COMMITTEE_ID`)
- `webl` (lobbyist PACs) uses `SEN_CAN_ID` / `HOUSE_CAN_ID`, not `CAND_ID`
- Bulk contributions stored in `RawFecContribution.payload` (JSONB) — 59M+ rows

## Environment Setup

Copy `.env.example` to `.env.local`. Required keys for full ingest pipeline: `FEC_API_KEY`, `CONGRESS_API_KEY`. Database (optional): `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/politimoney` with `INGEST_DB_WRITE=true`. The Cloudflare SPA needs no env vars at runtime — it reads from `/data/latest/*.json`.

## Project Values

This tool provides objective, ranked data — never singling out any group. Questions like "Is X the biggest lobby?" should show ALL entities ranked so users can see the full picture. The tool counters narratives with complete ranked data.

## Tech Stack

- **SPA (`cloudflare/`)**: Vite 7, React 19, React Router 7, Tailwind CSS 4, TypeScript (strict).
- **Ingest / legacy (`src/`)**: Next.js 16, Prisma 6, `@modelcontextprotocol/sdk`, `papaparse` (CSV), `yauzl` (ZIP), `pdfjs-dist`.
- Path alias: `@/*` → `./src/*` (legacy Next.js only). The Cloudflare SPA uses relative imports.
