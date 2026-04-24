# Contributing to PolitiMoney

Thanks for your interest in contributing. This guide will help you get set up
and oriented. Start with `docs/PROJECT-STANCE.md`, `docs/ARCHITECTURE.md`, and
`docs/ROADMAP.md` before proposing new data sources, pages, or MCP tools.

## Setup

```bash
git clone https://github.com/albertpco/politimoney.git
cd politimoney
npm install
cp .env.example .env.local
# Add FEC_API_KEY and CONGRESS_API_KEY (both free)
npm run dev
```

The recommended public deployment target is the static Cloudflare shell:

```bash
npm run feed:export
npm run cf:dev
```

Use `npm run dev` for the richer Next.js reference app. Use `npm run cf:dev`
when working on the production-oriented static browser.

For the full dataset, run the ingestion pipeline:

```bash
npm run parse:bulk        # FEC bulk files → JSON
npm run fetch:votes       # Congressional roll calls
npm run fetch:financials  # Candidate financials
npm run fetch:lobbying    # Lobbying disclosures
```

Optional PostgreSQL (Docker):

```bash
docker run -d --name politimoney-postgres -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
# Set DATABASE_URL and INGEST_DB_WRITE=true in .env.local
npm run db:push
npm run ingest
```

## Project structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── bills/, members/, pacs/   # Entity detail pages
│   ├── donors/, lobbying/, ...   # Explore entity pages
│   ├── methodology/, compare/    # Content pages
│   └── api/mcp/                  # HTTP MCP endpoint
├── lib/
│   ├── data/                     # Data access layer (Prisma → JSON fallback)
│   │   ├── repository.ts         # Main repository (~30 async functions)
│   │   ├── member-repository.ts  # Member-specific queries
│   │   ├── bill-repository.ts    # Bill-specific queries
│   │   ├── vote-repository.ts    # Vote-specific queries
│   │   └── ...
│   ├── ingest/                   # Data ingestion pipeline
│   │   ├── pipeline.ts           # Orchestrator (FEC → FARA → Congress → ...)
│   │   ├── storage.ts            # JSON file I/O with in-memory cache
│   │   └── providers/            # Per-source data fetchers
│   ├── mcp/                      # MCP server tools (26 tools)
│   └── format.ts                 # Shared formatting utilities
├── components/
│   ├── ui-primitives.tsx         # Core UI components (TableExplorer, MetricCard, etc.)
│   ├── site-shell.tsx            # App shell with nav/footer
│   └── page-templates/           # Reusable page layouts
└── scripts/                      # CLI entry points
cloudflare/
├── src/                           # Static feed browser for Cloudflare Pages
├── vite.config.ts                 # Local feed proxy and production build
└── public/                        # Static headers/favicon
```

## Key patterns

### Repository fallback

Every data function tries Prisma first, then falls back to JSON files in `data/ingest/latest/`. This lets the app run without a database:

```typescript
export async function getLatestBillsRepository() {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const bills = await prisma.bill.findMany();
      if (bills.length) return bills;
    } catch (error) {
      warnFallback("getLatestBillsRepository", error);
    }
  }
  return readCongressBills(); // JSON fallback
}
```

### Adding a new page

1. Create `src/app/your-route/page.tsx`
2. Import data from `@/lib/data/repository` or the domain-specific repository
3. Import UI from `@/components/ui-primitives`
4. Add `export const revalidate = 3600;` for ISR caching
5. Add `generateMetadata()` for SEO

### Adding a Cloudflare shell view

1. Read from `manifest.json`, one section index, and one detail JSON file
2. Keep the route usable without a database or Next.js server route
3. Preserve caveats and source/provenance fields from the feed
4. Avoid loading raw bulk files or whole-dataset dumps in the browser

### Adding an MCP tool

1. Add the repository function in `src/lib/data/repository.ts`
2. Register the tool in `src/lib/mcp/register-tools.ts`:

```typescript
server.registerTool(
  "your_tool_name",
  {
    description: "What this tool does",
    inputSchema: z.object({ param: z.string() }),
  },
  async ({ param }) => {
    const result = await yourRepositoryFunction(param);
    return asTextResult({ ok: true, result });
  },
);
```

### Adding a data source

1. Create a provider in `src/lib/ingest/providers/`
2. Add types to `src/lib/ingest/types.ts`
3. Wire it into `src/lib/ingest/pipeline.ts`
4. Add JSON read/write functions to `src/lib/ingest/storage.ts`

## Running tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```

Tests use [Vitest](https://vitest.dev). Smoke tests verify repository fallback behavior and MCP tool registration. Add tests alongside source files as `*.test.ts`.

See `docs/TESTING-STRATEGY.md` before adding a new data source, repository function, MCP tool, or public page. New behavior should generally prove both the complete-data path and the degraded-data path.

## Code style

- TypeScript strict mode
- ESLint with `next/core-web-vitals` + `typescript`
- Tailwind CSS 4 for styling
- No component library — UI primitives in `src/components/ui-primitives.tsx`
- Cloudflare shell styles live in `cloudflare/src/styles.css` and should stay
  framework-light and feed-driven

Run `npm run lint`, `npm test`, and `npm run cf:check` before submitting
changes that affect ingestion, feed export, or the static browser.

## Project values

This tool provides objective, ranked data and inspectable source trails. Questions like "Is X the biggest lobby?" should show all available comparable entities ranked so users see the full picture. The product may show funding, lobbying, voting, contracting, and outcome records; it should not assert motive, loyalty, or causality unless the evidence standard actually supports that claim.

Read `docs/PROJECT-STANCE.md` for the civic principle and claim boundary,
`docs/ARCHITECTURE.md` for data flow and repository boundaries,
`docs/ROADMAP.md` for near-term priorities, and `docs/DESIGN-SYSTEM.md` before
changing shared UI or page templates.

## Pull requests

- Keep PRs focused on a single concern
- Add `generateMetadata()` to any new detail pages
- Test that JSON fallback works (run without `DATABASE_URL`)
- Run `npm run lint` and `npm test`
