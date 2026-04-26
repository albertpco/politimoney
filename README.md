# PolitiMoney

Open-source public-record intelligence for American government. Pulls campaign finance, lobbying, congressional votes, government contracts, and related public records into a local dataset you can browse, export as a static feed, or query with AI.

**The core idea:** clone this repo, add two free API keys, run the pipeline, and ask Claude, Codex, ChatGPT, or your own LLM questions like "Rank all PACs by total receipts" or "How did funding align with the vote on the latest defense bill?" backed by real FEC filings and congressional records.

## For AI agents (drop-in)

Any LLM client that speaks MCP can query this dataset. After `npm install` and one pipeline run (see Quick start below), point your client at `npm run mcp:server` and you get 27 stdio tools over local JSON — no database, no network calls at query time.

**System-prompt blurb** — paste this into your model/agent so it uses the tools well:

> You have MCP access to PolitiMoney, a local dataset of US campaign finance, congressional votes, lobbying, federal contracts, and SEC insider trades built from public records (FEC, Congress.gov, FARA, USASpending, SEC, LDA, Census/CDC). Prefer `get_pac_rankings`, `rank_entities`, and `analyze_vote_funding` over free-text search — they return complete ranked lists. Call `get_latest_ingest_summary` first if you need to know what cycle/date the data covers. Data is objective and ranked: when a user asks "is X the biggest?", show the full ranking, not just X. Every number comes from a linkable public filing; never assert motive, loyalty, or causality beyond what the records show.

**Client configs:**

<details><summary>Claude Desktop — <code>claude_desktop_config.json</code></summary>

```json
{
  "mcpServers": {
    "politimoney": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/absolute/path/to/politimoney"
    }
  }
}
```
</details>

<details><summary>Claude Code — <code>.mcp.json</code> in the repo root (or <code>~/.claude.json</code>)</summary>

```json
{
  "mcpServers": {
    "politimoney": {
      "type": "stdio",
      "command": "npm",
      "args": ["run", "mcp:server"]
    }
  }
}
```
</details>

<details><summary>Cursor — <code>.cursor/mcp.json</code></summary>

```json
{
  "mcpServers": {
    "politimoney": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/absolute/path/to/politimoney"
    }
  }
}
```
</details>

<details><summary>Codex CLI / generic MCP stdio client</summary>

```bash
# Any MCP-compatible client can spawn this directly:
cd /absolute/path/to/politimoney && npm run mcp:server
```
</details>

<details><summary>ChatGPT / non-MCP models — JSON feed fallback</summary>

```bash
npm run feed:export     # → dist/public-feed/latest/*.json
```

Upload the feed directory (or host on R2/S3) and point your tool/function-calling schema at the JSON files directly.
</details>

**Good first questions to verify it's working:**
- "What cycle is loaded? Call `get_latest_ingest_summary`."
- "Rank the top 10 PACs by independent expenditures." → `get_pac_rankings`
- "Show the funding split on the latest House defense vote." → `analyze_vote_funding`

**Known gotchas:**
- `search_entities` uses simple tokenization over ~600 indexed bills — for bills, prefer fetching by ID (`119-HR-1`) via `analyze_vote_funding` or `get_bills_lobbied`.
- `rank_entities` currently only supports `metric: "total_receipts"`.
- 2026 cycle is partial (FEC API pagination); 2024 is the complete bulk dataset.

---

## Quick start

```bash
git clone https://github.com/albertpco/politimoney.git
cd politimoney
npm install

# Add your API keys (both are free)
cp .env.example .env.local
# Edit .env.local with your keys:
#   FEC_API_KEY     — https://api.open.fec.gov/developers/
#   CONGRESS_API_KEY — https://api.congress.gov/sign-up/

# Pull the data
npm run ingest            # Fetch and normalize public source data

# Optional: parse locally cached FEC bulk ZIP files from data/ingest/bulk-cache
npm run parse:bulk

# Browse it
npm run dev               # http://localhost:3000
```

## Public data feed

The hosted site should not ship raw bulk data to every visitor. Export the
portable, route-sized feed and publish it to R2 or another static object store:

