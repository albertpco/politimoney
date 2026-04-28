/**
 * Dormant runner for the market-data scaffolding (short interest, FTD, quotes).
 * Not part of the main ingestion pipeline — exists so the scaffolding can be
 * exercised manually before being wired in.
 *
 * Usage: npx tsx src/scripts/fetch-market-data.ts
 */

import { loadEnvConfig } from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ingestFinraShortInterest } from "@/lib/ingest/providers/finra-short-interest";
import { ingestFinraFtd } from "@/lib/ingest/providers/finra-ftd";
import { ingestYahooQuotes } from "@/lib/ingest/providers/yahoo-quotes";

loadEnvConfig(process.cwd());

const DEFAULT_TICKERS = ["AAPL", "MSFT", "NVDA"];

async function main() {
  const tickers = DEFAULT_TICKERS;
  console.log(`Fetching market data for: ${tickers.join(", ")}`);

  const [shortInterest, ftd, quotes] = await Promise.all([
    ingestFinraShortInterest({ tickers }),
    ingestFinraFtd({ tickers }),
    ingestYahooQuotes({ tickers }),
  ]);

  const snapshot = {
    fetchedAt: new Date().toISOString(),
    tickers,
    shortInterest: {
      data: shortInterest.data,
      warnings: shortInterest.warnings,
    },
    ftd: {
      data: ftd.data,
      warnings: ftd.warnings,
    },
    quotes: {
      data: quotes.data,
      warnings: quotes.warnings,
    },
  };

  const outDir = path.join(process.cwd(), "data", "ingest", "latest");
  await mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "market-data-snapshot.json");
  await writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf8");

  console.log(`\nResults:`);
  console.log(`  Short interest rows: ${shortInterest.data.length} (warnings: ${shortInterest.warnings.length})`);
  console.log(`  FTD rows: ${ftd.data.length} (warnings: ${ftd.warnings.length})`);
  console.log(`  Quote rows: ${quotes.data.length} (warnings: ${quotes.warnings.length})`);
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
