# Roadmap

PolitiMoney is an open-source public-record intelligence project. The roadmap is
organized around making records easier to ingest, verify, compare, and query
without adding motive, loyalty, or causality claims that the records do not
support.

## Current Focus

- Make Cloudflare Pages + R2 the recommended public deployment path.
- Keep the public feed route-sized so visitors do not download raw bulk data.
- Keep public pages source-linked, comparable, and explicit about coverage gaps.
- Improve deterministic test coverage for repository fallback, MCP tools, and
  public routes.
- Tighten ingestion health reporting so stale, partial, or failed sources are
  visible to users.
- Expand reusable fixtures for members, committees, bills, votes, donors,
  lobbying, contracts, trades, states, and FARA records.
- Keep the local-first setup usable without PostgreSQL while documenting the
  optional database path for large datasets.

## Near-Term Work

- Bring the Cloudflare shell to parity with the flagship Next pages.
- Add feed-contract tests for `manifest`, indexes, and representative detail
  records.
- Add R2 upload instructions or a GitHub Actions workflow for publishing feed
  snapshots.
- Add route-level contract tests for flagship entity pages and empty states.
- Add provider tests for malformed source payloads and partial upstream
  failures.
- Improve provenance display for source URLs, ingest timestamps, and data
  freshness across detail pages.
- Document generated artifact shapes for contributors adding repositories or MCP
  tools.
- Add contribution labels and issue triage conventions once issue volume
  requires them.

## Later Work

- Retire or demote the Next.js app once the Cloudflare shell covers the public
  browsing use case.
- Broaden public-record coverage where reliable official sources are available.
- Add repeatable release and data-refresh checklists.
- Add visual regression coverage for evidence-heavy tables and entity pages.
- Improve large-dataset performance for donor search and contribution exports.
- Publish example MCP prompts that ask comparative, source-grounded questions.

## Non-Goals

- No motive, loyalty, allegiance, or intent labels for public officials or
  private entities.
- No claims that funding, lobbying, registration, or contracts caused a vote or
  outcome unless that causal standard is independently met.
- No partisan scoring system presented as a source fact.
- No opaque rankings without source, method, freshness, and caveat context.
