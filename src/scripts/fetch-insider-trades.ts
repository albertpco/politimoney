/**
 * Fetch SEC EDGAR Form 4 insider trading data.
 * Focuses on companies that appear in FEC data (have connected PACs),
 * plus the top insider-buying companies for broader coverage.
 *
 * Usage: npx tsx src/scripts/fetch-insider-trades.ts [--max-companies 30]
 */

import { loadEnvConfig } from "@next/env";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type {
  ContractorProfile,
  FecCommittee,
} from "@/lib/ingest/types";
import { ingestSecInsiderData } from "@/lib/ingest/providers/sec-insider";
import { saveInsiderTradeArtifacts } from "@/lib/ingest/storage";

loadEnvConfig(process.cwd());

const LATEST_DIR = path.join(process.cwd(), "data", "ingest", "latest");

async function readJsonOr<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(LATEST_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  const maxCompaniesArg = process.argv.find(
    (_, i) => process.argv[i - 1] === "--max-companies",
  );
  const maxCompanies = Number(maxCompaniesArg) || 30;

  console.log("Loading FEC committees and contractor data...");
  const committees = await readJsonOr<FecCommittee[]>("fec.committees.json", []);
  const contractors = await readJsonOr<ContractorProfile[]>(
    "usaspending.top-contractors.json",
    [],
  );
  console.log(
    `  ${committees.length} committees, ${contractors.length} contractors`,
  );

  console.log(
    `\nFetching SEC EDGAR Form 4 insider trades (max ${maxCompanies} companies)...`,
  );
  const result = await ingestSecInsiderData({
    committees,
    contractors,
    maxCompanies,
    filingsPerCompany: 10,
    includeTopBuyers: true,
  });

  console.log(`\nResults:`);
  console.log(`  Trades: ${result.trades.length}`);
  console.log(`  Companies: ${result.summaries.length}`);
  console.log(
    `  FEC-linked: ${result.summaries.filter((s) => s.fecCommitteeId).length}`,
  );
  console.log(
    `  Contractor-linked: ${result.summaries.filter((s) => s.contractorName).length}`,
  );
  console.log(`  Warnings: ${result.warnings.length}`);

  if (result.warnings.length > 0) {
    console.log("\nWarnings:");
    for (const w of result.warnings.slice(0, 20)) {
      console.log(`  - ${w}`);
    }
    if (result.warnings.length > 20) {
      console.log(`  ... and ${result.warnings.length - 20} more`);
    }
  }

  console.log("\nSaving artifacts...");
  await saveInsiderTradeArtifacts(result.trades, result.summaries);

  const tradeSize = Buffer.byteLength(
    JSON.stringify(result.trades),
    "utf8",
  );
  const summarySize = Buffer.byteLength(
    JSON.stringify(result.summaries),
    "utf8",
  );
  console.log(
    `  → sec.insider-trades.json (${(tradeSize / 1024).toFixed(1)} KB)`,
  );
  console.log(
    `  → sec.insider-trade-summaries.json (${(summarySize / 1024).toFixed(1)} KB)`,
  );

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
