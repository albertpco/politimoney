/**
 * Fetch House and Senate roll call votes and save to data/ingest/latest/.
 * This is a standalone script that doesn't require the full ingest pipeline.
 *
 * Usage: npx tsx src/scripts/fetch-votes.ts
 */

import { loadEnvConfig } from "@next/env";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  ingestHouseRollCallVotes,
  ingestCongressMembers,
} from "@/lib/ingest/providers/congress";
import { ingestSenateRollCallVotes } from "@/lib/ingest/providers/senate-roll-calls";
import type { CongressMember, CongressMembership } from "@/lib/ingest/types";

loadEnvConfig(process.cwd());

const LATEST_DIR = path.join(process.cwd(), "data", "ingest", "latest");
const apiKey = process.env.CONGRESS_API_KEY ?? null;

async function writeJson(filename: string, data: unknown) {
  const filePath = path.join(LATEST_DIR, filename);
  await writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
  const size = Buffer.byteLength(JSON.stringify(data), "utf8");
  console.log(`  → ${filename} (${(size / 1024).toFixed(0)} KB)`);
}

async function readJsonOr<T>(filename: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path.join(LATEST_DIR, filename), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function main() {
  if (!apiKey) {
    console.error("CONGRESS_API_KEY not set in .env");
    process.exit(1);
  }

  await mkdir(LATEST_DIR, { recursive: true });

  // Load existing members or fetch fresh
  let members = await readJsonOr<CongressMember[]>("congress.members.json", []);
  let memberships: CongressMembership[] = [];

  if (!members.length) {
    console.log("Fetching members...");
    const result = await ingestCongressMembers({
      apiKey,
      congresses: [119, 118],
      limit: 600,
    });
    members = result.members;
    memberships = result.memberships;
    await writeJson("congress.members.json", members);
    await writeJson("congress.memberships.json", memberships);
  } else {
    memberships = await readJsonOr<CongressMembership[]>("congress.memberships.json", []);
    console.log(`Using ${members.length} existing members`);
  }

  // Fetch House votes for recent congresses
  for (const cycle of [2024, 2026]) {
    console.log(`\nFetching House votes for cycle ${cycle}...`);
    const houseResult = await ingestHouseRollCallVotes({ apiKey, cycle });
    console.log(`  ${houseResult.houseVotes.length} House votes, ${houseResult.houseVoteMemberVotes.length} member votes`);
    if (houseResult.warnings.length) {
      console.log(`  Warnings: ${houseResult.warnings.length}`);
    }

    // Append to existing
    const existingHouseVotes = await readJsonOr<unknown[]>(`congress.house-votes.json`, []);
    const existingHouseMemberVotes = await readJsonOr<unknown[]>(`congress.house-vote-member-votes.json`, []);

    const mergedHouseVotes = [...existingHouseVotes, ...houseResult.houseVotes];
    const mergedHouseMemberVotes = [...existingHouseMemberVotes, ...houseResult.houseVoteMemberVotes];

    // Deduplicate by voteId
    const uniqueHouseVotes = [...new Map(mergedHouseVotes.map((v) => [(v as Record<string, unknown>).voteId, v])).values()];
    const seenMemberVoteKeys = new Set<string>();
    const uniqueHouseMemberVotes = mergedHouseMemberVotes.filter((mv) => {
      const rec = mv as Record<string, unknown>;
      const key = `${rec.voteId}|${rec.bioguideId}`;
      if (seenMemberVoteKeys.has(key)) return false;
      seenMemberVoteKeys.add(key);
      return true;
    });

    await writeJson("congress.house-votes.json", uniqueHouseVotes);
    await writeJson("congress.house-vote-member-votes.json", uniqueHouseMemberVotes);

    console.log(`Fetching Senate votes for cycle ${cycle}...`);
    const senateResult = await ingestSenateRollCallVotes({
      cycle,
      members,
      memberships,
    });
    console.log(`  ${senateResult.senateVotes.length} Senate votes, ${senateResult.senateVoteMemberVotes.length} member votes`);

    const existingSenateVotes = await readJsonOr<unknown[]>(`congress.senate-votes.json`, []);
    const existingSenMemberVotes = await readJsonOr<unknown[]>(`congress.senate-vote-member-votes.json`, []);

    const mergedSenateVotes = [...existingSenateVotes, ...senateResult.senateVotes];
    const mergedSenMemberVotes = [...existingSenMemberVotes, ...senateResult.senateVoteMemberVotes];

    const uniqueSenateVotes = [...new Map(mergedSenateVotes.map((v) => [(v as Record<string, unknown>).voteId, v])).values()];
    const seenSenKeys = new Set<string>();
    const uniqueSenMemberVotes = mergedSenMemberVotes.filter((mv) => {
      const rec = mv as Record<string, unknown>;
      const key = `${rec.voteId}|${rec.bioguideId}`;
      if (seenSenKeys.has(key)) return false;
      seenSenKeys.add(key);
      return true;
    });

    await writeJson("congress.senate-votes.json", uniqueSenateVotes);
    await writeJson("congress.senate-vote-member-votes.json", uniqueSenMemberVotes);
  }

  console.log("\nDone! Vote data written to data/ingest/latest/");
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
