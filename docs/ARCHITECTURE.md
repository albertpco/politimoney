# Architecture

PolitiMoney is a local-first public-record data kit with two browser surfaces:
a low-cost static Cloudflare shell for public hosting, and a richer Next.js
reference app for development and feature exploration. The ingestion, read
model, feed export, and MCP layers are the stable core.

## System Shape

```text
Official public sources
  -> ingestion providers in src/lib/ingest/providers/
  -> JSON artifacts in data/ingest/latest/
  -> repository/read-model layer in src/lib/data/
  -> public feed export in dist/public-feed/latest/
  -> Cloudflare Pages shell, Next.js reference app, and MCP tools
```

PostgreSQL is optional. Repository functions try Prisma when configured and then
fall back to JSON artifacts, which keeps local development and source inspection
usable without a database.

## Main Areas

- `src/app/`: Next.js App Router pages and API routes.
- `cloudflare/`: static Vite/React shell for Cloudflare Pages.
- `src/components/`: shared shell, page templates, and UI primitives.
- `src/lib/ingest/`: ingestion config, providers, storage, health reporting, and
  pipeline orchestration.
- `src/lib/data/`: repository functions, crosswalks, read models, and source
  provenance helpers.
- `src/lib/mcp/`: shared MCP tool registration for stdio and HTTP use.
- `src/scripts/`: CLI entry points for ingestion, MCP, and backfill tasks.
- `dist/public-feed/latest/`: generated route-sized feed output. Ignored by git.
- `dist/cloudflare/`: generated Cloudflare Pages shell output. Ignored by git.
- `prisma/`: optional database schema for large local datasets.
- `docs/`: project stance, testing strategy, design rules, architecture, and
  roadmap.

## Data Flow

1. CLI scripts or local tools call the ingestion pipeline.
2. Providers fetch official public records such as FEC, Congress.gov,
   Senate.gov, FARA, USASpending, SEC, Senate LDA, and state outcome sources.
3. Storage writes latest JSON artifacts and run summaries under `data/ingest/`.
4. Read models derive searchable and comparable views from the raw artifacts.
5. `npm run feed:export` writes a static manifest, indexes, and route-sized
   detail JSON for public hosting.
6. Repository functions return database-backed data when available, otherwise
   JSON-backed data.
7. Pages and MCP tools present records with comparable context, caveats, and
   source/provenance fields where available.

## Browser Strategy

Use one open-source repository for both browser surfaces:

- The Cloudflare shell is the recommended public deployment target. It reads the
  feed contract only: `manifest -> index -> detail JSON`.
- The Next.js app remains the reference implementation while the static shell
  reaches feature parity. It is useful for richer page experiments, route tests,
  API routes, and validating design/system decisions.
- Shared code should move toward ingestion, read models, feed export, MCP tools,
  and framework-neutral types. Avoid adding business logic that only works in
  one browser framework.

Do not serve raw FEC bulk files or full read-model dumps through the public
browser deploy. Publish route-sized artifacts to R2 or another object store.

## Evidence Boundary

Architecture should preserve the product stance:

- Public records are shown as records, not narrative conclusions.
- Comparative rankings are preferred over isolated examples.
- Missing, stale, or partial source coverage is a visible state.
- Source links, methods, and timestamps should travel with user-facing claims.
- Funding, lobbying, trades, contracts, votes, and outcomes may be associated in
  the record, but the app must not assert motive, loyalty, or causality without
  evidence that meets that standard.

## Adding Capabilities

- New public data source: add a provider, typed records, storage readers/writers,
  repository functions, fixtures, tests, and visible caveats.
- New page: use repository functions, shared page templates or primitives,
  metadata, empty states, and source/provenance context.
- New Cloudflare shell view: consume the public feed contract and keep route
  reads bounded to one index plus one detail JSON file.
- New MCP tool: register it in `src/lib/mcp/register-tools.ts`, validate inputs,
  return stable empty states, and include source-bearing results when possible.
- New database path: preserve JSON fallback behavior and add tests for both
  complete-data and degraded-data paths.
