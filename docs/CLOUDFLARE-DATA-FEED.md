# Cloudflare Data Feed Deployment

PolitiMoney should publish a lightweight evidence browser and a portable public
data feed. The web host should not be the database, and users should be able to
regenerate the data locally from public APIs with their own keys.

## Target Shape

- Cloudflare Pages serves the static browser shell.
- Cloudflare R2 stores generated JSON feed artifacts under versioned prefixes.
- Cloudflare Workers can proxy small filtered reads, manifests, and MCP-over-HTTP.
- Heavy ingestion runs outside request handling: GitHub Actions, a local cron,
  a cheap VM, or another scheduled runner.
- PostgreSQL remains optional for local/deep donor pagination. It is not a
  launch requirement for the public site.

## Export The Feed

Run the ingest or targeted fetch commands first, then export route-sized JSON:

```bash
npm run feed:export
```

By default this writes to:

```text
dist/public-feed/latest
```

Override the destination when needed:

```bash
POLITIMONEY_FEED_OUT_DIR=/tmp/politimoney-feed/latest npm run feed:export
```

The exporter creates:

- `manifest.json`
- `indexes/members.json`
- `indexes/pacs.json`
- `indexes/donors.json`
- `indexes/bills.json`
- `indexes/votes.json`
- `indexes/states.json`
- per-entity JSON files under `members/`, `pacs/`, `donors/`, `bills/`,
  `votes/`, and `states/`

The feed intentionally excludes raw FEC bulk contribution files by default.
Those files are for local regeneration and power users, not every web visit.

## R2 Layout

Recommended object paths:

```text
politimoney-feed/
  latest/manifest.json
  latest/indexes/*.json
  latest/members/*.json
  latest/pacs/*.json
  latest/donors/*.json
  latest/bills/*.json
  latest/votes/**/*.json
  latest/states/*.json
  runs/{runId}/...
```

Keep `latest/` for the public browser and preserve immutable `runs/{runId}/`
snapshots for reproducibility.

## Browser Read Pattern

The public browser should load:

1. `manifest.json`
2. one small index for the current section
3. one detail JSON file when a route opens

It should not load raw contribution files or full data dumps on page load.

## Cloudflare Pages Shell

The static shell lives in `cloudflare/`.

```bash
npm run feed:export
npm run cf:dev
npm run cf:build
```

Pages build command:

```bash
npm run cf:build
```

Pages output directory:

```text
dist/cloudflare
```

If the feed is mounted on a separate R2 custom domain, set:

```text
VITE_POLITIMONEY_FEED_BASE_URL=https://your-feed-domain/latest
```

For local development, Vite serves `dist/public-feed/latest` at `/data/latest`
without copying the full feed into the deploy output.

For a first beta without R2, build a curated Pages feed:

```bash
npm run cf:build:beta
```

`cf:build:beta` is intentionally partial: it stages a curated Pages feed for
the public beta and should not be treated as the complete export.

This copies a bounded subset of the generated feed into
`dist/cloudflare/data/latest`. It is useful for getting online quickly, but the
full generated feed should move to R2 once the public data surface grows.

## Scheduled Refresh

The repo includes `.github/workflows/refresh-cloudflare-beta.yml` for the hosted
beta. It is intentionally conservative:

- weekly schedule by default
- manual `workflow_dispatch` trigger
- configurable `beta_feed_limit` input for manual runs
- source-artifact validation after ingestion
- feed validation before deploy so empty critical datasets do not overwrite the
  public beta
- deploys the curated Pages feed directly to the `politimoney` Pages project

Required GitHub repository secrets:

- `FEC_API_KEY`
- `CONGRESS_API_KEY`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Use a Cloudflare API token that can deploy Pages projects in the target account.
When the full feed moves to R2, add an upload step before the Pages deploy and
set `VITE_POLITIMONEY_FEED_BASE_URL` to the R2/custom-domain `latest` prefix.

For a manual refresh without R2:

```bash
npm run beta:refresh
wrangler pages deploy dist/cloudflare --project-name politimoney --branch main --commit-dirty=true
```

## Claim Boundary

Every published feed should preserve these caveats:

- Records show public filings and official actions.
- Funding, votes, lobbying, contracts, and outcomes are context, not proof of
  motive or causation.
- Users can inspect, rerun, and challenge the feed from public sources.

## Migration Note

The current Next.js app remains useful as the reference implementation while the
browser shell is ported to Cloudflare Pages. The data-feed contract above is the
stable boundary that makes the framework switch low risk.
