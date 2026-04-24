# PolitiMoney Design System

PolitiMoney should feel like a public-record intelligence desk: civic, dense,
source-aware, and calm under scrutiny. The interface should help users inspect
records, rankings, evidence, and uncertainty without implying motive or
partisan narrative.

## Visual Direction

- Civic, not bureaucratic.
- Sharp, not sensational.
- Dense enough for repeated research use.
- Evidence-first: tables, provenance, caveats, and source links should feel
  native to the product.
- Restrained color: color identifies source, status, risk, and emphasis. It
  should not decorate empty space.

## Tokens

Core tokens live in `src/app/globals.css`.

- `--background`: page field.
- `--foreground`: main text.
- `--surface`, `--surface-raised`, `--surface-soft`, `--surface-muted`: page,
  panels, and table surfaces.
- `--line`, `--line-strong`: borders and structural dividers.
- `--civic`: primary command and navigation color.
- `--accent`: evidence/source emphasis.
- `--danger`, `--warning`, `--success`: data state colors.
- `--source`: source and evidence links.

Shared component classes:

- `pt-card`: repeated item or framed data surface.
- `pt-panel`: lower-emphasis evidence, summary, or control panel.
- `pt-table`, `pt-table-head`: data tables.
- `pt-kicker`, `pt-title`, `pt-muted`: typography roles.
- `pt-link`: source and route links.
- `pt-button-primary`, `pt-button-secondary`, `pt-input`: controls.
- `pt-badge`: compact status labels.

## Component Rules

- Use cards for repeated records, metric tiles, and framed tools.
- Use page sections and dividers for layout structure.
- Keep radii small, usually `6px` or `8px`.
- Prefer visible source trails over decorative explanatory copy.
- Empty states must say whether the issue is no result, no data, stale data, or
  partial coverage.
- Claims about funding, voting, lobbying, contracts, or outcomes need source or
  methodology context nearby.

## Page Archetypes

- **Hub:** search-first overview with major workflows and current data coverage.
- **Directory:** sortable/scannable table with filters and clear row actions.
- **Entity detail:** title, identity metadata, evidence summary, provenance,
  caveats, then tables and rankings.
- **Vote/detail analysis:** vote facts first, member breakdown second, funding
  association third, causality caveat always visible.
- **Methodology/reference:** plain text, source inventory, update rules, and
  known gaps.

## Copy Standard

Use direct public-record language:

- Prefer "linked receipts" over "influence".
- Prefer "funding association" over "caused by".
- Prefer "records show" over "proves".
- Prefer "coverage unavailable" over "unknown" when the source is absent.

The product can be pointed. It stays defensible by showing the basis.
