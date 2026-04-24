/**
 * Fetch Senate Lobbying Disclosure (LDA) filings and contributions.
 * Builds client profiles with crosswalk to FEC committees and USASpending contractors.
 *
 * Usage: npx tsx src/scripts/fetch-lobbying.ts [--year 2024] [--periods Q1,Q2,Q3,Q4]
 */

import { loadEnvConfig } from "@next/env";
import { ingestLdaData } from "@/lib/ingest/providers/lda";
import {
  readTopContractors,
  saveLobbyingArtifacts,
} from "@/lib/ingest/storage";
import { readLatestDataset } from "@/lib/ingest/storage";
import type { FecCommittee, CongressMember } from "@/lib/ingest/types";

loadEnvConfig(process.cwd());

const yearArg = process.argv.find((_, i) => process.argv[i - 1] === "--year");
const year = Number(yearArg) || 2024;

const periodsArg = process.argv.find((_, i) => process.argv[i - 1] === "--periods");
const periods = periodsArg ? periodsArg.split(",").map((s) => s.trim()) : ["Q1", "Q2", "Q3", "Q4"];

async function main() {
  console.log(`\n=== LDA Lobbying Disclosure Ingest ===`);
  console.log(`Year: ${year}, Periods: ${periods.join(", ")}\n`);

  // Load crosswalk data
  console.log("Loading crosswalk data...");
  const [committees, members, contractors] = await Promise.all([
    readLatestDataset<FecCommittee[]>("fec.committees.json", []),
    readLatestDataset<CongressMember[]>("congress.members.json", []),
    readTopContractors(),
  ]);
  console.log(`  FEC committees: ${committees.length}`);
  console.log(`  Congress members: ${members.length}`);
  console.log(`  USASpending contractors: ${contractors.length}`);

  const result = await ingestLdaData({
    year,
    periods,
    committees,
    members,
    contractors,
  });

  if (result.warnings.length > 0) {
    console.log(`\nWarnings:`);
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`);
    }
  }

  // Save artifacts
  console.log("\nSaving LDA artifacts...");
  await saveLobbyingArtifacts(result.filings, result.contributions, result.clients);

  const filingSizeMb = (Buffer.byteLength(JSON.stringify(result.filings), "utf8") / 1024 / 1024).toFixed(1);
  const contribSizeMb = (Buffer.byteLength(JSON.stringify(result.contributions), "utf8") / 1024 / 1024).toFixed(1);
  const clientSizeMb = (Buffer.byteLength(JSON.stringify(result.clients), "utf8") / 1024 / 1024).toFixed(1);

  console.log(`  → lda.lobbying-filings.json (${filingSizeMb} MB, ${result.filings.length} records)`);
  console.log(`  → lda.lobbying-contributions.json (${contribSizeMb} MB, ${result.contributions.length} records)`);
  console.log(`  → lda.lobbying-clients.json (${clientSizeMb} MB, ${result.clients.length} records)`);

  console.log(`\nCrosswalk results:`);
  console.log(`  Payee → FEC committee: ${result.crosswalk.payeeToCommitteeCount}`);
  console.log(`  Honoree → Congress member: ${result.crosswalk.honoreeToMemberCount}`);
  console.log(`  Client → FEC committee: ${result.crosswalk.clientToFecCount}`);
  console.log(`  Client → USASpending contractor: ${result.crosswalk.clientToContractorCount}`);

  // Show top 10 clients
  console.log(`\nTop 10 lobbying clients by spending:`);
  const fmtMoney = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  for (const client of result.clients.slice(0, 10)) {
    const extras: string[] = [];
    if (client.linkedFecCommittees.length) extras.push(`FEC: ${client.linkedFecCommittees[0]}`);
    if (client.linkedContractorName) extras.push(`Contractor: ${client.linkedContractorName}`);
    console.log(`  ${fmtMoney(client.totalSpending).padStart(15)} | ${client.clientName}${extras.length ? ` (${extras.join(", ")})` : ""}`);
  }

  console.log("\nDone!");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