```bash
npm run feed:export
```

The default output is `dist/public-feed/latest`. See
[Cloudflare Data Feed](docs/CLOUDFLARE-DATA-FEED.md) for the Pages + R2
deployment shape.

Build the Cloudflare Pages shell:

```bash
npm run cf:check
```

The shell output is `dist/cloudflare`; the feed output is separate and should be
published to R2 or another object store.

## Hosted beta refresh

The public beta can be refreshed by GitHub Actions with
`.github/workflows/refresh-cloudflare-beta.yml`. It runs weekly by default and
can also be started manually from the Actions tab.

Required repository secrets:

- `FEC_API_KEY`
- `CONGRESS_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The workflow runs `npm run beta:refresh`, which ingests, validates source
artifacts, builds the curated Pages beta feed, and validates the deployable feed
before publishing `dist/cloudflare` to the `politimoney` Cloudflare Pages
project. Change the cron to daily once the feed and page contracts settle.

For a manual weekly refresh from this machine:

```bash
npm run beta:refresh
wrangler pages deploy dist/cloudflare --project-name politimoney --branch main --commit-dirty=true
```

## Browser surfaces

This repo intentionally contains both browser surfaces for now:

- `cloudflare/`: the recommended public deployment target. It is a static
  Vite/React shell that reads the exported feed and can run cheaply on
  Cloudflare Pages.
- `src/app/`: the richer Next.js reference app. It remains useful for local
  development, route/API experiments, and validating page behavior while the
  Cloudflare shell reaches feature parity.

The stable core is the public ingestion pipeline, generated JSON artifacts,
feed export, and MCP tools. Contributors should avoid adding data logic that
only works inside one browser framework.

## Use with Claude or Codex (MCP)

The MCP server exposes 27 tools over stdio — no database needed, everything reads from the local JSON files.

```bash
npm run mcp:server
```

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "politimoney": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "/path/to/politimoney"
    }
  }
}
```

Then ask Claude things like:

- "Who are the top funded members of Congress?"
- "Rank all PACs by total receipts"
- "How did funding align with the vote on the latest appropriations bill?"
- "Compare California and Texas on education outcomes"
- "Show me the top federal contractors by award amount"

### Available MCP tools

| Tool | What it does |
|------|-------------|
| `search_entities` | Full-text search across members, committees, bills, donors |
| `rank_entities` | Rank members, committees, or donors by total receipts |
| `get_funding_profile` | Full funding breakdown for a member of Congress |
| `get_candidate_financials` | FEC financial summary for a candidate |
| `get_donor_profile` | Contribution history for a specific donor |
| `search_donors` | Find donors by name |
| `get_recent_contributions` | Latest contributions to a committee |
| `get_committee_recipients` | Where a PAC's money goes |
| `get_pac_rankings` | Rank all PACs by receipts, disbursements, or IE spend |
| `get_independent_expenditures` | Independent expenditure filings |
| `get_member_votes` | Recent vote positions for a member |
| `analyze_vote_funding` | Compare funding across yes/no vote groups on a bill |
| `get_bills_lobbied` | Bills that a lobbying client targeted |
| `get_lobbying_clients` | Top lobbying clients ranked by spend |
| `get_lobbying_by_client` | Lobbying filings for a specific client |
| `get_lobbyist_contributions` | Lobbyist contributions linked to a member |
| `get_top_contractors` | Top federal contractors by award amount |
| `get_contracts_by_company` | Federal contracts for a specific company |
| `get_insider_trades` | SEC Form 4 insider trades by company |
| `get_insider_trade_rankings` | Rank companies by insider trading volume |
| `get_congress_trade_disclosures` | Congressional stock trades (STOCK Act) |
| `get_recent_contributions` | Latest real-time FEC eFiling contributions |
| `compare_states` | Side-by-side state outcome metrics |
| `get_state_outcome` | Single state dashboard (poverty, fertility, mortality, etc.) |
| `get_latest_ingest_summary` | What data is currently loaded |
| `get_launch_summary` | Pre-computed homepage rankings |
| `export_dataset` | Export any dataset as JSON |
| `run_ingest_pipeline` | Trigger a full data pull (local only) |

