# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Next.js dev server on port 3000
npm run build            # Production build
npm run lint             # ESLint (eslint-config-next, core-web-vitals + typescript)

# Ingestion pipeline (requires FEC_API_KEY and CONGRESS_API_KEY in .env.local)
npm run ingest           # Full pipeline pull (uses --max-old-space-size=8192)
npm run ingest:status    # Check latest ingestion status
npm run parse:bulk       # Parse FEC bulk files to JSON
npm run fetch:votes      # Fetch congressional votes
npm run fetch:financials # Fetch candidate financials
npm run fetch:lobbying   # Fetch lobbying disclosures
npm run fetch:efilings   # Fetch real-time FEC eFilings
npm run fetch:insider-trades # Fetch SEC Form 4 insider trades

# Database (PostgreSQL via Docker container politimoney-postgres on port 5432)
npm run db:generate      # prisma generate
npm run db:push          # prisma db push
npm run db:migrate       # prisma migrate dev
npm run db:studio        # prisma studio

# MCP server (stdio transport for Claude Desktop)
npm run mcp:server
```

npm run test             # Vitest smoke tests
npm run test:watch       # Vitest watch mode

## Architecture

**Path C: Static JSON site with optional Postgres.** The app runs entirely from JSON files in `data/ingest/latest/` (21+ files). PostgreSQL is optional for deep drill-down queries. The repository layer tries Prisma first, falls back to JSON reads.

### Core Data Flow

```
Data Sources (FEC, Congress, FARA, USASpending, SEC, LDA, Census/CDC)
  → Ingestion Pipeline (src/lib/ingest/pipeline.ts)
    → JSON artifacts (data/ingest/latest/*.json)
    → Optional: PostgreSQL persist (src/lib/db/ingest-writer.ts)
      → Derived artifacts (launch summary, vote-funding, funding read models)
```

### Key Files

- **`src/lib/ingest/pipeline.ts`** — Orchestrates 7 data source pulls in sequence: FEC → FARA → Congress → Outcomes → USASpending → SEC → LDA
- **`src/lib/ingest/storage.ts`** — JSON file read/write layer with in-memory cache
- **`src/lib/data/repository.ts`** (~2300 lines) — Data access layer with ~30 async functions, each tries Prisma then falls back to JSON (with `warnFallback` logging)
- **`src/lib/format.ts`** — Shared formatting utilities (fmtCompact, fmtMoney, toProperCase, normalizeParty)
- **`src/lib/mcp/register-tools.ts`** — MCP tool registration (26 tools), shared between stdio and HTTP transports
- **`src/scripts/mcp-server.ts`** — Stdio MCP server entry point
- **`src/app/api/mcp/route.ts`** — HTTP MCP endpoint (stateless, optional `MCP_BEARER_TOKEN` auth)
- **`src/components/ui-primitives.tsx`** — Core UI components (MetricCard, TableExplorer, StateValueMap, etc.)

### Routing

All routes are App Router pages. Entity pages: `/bills/[id]`, `/members/[id]`, `/pacs/[id]`, `/states/[id]`, `/votes/house/[id]`, `/votes/senate/[id]`, `/donors/[id]`, `/lobbying/[id]`, `/contracts/[id]`, `/countries/[id]`, `/insider-trades/[id]`. Content pages: `/methodology`, `/data-coverage`, `/compare`, `/influence`, `/outcomes`, `/briefs`, `/instrumentation`. Legacy `/explore/*` routes redirect via `/explore/[[...slug]]`. The catch-all `[...path]` returns 404.

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

Copy `.env.example` to `.env.local`. Required keys for full pipeline: `FEC_API_KEY`, `CONGRESS_API_KEY`. Database: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/politimoney` with `INGEST_DB_WRITE=true`.

## Project Values

This tool provides objective, ranked data — never singling out any group. Questions like "Is X the biggest lobby?" should show ALL entities ranked so users can see the full picture. The tool counters narratives with complete ranked data.

## Tech Stack

Next.js 16, React 19, Prisma 6, Tailwind CSS 4, TypeScript (strict), `@modelcontextprotocol/sdk`, `papaparse` (CSV), `yauzl` (ZIP). Path alias: `@/*` → `./src/*`.
