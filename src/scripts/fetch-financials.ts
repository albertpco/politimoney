/**
 * Fetch current-cycle candidate and committee financial totals from the FEC API.
 * Merges with existing bulk data (2024) to produce a combined view.
 *
 * Usage: npx tsx src/scripts/fetch-financials.ts [--cycle 2026]
 */

import { loadEnvConfig } from "@next/env";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fetchJson } from "@/lib/ingest/http";
import type { FecCandidateFinancials, FecPacSummary } from "@/lib/ingest/types";

loadEnvConfig(process.cwd());

const LATEST_DIR = path.join(process.cwd(), "data", "ingest", "latest");
const FEC_BASE = "https://api.open.fec.gov/v1";
const apiKey = process.env.FEC_API_KEY;

const cycleArg = process.argv.find((_, i) => process.argv[i - 1] === "--cycle");
const cycle = Number(cycleArg) || 2026;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function readJsonOr<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(LATEST_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(filename: string, data: unknown) {
  await writeFile(path.join(LATEST_DIR, filename), JSON.stringify(data, null, 2), "utf8");
  const size = Buffer.byteLength(JSON.stringify(data), "utf8");
  console.log(`  → ${filename} (${(size / 1024 / 1024).toFixed(1)} MB)`);
}

type FecTotalsApiRow = {
  candidate_id?: string;
  name?: string;
  party_full?: string;
  office?: string;
  state?: string;
  district?: string;
  district_number?: number;
  incumbent_challenge?: string;
  receipts?: number;
  disbursements?: number;
  cash_on_hand_end_period?: number | string;
  individual_itemized_contributions?: number;
  other_political_committee_contributions?: number;
  transfers_from_other_authorized_committee?: number;
  coverage_end_date?: string;
  election_year?: number;
};

type FecTotalsResponse = {
  results?: FecTotalsApiRow[];
  pagination?: { pages?: number; per_page?: number; count?: number; page?: number };
};

type FecCommitteeTotalsApiRow = {
  committee_id?: string;
  committee_name?: string;
  committee_type?: string;
  designation?: string;
  party_full?: string;
  receipts?: number;
  disbursements?: number;
  cash_on_hand_end_period?: number;
  independent_expenditures?: number;
  coverage_end_date?: string;
};

type FecCommitteeTotalsResponse = {
  results?: FecCommitteeTotalsApiRow[];
  pagination?: { pages?: number; per_page?: number; count?: number; page?: number };
};

async function fetchCandidateFinancials(targetCycle: number): Promise<FecCandidateFinancials[]> {
  if (!apiKey) throw new Error("FEC_API_KEY not set");

  const results: FecCandidateFinancials[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${FEC_BASE}/candidates/totals/?api_key=${apiKey}&cycle=${targetCycle}&per_page=100&page=${page}&sort=-receipts&is_active_candidate=true`;
    const resp = await fetchJson<FecTotalsResponse>(url);
    totalPages = resp.pagination?.pages ?? 1;

    for (const row of resp.results ?? []) {
      if (!row.candidate_id) continue;
      results.push({
        candidateId: row.candidate_id,
        name: row.name ?? row.candidate_id,
        party: row.party_full,
        incumbentChallenge: row.incumbent_challenge,
        totalReceipts: row.receipts,
        totalDisbursements: row.disbursements,
        cashOnHand: typeof row.cash_on_hand_end_period === "string"
          ? Number.parseFloat(row.cash_on_hand_end_period)
          : row.cash_on_hand_end_period,
        totalIndividualContributions: row.individual_itemized_contributions,
        otherCommitteeContributions: row.other_political_committee_contributions,
      });
    }

    console.log(`  Candidates page ${page}/${totalPages} (${results.length} so far)`);
    page++;
    if (page <= totalPages) await sleep(500);
  }

  return results;
}

async function fetchCommitteeFinancials(targetCycle: number): Promise<FecPacSummary[]> {
  if (!apiKey) throw new Error("FEC_API_KEY not set");

  const results: FecPacSummary[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const url = `${FEC_BASE}/committee/totals/?api_key=${apiKey}&cycle=${targetCycle}&per_page=100&page=${page}&sort=-receipts&min_receipts=1000`;
    let resp: FecCommitteeTotalsResponse;
    try {
      resp = await fetchJson<FecCommitteeTotalsResponse>(url);
    } catch (err) {
      // The committee totals endpoint may not support cycle filtering the same way
      // Fall back to committees endpoint
      console.log(`  Committee totals API error on page ${page}, stopping: ${err instanceof Error ? err.message.slice(0, 100) : "unknown"}`);
      break;
    }
    totalPages = Math.min(resp.pagination?.pages ?? 1, 50); // cap at 5000 committees

    for (const row of resp.results ?? []) {
      if (!row.committee_id) continue;
      results.push({
        committeeId: row.committee_id,
        name: row.committee_name ?? row.committee_id,
        committeeType: row.committee_type,
        designation: row.designation,
        party: row.party_full,
        totalReceipts: row.receipts,
        totalDisbursements: row.disbursements,
        cashOnHand: row.cash_on_hand_end_period,
        independentExpenditures: row.independent_expenditures,
      });
    }

    console.log(`  Committees page ${page}/${totalPages} (${results.length} so far)`);
    page++;
    if (page <= totalPages) await sleep(500);
  }

  return results;
}

async function main() {
  if (!apiKey) {
    console.error("FEC_API_KEY not set in .env");
    process.exit(1);
  }

  await mkdir(LATEST_DIR, { recursive: true });

  // Load existing 2024 bulk data
  const existing2024Candidates = await readJsonOr<FecCandidateFinancials[]>("fec.candidate-financials.json", []);
  const existing2024Pacs = await readJsonOr<FecPacSummary[]>("fec.pac-summaries.json", []);
  console.log(`Existing data: ${existing2024Candidates.length} candidate financials, ${existing2024Pacs.length} PAC summaries`);

  // Fetch current cycle from API
  console.log(`\nFetching ${cycle} cycle candidate financials from FEC API...`);
  const apiCandidates = await fetchCandidateFinancials(cycle);
  console.log(`Fetched ${apiCandidates.length} candidate financials for ${cycle}`);

  console.log(`\nFetching ${cycle} cycle committee financials from FEC API...`);
  const apiCommittees = await fetchCommitteeFinancials(cycle);
  console.log(`Fetched ${apiCommittees.length} committee financials for ${cycle}`);

  // Merge: API data takes precedence for candidates that appear in both
  // (a candidate active in 2026 may also have 2024 data — keep both, prefer latest)
  const candidateMap = new Map<string, FecCandidateFinancials>();
  for (const cf of existing2024Candidates) {
    candidateMap.set(cf.candidateId, cf);
  }
  let updatedCount = 0;
  let newCount = 0;
  for (const cf of apiCandidates) {
    const existing = candidateMap.get(cf.candidateId);
    if (existing) {
      // Only override if API has higher receipts (means more recent filing)
      if ((cf.totalReceipts ?? 0) > (existing.totalReceipts ?? 0)) {
        candidateMap.set(cf.candidateId, cf);
        updatedCount++;
      }
    } else {
      candidateMap.set(cf.candidateId, cf);
      newCount++;
    }
  }
  console.log(`\nMerged candidates: ${updatedCount} updated, ${newCount} new, ${candidateMap.size} total`);

  const pacMap = new Map<string, FecPacSummary>();
  for (const ps of existing2024Pacs) {
    pacMap.set(ps.committeeId, ps);
  }
  let pacUpdated = 0;
  let pacNew = 0;
  for (const ps of apiCommittees) {
    const existing = pacMap.get(ps.committeeId);
    if (existing) {
      if ((ps.totalReceipts ?? 0) > (existing.totalReceipts ?? 0)) {
        pacMap.set(ps.committeeId, ps);
        pacUpdated++;
      }
    } else {
      pacMap.set(ps.committeeId, ps);
      pacNew++;
    }
  }
  console.log(`Merged PACs: ${pacUpdated} updated, ${pacNew} new, ${pacMap.size} total`);

  // Write merged data
  console.log("\nWriting merged financial data...");
  await writeJson("fec.candidate-financials.json", [...candidateMap.values()]);
  await writeJson("fec.pac-summaries.json", [...pacMap.values()]);

  console.log("\nDone! Financial data now includes both 2024 bulk and current cycle API data.");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
