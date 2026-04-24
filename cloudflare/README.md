# PolitiMoney Cloudflare Shell

This is the static Cloudflare Pages browser for the PolitiMoney public data feed.
It intentionally does not depend on Next.js server routes or a hosted database.

## Local Development

Export the feed:

```bash
npm run feed:export
```

Start the shell:

```bash
npm run cf:dev
```

Vite serves `dist/public-feed/latest` at `/data/latest` during local
development. The production build does not bundle the feed.

## Production

Build command:

```bash
npm run cf:build
```

Build output:

```text
dist/cloudflare
```

Set `VITE_POLITIMONEY_FEED_BASE_URL` to the R2/custom-domain feed base when the
feed is not mounted at `/data/latest`. The old `VITE_POLITIRED_FEED_BASE_URL`
name is still accepted for compatibility.

Example:

```bash
VITE_POLITIMONEY_FEED_BASE_URL=https://data.example.com/latest npm run cf:build
```

## Feed Contract

The browser loads:

1. `manifest.json`
2. one section index under `indexes/`
3. one detail JSON file under `members/`, `pacs/`, `donors/`, `bills/`,
   `votes/`, or `states/`

Do not put raw FEC bulk files in the browser deploy. Upload generated feed
artifacts to R2 or another object store.