## Data sources

All data is public record:

| Source | What | URL |
|--------|------|-----|
| FEC | Campaign contributions, committees, candidates, PACs | https://www.fec.gov/data/ |
| FEC Bulk | Historical bulk filings (58M+ individual contributions for 2024) | https://www.fec.gov/data/browse-data/?tab=bulk-data |
| Congress.gov | Bills, roll-call votes, member records | https://api.congress.gov/ |
| Senate.gov | Senate roll-call vote XML | https://www.senate.gov/legislative/votes.htm |
| FARA | Foreign agent registrations | https://efile.fara.gov/ |
| USASpending | Federal contracts | https://api.usaspending.gov/ |
| SEC | Form 4 insider trades | https://efts.sec.gov/ |
| Senate LDA | Lobbying disclosures | https://lda.senate.gov/ |
| Census/CDC | State-level poverty, mortality, demographics | https://data.census.gov/ |

## Architecture

```
Data Sources (FEC, Congress, FARA, USASpending, SEC, LDA, Census)
  → Ingestion pipeline (src/lib/ingest/pipeline.ts)
    → JSON artifacts (data/ingest/latest/*.json)
      → Public feed (dist/public-feed/latest) ← upload to R2/object storage
      → Cloudflare shell    ← recommended public browser
      → Web UI (Next.js)    ← reference/dev browser
      → MCP server (stdio)  ← query from Claude/Codex
```

No database required. The entire site runs from JSON files generated by the pipeline. PostgreSQL is optional for paginating the 58M+ individual donor records.

## Project values

Public officials owe their duty to the Constitution, the country, and the people they represent. PolitiMoney does not label motives, loyalties, or intent. It gives users the records needed to evaluate whether funding, votes, lobbying, contracts, and outcomes align with that duty.

This tool provides objective, ranked data. It never singles out any group. A question like "Is [PAC name] the biggest lobby?" should show all available PACs ranked so users can see the full picture. PolitiMoney counters narratives with complete, inspectable records.

See [Project Stance](docs/PROJECT-STANCE.md) for the claim boundary, [Architecture](docs/ARCHITECTURE.md) for the system map, [Roadmap](docs/ROADMAP.md) for current priorities, [Testing Strategy](docs/TESTING-STRATEGY.md) for the coverage model, and [Design System](docs/DESIGN-SYSTEM.md) for the civic evidence-first interface rules.

## All commands

```bash
npm run dev               # Next.js dev server
npm run build             # Production build
npm run cf:dev            # Static Cloudflare shell dev server
npm run cf:build          # Build static Cloudflare shell
npm run cf:build:beta     # Experimental: build shell with curated Pages beta feed
npm run cf:check          # Export feed and build static shell
npm run lint              # ESLint

# Data pipeline
npm run ingest            # Full pipeline pull (all sources)
npm run ingest:status     # Check latest ingestion status
npm run parse:bulk        # Parse FEC bulk ZIP files → JSON
npm run fetch:votes       # Fetch congressional votes
npm run fetch:financials  # Fetch candidate financials
npm run fetch:lobbying    # Fetch lobbying disclosures
npm run fetch:efilings    # Fetch real-time FEC eFilings
npm run fetch:insider-trades  # Fetch SEC Form 4 insider trades
npm run feed:export       # Export route-sized public JSON feed

# MCP server
npm run mcp:server        # Start stdio MCP server

# Database (optional)
npm run db:generate       # Prisma generate
npm run db:push           # Prisma db push
npm run db:migrate        # Prisma migrate dev
npm run db:studio         # Prisma studio
```

## Contributing

1. Fork and clone
2. `cp .env.example .env.local` and add your API keys
3. `npm install && npm run ingest`
4. `npm run dev` to verify things work
5. Open a PR

Read [CONTRIBUTING.md](CONTRIBUTING.md) before adding sources, pages, or MCP
tools. Contributions should keep claims source-linked and avoid motive,
loyalty, or unsupported causality assertions.

## License

MIT
