/**
 * Parse cached FEC bulk ZIP files into JSON artifacts.
 *
 * This script reads the already-downloaded bulk files from data/ingest/bulk-cache/{cycle}/
 * and writes structured JSON files to data/ingest/latest/. No database or API calls needed.
 *
 * Usage: npx tsx src/scripts/parse-bulk-to-json.ts [--cycle 2024]
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  ALL_CANDIDATES_COLUMNS,
  CANDIDATE_COMMITTEE_LINKAGE_COLUMNS,
  COMMITTEE_TO_CANDIDATE_COLUMNS,
  LOBBYIST_REGISTRANT_COLUMNS,
  PAC_SUMMARY_COLUMNS,
} from "@/lib/ingest/providers/fec-bulk/columns";
import { openZipEntryStream } from "@/lib/ingest/providers/fec-bulk/downloader";
import {
  mapCandidateCommitteeLinkRow,
  mapCandidateFinancialsRow,
  mapContributionRow,
  mapIndependentExpenditureRow,
  mapLeadershipPacLinkRow,
  mapPacSummaryRow,
} from "@/lib/ingest/providers/fec-bulk/mappers";
import {
  createFileStream,
  streamParseBulkFile,
  type ParsedRow,
} from "@/lib/ingest/providers/fec-bulk/parser";

const LATEST_DIR = path.join(process.cwd(), "data", "ingest", "latest");

const cycleArg = process.argv.find((a, i) => process.argv[i - 1] === "--cycle");
const cycle = Number(cycleArg) || 2024;
const yy = String(cycle).slice(-2);
const yyyy = String(cycle);
const cacheDir = path.join(process.cwd(), "data", "ingest", "bulk-cache", String(cycle));

async function parseSmallZip<T>(
  filename: string,
  columns: readonly string[],
  mapper: (row: ParsedRow) => T | null,
): Promise<T[]> {
  const zipPath = path.join(cacheDir, filename);
  const stream = await openZipEntryStream(zipPath);
  const results: T[] = [];
  for await (const row of streamParseBulkFile(stream, {
    delimiter: "|",
    columns,
    hasHeaders: false,
  })) {
    const mapped = mapper(row);
    if (mapped) results.push(mapped);
  }
  return results;
}

async function parseSmallCsv<T>(
  filename: string,
  mapper: (row: ParsedRow) => T | null,
): Promise<T[]> {
  const filePath = path.join(cacheDir, filename);
  const stream = createFileStream(filePath);
  const results: T[] = [];
  for await (const row of streamParseBulkFile(stream, {
    delimiter: ",",
    columns: [],
    hasHeaders: true,
  })) {
    const mapped = mapper(row);
    if (mapped) results.push(mapped);
  }
  return results;
}

async function writeJson(filename: string, data: unknown) {
  const filePath = path.join(LATEST_DIR, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  const size = Buffer.byteLength(JSON.stringify(data), "utf8");
  console.log(`  → ${filename} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

async function main() {
  console.log(`Parsing bulk files for cycle ${cycle} from ${cacheDir}\n`);
  await mkdir(LATEST_DIR, { recursive: true });

  // 1. Candidate financials (weball)
  console.log("Parsing candidate financials (weball)...");
  const candidateFinancials = await parseSmallZip(
    `weball${yy}.zip`,
    ALL_CANDIDATES_COLUMNS,
    mapCandidateFinancialsRow,
  );
  console.log(`  ${candidateFinancials.length} records`);
  await writeJson("fec.candidate-financials.json", candidateFinancials);

  // 2. PAC summaries (webk)
  console.log("Parsing PAC summaries (webk)...");
  const pacSummaries = await parseSmallZip(
    `webk${yy}.zip`,
    PAC_SUMMARY_COLUMNS,
    mapPacSummaryRow,
  );
  console.log(`  ${pacSummaries.length} records`);
  await writeJson("fec.pac-summaries.json", pacSummaries);

  // 3. Candidate-committee linkages (ccl)
  console.log("Parsing candidate-committee linkages (ccl)...");
  const links = await parseSmallZip(
    `ccl${yy}.zip`,
    CANDIDATE_COMMITTEE_LINKAGE_COLUMNS,
    mapCandidateCommitteeLinkRow,
  );
  console.log(`  ${links.length} records`);
  await writeJson("fec.candidate-committee-links.json", links);

  // 4. PAC-to-candidate contributions (pas2) — 703K rows, ~120MB JSON
  console.log("Parsing PAC-to-candidate contributions (pas2)...");
  const pacToCandidate = await parseSmallZip(
    `pas2${yy}.zip`,
    COMMITTEE_TO_CANDIDATE_COLUMNS,
    mapContributionRow,
  );
  console.log(`  ${pacToCandidate.length} records`);
  await writeJson("fec.pac-to-candidate.json", pacToCandidate);

  // 5. Leadership PAC links (webl)
  console.log("Parsing lobbyist/leadership PAC links (webl)...");
  const leadershipLinks = await parseSmallZip(
    `webl${yy}.zip`,
    LOBBYIST_REGISTRANT_COLUMNS,
    mapLeadershipPacLinkRow,
  );
  console.log(`  ${leadershipLinks.length} records`);
  await writeJson("fec.leadership-pac-links.json", leadershipLinks);

  // 6. Independent expenditures (CSV)
  console.log("Parsing independent expenditures...");
  const indepExp = await parseSmallCsv(
    `independent_expenditure_${yyyy}.csv`,
    mapIndependentExpenditureRow,
  );
  console.log(`  ${indepExp.length} records`);
  await writeJson("fec.independent-expenditures.json", indepExp);

  console.log("\nDone! All JSON artifacts written to data/ingest/latest/");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
