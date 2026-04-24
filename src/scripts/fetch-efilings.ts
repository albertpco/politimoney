/**
 * Fetch recent FEC eFilings (real-time itemized contributions) and save to
 * data/ingest/latest/fec.recent-efilings.json.
 *
 * Usage: npx tsx src/scripts/fetch-efilings.ts [--days 30] [--limit 10000]
 */

import { loadEnvConfig } from "@next/env";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { ingestRecentEfilings } from "@/lib/ingest/providers/fec";
import { saveRecentEfilings } from "@/lib/ingest/storage";

loadEnvConfig(process.cwd());

const LATEST_DIR = path.join(process.cwd(), "data", "ingest", "latest");

function parseArg(name: string, fallback: number): number {
  const idx = process.argv.indexOf(name);
  if (idx === -1 || idx + 1 >= process.argv.length) return fallback;
  const parsed = Number.parseInt(process.argv[idx + 1], 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function main() {
  const apiKey = process.env.FEC_API_KEY ?? null;
  if (!apiKey) {
    console.error("FEC_API_KEY not set in .env");
    process.exit(1);
  }

  const daysBack = parseArg("--days", 30);
  const limit = parseArg("--limit", 10000);

  console.log(`Fetching eFilings from the last ${daysBack} days (limit ${limit})...`);
  await mkdir(LATEST_DIR, { recursive: true });

  const result = await ingestRecentEfilings({ apiKey, daysBack, limit });

  if (result.warnings.length) {
    for (const w of result.warnings) console.warn(`  ⚠ ${w}`);
  }

  await saveRecentEfilings(result.efilings);

  const totalAmount = result.efilings.reduce((sum, e) => sum + e.amount, 0);
  const fmtAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(totalAmount);

  console.log(`  → ${result.efilings.length} eFilings totaling ${fmtAmount}`);
  console.log("Done! Written to data/ingest/latest/fec.recent-efilings.json");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
