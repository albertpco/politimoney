# Testing Strategy

PolitiMoney's credibility depends on predictable data behavior. Tests should make
sure the same question produces a traceable answer across JSON fallback mode,
optional database mode, sparse datasets, stale data, and malformed source input.

## Test Layers

- **Pure utilities:** formatting, route state parsing, vote grouping, state lookup,
  slug and ID normalization.
- **Ingest providers:** successful payloads, empty payloads, partial failures,
  malformed source fields, freshness metadata, and warning propagation.
- **Storage:** missing files, invalid JSON, schema drift, cache invalidation, and
  read/write round trips for latest and historical artifacts.
- **Read models:** required field presence, canonical entity IDs, source
  provenance, caveats, and related-entity links.
- **Repositories:** Prisma path, JSON fallback path, empty dataset behavior,
  ranking and sorting correctness, ID filters, cross-entity joins, and degraded
  optional datasets.
- **MCP tools:** tool registration, input validation, useful empty results,
  source-bearing responses, and export shape stability.
- **Pages:** metadata generation, not-found paths, redirect behavior, public
  route rendering, empty states, and mobile-safe component rendering.
- **UI primitives:** tables, evidence drawers, metrics, badges, state panels,
  pagination, sorting, and no-data states.

## Entity Matrix

Every major entity type should have at least one representative fixture and one
contract test:

- Members
- Committees and PACs
- Bills
- House votes
- Senate votes
- Donors
- States and outcomes
- Lobbying clients and filings
- Contracts and contractors
- SEC insider trades
- Congressional trade disclosures
- FARA registrants and foreign principals

## Required Behaviors

- Ranking functions must prove deterministic ordering and tie behavior.
- Repository functions must return stable empty values when optional data is
  absent.
- Entity detail paths must prove both found and not-found behavior.
- Source and provenance fields must stay attached to user-facing claims.
- Tests that require large local ingest artifacts must skip clearly, while
  deterministic fixture tests must always run in CI.

## Near-Term Priorities

1. Add deterministic fixture coverage for repositories that currently rely on
   local ingest volume.
2. Add route-level metadata and not-found tests for flagship detail pages.
3. Add provider-level tests for malformed and partial source payloads.
4. Add MCP contract tests for the public query surface.
5. Add visual/component tests after the design system is rebuilt.
