/**
 * Data cross-reference integrity tests.
 *
 * Validates that IDs referenced in one dataset actually exist in the
 * related dataset. Uses a 95% match rate threshold to account for
 * edge cases (retired candidates, renamed committees, etc.).
 *
 * Run: npx vitest run src/lib/data/cross-reference.test.ts
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import {
  readFecCandidates,
  readFecCommittees,
  readCongressMembers,
  readCandidateFinancials,
  readPacSummaries,
  readPacToCandidate,
  readIndependentExpenditures,
  readHouseVoteMemberVotes,
  readFaraRegistrants,
  readFaraForeignPrincipals,
} from "@/lib/ingest/storage";

vi.mock("@/lib/db/client", () => ({ getPrismaClient: () => null }));

let candidates: Awaited<ReturnType<typeof readFecCandidates>>;
let committees: Awaited<ReturnType<typeof readFecCommittees>>;
let members: Awaited<ReturnType<typeof readCongressMembers>>;
let candidateFinancials: Awaited<ReturnType<typeof readCandidateFinancials>>;
let pacSummaries: Awaited<ReturnType<typeof readPacSummaries>>;
let pacToCandidate: Awaited<ReturnType<typeof readPacToCandidate>>;
let independentExpenditures: Awaited<ReturnType<typeof readIndependentExpenditures>>;
let houseVoteMemberVotes: Awaited<ReturnType<typeof readHouseVoteMemberVotes>>;
let faraRegistrants: Awaited<ReturnType<typeof readFaraRegistrants>>;
let faraForeignPrincipals: Awaited<ReturnType<typeof readFaraForeignPrincipals>>;

beforeAll(async () => {
  [
    candidates,
    committees,
    members,
    candidateFinancials,
    pacSummaries,
    pacToCandidate,
    independentExpenditures,
    houseVoteMemberVotes,
    faraRegistrants,
    faraForeignPrincipals,
  ] = await Promise.all([
    readFecCandidates(),
    readFecCommittees(),
    readCongressMembers(),
    readCandidateFinancials(),
    readPacSummaries(),
    readPacToCandidate(),
    readIndependentExpenditures(),
    readHouseVoteMemberVotes(),
    readFaraRegistrants(),
    readFaraForeignPrincipals(),
  ]);
});

describe("Candidate ID cross-references", () => {
  it("candidate-financials candidateIds should overlap with fec.candidates", () => {
    const candidateIdSet = new Set(candidates.map((c) => c.candidateId));
    const matched = candidateFinancials.filter((cf) =>
      candidateIdSet.has(cf.candidateId),
    );
    const matchRate = matched.length / candidateFinancials.length;
    // Financials may include prior-cycle candidates not in the current file
    expect(matchRate).toBeGreaterThan(0.5);
  });

  it("pac-to-candidate candidateIds should exist in fec.candidates (sample of 100)", () => {
    const candidateIdSet = new Set(candidates.map((c) => c.candidateId));
    const withCandidateId = pacToCandidate.filter((p) => p.candidateId);
    const sample = withCandidateId.slice(0, 100);
    if (sample.length === 0) return;
    const matched = sample.filter((p) => candidateIdSet.has(p.candidateId!));
    const matchRate = matched.length / sample.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });

  it("independent-expenditure candidateIds should overlap with fec.candidates (sample of 100)", () => {
    const candidateIdSet = new Set(candidates.map((c) => c.candidateId));
    const withCandidateId = independentExpenditures.filter(
      (ie) => ie.candidateId,
    );
    const sample = withCandidateId.slice(0, 100);
    if (sample.length === 0) return;
    const matched = sample.filter((ie) =>
      candidateIdSet.has(ie.candidateId!),
    );
    const matchRate = matched.length / sample.length;
    // IEs may target prior-cycle candidates
    expect(matchRate).toBeGreaterThan(0.7);
  });
});

describe("Committee ID cross-references", () => {
  it("pac-summaries committeeIds should exist in fec.committees", () => {
    const committeeIdSet = new Set(committees.map((c) => c.committeeId));
    const matched = pacSummaries.filter((ps) =>
      committeeIdSet.has(ps.committeeId),
    );
    const matchRate = matched.length / pacSummaries.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });

  it("pac-to-candidate committeeIds should exist in fec.committees (sample of 100)", () => {
    const committeeIdSet = new Set(committees.map((c) => c.committeeId));
    const sample = pacToCandidate.slice(0, 100);
    if (sample.length === 0) return;
    const matched = sample.filter((p) =>
      committeeIdSet.has(p.committeeId),
    );
    const matchRate = matched.length / sample.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });

  it("independent-expenditure committeeIds should exist in fec.committees (sample of 100)", () => {
    const committeeIdSet = new Set(committees.map((c) => c.committeeId));
    const sample = independentExpenditures.slice(0, 100);
    if (sample.length === 0) return;
    const matched = sample.filter((ie) =>
      committeeIdSet.has(ie.committeeId),
    );
    const matchRate = matched.length / sample.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });
});

describe("Congress member cross-references", () => {
  it("house-vote-member-votes bioguideIds should overlap with congress.members (sample of 200)", () => {
    const memberIdSet = new Set(members.map((m) => m.bioguideId));
    const sample = houseVoteMemberVotes.slice(0, 200);
    if (sample.length === 0) return;
    const matched = sample.filter((mv) => memberIdSet.has(mv.bioguideId));
    const matchRate = matched.length / sample.length;
    // Vote records may include former members who left office
    expect(matchRate).toBeGreaterThan(0.7);
  });

  it("candidate-member crosswalk bioguideIds should exist in congress.members", async () => {
    const { getCandidateMemberCrosswalkRepository } = await import("@/lib/data/repository");
    const memberIdSet = new Set(members.map((m) => m.bioguideId));
    const crosswalk = await getCandidateMemberCrosswalkRepository();
    if (crosswalk.length === 0) return;
    const matched = crosswalk.filter((cw) =>
      memberIdSet.has(cw.bioguideId),
    );
    const matchRate = matched.length / crosswalk.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });
});

describe("FARA cross-references", () => {
  it("foreign principal registrationNumbers should exist in fara.registrants (sample of 100)", () => {
    const registrationNumberSet = new Set(
      faraRegistrants.map((r) => r.registrationNumber),
    );
    const sample = faraForeignPrincipals.slice(0, 100);
    if (sample.length === 0) return;
    const matched = sample.filter((fp) =>
      registrationNumberSet.has(fp.registrationNumber),
    );
    const matchRate = matched.length / sample.length;
    expect(matchRate).toBeGreaterThan(0.95);
  });
});
