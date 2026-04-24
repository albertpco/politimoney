/**
 * Comprehensive repository tests.
 *
 * All 36 exported async functions are exercised in JSON-fallback mode
 * by mocking Prisma to return null. Functions that depend on optional
 * data files (contracts, lobbying, insider trades, senate member votes)
 * use a skipIf pattern so CI passes on a fresh clone.
 *
 * Run: npx vitest run src/lib/data/repository.test.ts
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Mock Prisma to always return null (force JSON fallback)
vi.mock("@/lib/db/client", () => ({
  getPrismaClient: () => null,
}));

const DATA_DIR = join(process.cwd(), "data/ingest/latest");

/** Returns true if the required data file exists under data/ingest/latest/. */
function hasFile(fileName: string): boolean {
  return existsSync(join(DATA_DIR, fileName));
}

/** Returns true if the file exists and contains a non-empty JSON array. */
function hasFileWithData(fileName: string): boolean {
  const path = join(DATA_DIR, fileName);
  if (!existsSync(path)) return false;
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"));
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// Pre-check optional data sources
const hasContracts = hasFile("usaspending.contracts.json");
const hasTopContractors = hasFile("usaspending.top-contractors.json");
const hasLobbyingClients = hasFile("lda.lobbying-clients.json");
const hasLobbyingFilings = hasFile("lda.lobbying-filings.json");
const hasLobbyistContributions = hasFile("lda.lobbying-contributions.json");
const hasInsiderTrades = hasFile("sec.insider-trades.json");
const hasInsiderTradeSummaries = hasFile("sec.insider-trade-summaries.json");
const hasSenateVoteMemberVotes = hasFileWithData("congress.senate-vote-member-votes.json");
const hasFundingReadModels = hasFile("derived.funding-read-models.json");

// Dynamically import repository so mocks apply before module initialisation
let repo: typeof import("./repository");
beforeAll(async () => {
  repo = await import("./repository");
});

// ─── Core mode detection ──────────────────────────────────────────

describe("Core mode detection", () => {
  it("getDataBackendMode returns 'json' when no Prisma client", async () => {
    const mode = await repo.getDataBackendMode();
    expect(mode).toBe("json");
  });
});

// ─── Summary and metadata ─────────────────────────────────────────

describe("Summary and metadata", () => {
  it("getLatestRunSummaryRepository returns data or null from JSON", async () => {
    const result = await repo.getLatestRunSummaryRepository();
    expect(result === null || typeof result === "object").toBe(true);
  });

  it("getLatestRunSummaryRepository result has totals when non-null", async () => {
    const result = await repo.getLatestRunSummaryRepository();
    if (result && "totals" in result) {
      expect(typeof (result as Record<string, unknown>).totals).toBe("object");
    }
  });
});

// ─── Entity listing ───────────────────────────────────────────────

describe("Entity listing", () => {
  it("getLatestStateOutcomesRepository returns an array", async () => {
    const result = await repo.getLatestStateOutcomesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getLatestStateOutcomesRepository returns unique states", async () => {
    const result = await repo.getLatestStateOutcomesRepository();
    const codes = new Set(result.map((r) => r.stateCode));
    expect(codes.size).toBeGreaterThanOrEqual(50);
  });

  it("getLatestSenatorEntitiesRepository returns an array with items", async () => {
    const result = await repo.getLatestSenatorEntitiesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("senators have id, name, and state", async () => {
    const result = await repo.getLatestSenatorEntitiesRepository();
    for (const s of result.slice(0, 10)) {
      expect(s.id).toBeTruthy();
      expect(s.name).toBeTruthy();
      expect(s.state).toBeTruthy();
    }
  });

  it("getLatestBillEntitiesRepository returns an array with items", async () => {
    const result = await repo.getLatestBillEntitiesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("bills have id, title, and billType", async () => {
    const result = await repo.getLatestBillEntitiesRepository();
    for (const b of result.slice(0, 10)) {
      expect(b.id).toBeTruthy();
      expect(b.title).toBeTruthy();
      expect(b.billType).toBeTruthy();
    }
  });

  it("getLatestOrganizationEntitiesRepository returns an array", async () => {
    const result = await repo.getLatestOrganizationEntitiesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("organizations have committeeId and name", async () => {
    const result = await repo.getLatestOrganizationEntitiesRepository();
    for (const o of result.slice(0, 10)) {
      expect(o.committeeId).toBeTruthy();
      expect(o.name).toBeTruthy();
    }
  });

  it("getLatestCountryInfluenceEntitiesRepository returns an array", async () => {
    const result = await repo.getLatestCountryInfluenceEntitiesRepository();
    expect(Array.isArray(result)).toBe(true);
  });

  it("countries have name and principalCount when present", async () => {
    const result = await repo.getLatestCountryInfluenceEntitiesRepository();
    if (result.length > 0) {
      for (const c of result.slice(0, 10)) {
        expect(c.name).toBeTruthy();
        expect(typeof c.principalCount).toBe("number");
      }
    }
  });

  it("getInfluenceNetworkSnapshotRepository returns nodes and edges", async () => {
    const result = await repo.getInfluenceNetworkSnapshotRepository();
    expect(result).toBeTruthy();
    expect(Array.isArray(result.nodes)).toBe(true);
    expect(Array.isArray(result.edges)).toBe(true);
    expect(result.nodes.length).toBeGreaterThan(0);
    expect(result.edges.length).toBeGreaterThan(0);
  });

  it("getLatestCongressMembersRepository returns an array", async () => {
    const result = await repo.getLatestCongressMembersRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(400);
  });

  it("congress members have bioguideId, name, chamber", async () => {
    const result = await repo.getLatestCongressMembersRepository();
    for (const m of result.slice(0, 10)) {
      expect(m.bioguideId).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(["H", "S"]).toContain(m.chamber);
    }
  });

  it("getCandidateMemberCrosswalkRepository returns an array", async () => {
    const result = await repo.getCandidateMemberCrosswalkRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("crosswalk entries have bioguideId and candidateId", async () => {
    const result = await repo.getCandidateMemberCrosswalkRepository();
    for (const row of result.slice(0, 10)) {
      expect(row.bioguideId).toBeTruthy();
      expect(row.candidateId).toBeTruthy();
    }
  });
});

// ─── Vote data ────────────────────────────────────────────────────

describe("Vote data", () => {
  it("getLatestHouseVotesRepository returns an array", async () => {
    const result = await repo.getLatestHouseVotesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getLatestHouseVotesRepository respects limit", async () => {
    const result = await repo.getLatestHouseVotesRepository(5);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("house votes have voteId and rollCallNumber", async () => {
    const result = await repo.getLatestHouseVotesRepository(10);
    for (const v of result) {
      expect(v.voteId).toBeTruthy();
      expect(typeof v.rollCallNumber).toBe("number");
    }
  });

  it("getHouseVoteMemberVotesRepository returns an array", async () => {
    const result = await repo.getHouseVoteMemberVotesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getHouseVoteMemberVotesRepository filters by voteId", async () => {
    const votes = await repo.getLatestHouseVotesRepository(1);
    if (votes.length > 0) {
      const memberVotes = await repo.getHouseVoteMemberVotesRepository(votes[0].voteId);
      expect(Array.isArray(memberVotes)).toBe(true);
      for (const mv of memberVotes) {
        expect(mv.voteId).toBe(votes[0].voteId);
      }
    }
  });

  it("getHouseVoteMemberVotesRepository returns empty for bogus voteId", async () => {
    const result = await repo.getHouseVoteMemberVotesRepository("BOGUS-VOTE-ID-9999");
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getLatestSenateVotesRepository returns an array", async () => {
    const result = await repo.getLatestSenateVotesRepository();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("getLatestSenateVotesRepository respects limit", async () => {
    const result = await repo.getLatestSenateVotesRepository(3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("getHouseVoteCountRepository returns a positive number", async () => {
    const count = await repo.getHouseVoteCountRepository();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it("getSenateVoteCountRepository returns a positive number", async () => {
    const count = await repo.getSenateVoteCountRepository();
    expect(typeof count).toBe("number");
    expect(count).toBeGreaterThan(0);
  });

  it.skipIf(!hasSenateVoteMemberVotes)(
    "getSenateVoteMemberVotesRepository returns an array",
    async () => {
      const result = await repo.getSenateVoteMemberVotesRepository();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!hasSenateVoteMemberVotes)(
    "getSenateVoteMemberVotesRepository filters by voteId",
    async () => {
      const votes = await repo.getLatestSenateVotesRepository(1);
      if (votes.length > 0) {
        const memberVotes = await repo.getSenateVoteMemberVotesRepository(votes[0].voteId);
        expect(Array.isArray(memberVotes)).toBe(true);
        for (const mv of memberVotes) {
          expect(mv.voteId).toBe(votes[0].voteId);
        }
      }
    },
  );

  it.skipIf(!hasSenateVoteMemberVotes)(
    "getSenateVoteMemberVotesRepository returns empty for bogus voteId",
    async () => {
      const result = await repo.getSenateVoteMemberVotesRepository("BOGUS-VOTE-9999");
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    },
  );

  it("getRecentMemberVotePositionsRepository returns array for House member", async () => {
    const members = await repo.getLatestCongressMembersRepository();
    const houseMember = members.find((m) => m.chamber === "H");
    if (houseMember) {
      const result = await repo.getRecentMemberVotePositionsRepository({
        bioguideId: houseMember.bioguideId,
        chamber: "H",
        limit: 5,
      });
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeLessThanOrEqual(5);
      for (const r of result) {
        expect(r.chamber).toBe("H");
        expect(r.voteCast).toBeTruthy();
      }
    }
  });

  it.skipIf(!hasSenateVoteMemberVotes)(
    "getRecentMemberVotePositionsRepository returns array for Senate member",
    async () => {
      const members = await repo.getLatestCongressMembersRepository();
      const senateMember = members.find((m) => m.chamber === "S");
      if (senateMember) {
        const result = await repo.getRecentMemberVotePositionsRepository({
          bioguideId: senateMember.bioguideId,
          chamber: "S",
          limit: 5,
        });
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeLessThanOrEqual(5);
      }
    },
  );

  it("getRecentMemberVotePositionsRepository returns empty for bogus bioguideId", async () => {
    const result = await repo.getRecentMemberVotePositionsRepository({
      bioguideId: "ZZZZZZZ999",
      chamber: "H",
      limit: 5,
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });
});

// ─── Funding and contributions ────────────────────────────────────

describe("Funding and contributions", () => {
  it("getContributionAggregatesByCommittees returns null with mocked Prisma", async () => {
    const result = await repo.getContributionAggregatesByCommittees(["C00000001"]);
    expect(result).toBeNull();
  });

  it("getContributionAggregatesByCommittees returns null for empty array", async () => {
    const result = await repo.getContributionAggregatesByCommittees([]);
    expect(result).toBeNull();
  });

  it("getTopDonorsByCommittee returns empty array with mocked Prisma", async () => {
    const result = await repo.getTopDonorsByCommittee("C00000001", 10);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("getCommitteeRecipientsRepository returns an array", async () => {
    const orgs = await repo.getLatestOrganizationEntitiesRepository();
    if (orgs.length > 0) {
      const result = await repo.getCommitteeRecipientsRepository(orgs[0].committeeId, 5);
      expect(Array.isArray(result)).toBe(true);
    }
  });

  it("getCommitteeRecipientsRepository returns empty for bogus committeeId", async () => {
    const result = await repo.getCommitteeRecipientsRepository("C99999999", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it.skipIf(!hasFundingReadModels)(
    "getFundingProfileRepository returns result for a real member",
    async () => {
      const members = await repo.getLatestCongressMembersRepository();
      if (members.length > 0) {
        const result = await repo.getFundingProfileRepository(members[0].bioguideId);
        expect(result === null || typeof result === "object").toBe(true);
      }
    },
  );

  it("getFundingProfileRepository returns null for bogus ID", async () => {
    const result = await repo.getFundingProfileRepository("BOGUS_ENTITY_999");
    expect(result).toBeNull();
  });

  it("rankEntitiesRepository returns ranked committees", async () => {
    const result = await repo.rankEntitiesRepository({ type: "committee", limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(5);
    for (const r of result) {
      expect(r.rank).toBeGreaterThan(0);
      expect(r.type).toBe("committee");
      expect(r.label).toBeTruthy();
    }
  });

  it("rankEntitiesRepository returns ranked candidates", async () => {
    const result = await repo.rankEntitiesRepository({ type: "candidate", limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    for (const r of result) {
      expect(r.type).toBe("candidate");
    }
  });

  it("rankEntitiesRepository returns ranked members", async () => {
    const result = await repo.rankEntitiesRepository({ type: "member", limit: 5 });
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.type).toBe("member");
      expect(r.rank).toBeGreaterThan(0);
    }
  });

  it("analyzeHouseVoteFundingRepository returns result for a real vote", async () => {
    const votes = await repo.getLatestHouseVotesRepository(1);
    if (votes.length > 0) {
      const result = await repo.analyzeHouseVoteFundingRepository({
        voteId: votes[0].voteId,
      });
      expect(result === null || typeof result === "object").toBe(true);
      if (result) {
        expect(result.voteId).toBeTruthy();
        expect(Array.isArray(result.groups)).toBe(true);
      }
    }
  });

  it("analyzeHouseVoteFundingRepository returns null for bogus voteId", async () => {
    const result = await repo.analyzeHouseVoteFundingRepository({
      voteId: "BOGUS-VOTE-99999",
    });
    expect(result).toBeNull();
  });

  it("analyzeSenateVoteFundingRepository returns result for a real vote", async () => {
    const votes = await repo.getLatestSenateVotesRepository(1);
    if (votes.length > 0) {
      const result = await repo.analyzeSenateVoteFundingRepository({
        voteId: votes[0].voteId,
      });
      expect(result === null || typeof result === "object").toBe(true);
      if (result) {
        expect(result.voteId).toBeTruthy();
        expect(Array.isArray(result.groups)).toBe(true);
      }
    }
  });

  it("analyzeSenateVoteFundingRepository returns null for bogus voteId", async () => {
    const result = await repo.analyzeSenateVoteFundingRepository({
      voteId: "BOGUS-SENATE-VOTE-99999",
    });
    expect(result).toBeNull();
  });

  it("analyzeHouseVoteFundingRepository works with billId", async () => {
    const votes = await repo.getLatestHouseVotesRepository(20);
    const withBill = votes.find((v) => v.billId);
    if (withBill) {
      const result = await repo.analyzeHouseVoteFundingRepository({
        billId: withBill.billId,
      });
      expect(result === null || typeof result === "object").toBe(true);
    }
  });
});

// ─── Search ───────────────────────────────────────────────────────

describe("Search", () => {
  it("searchEntitiesRepository returns results for a broad query", async () => {
    const result = await repo.searchEntitiesRepository("senate", undefined, 10);
    expect(Array.isArray(result)).toBe(true);
  });

  it("searchEntitiesRepository returns results filtered by type 'member'", async () => {
    const result = await repo.searchEntitiesRepository("texas", "member", 10);
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.type).toBe("member");
    }
  });

  it("searchEntitiesRepository returns results filtered by type 'bill'", async () => {
    const result = await repo.searchEntitiesRepository("hr", "bill", 10);
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.type).toBe("bill");
    }
  });

  it("searchEntitiesRepository returns results filtered by type 'committee'", async () => {
    const result = await repo.searchEntitiesRepository("pac", "committee", 10);
    expect(Array.isArray(result)).toBe(true);
    for (const r of result) {
      expect(r.type).toBe("committee");
    }
  });

  it("searchEntitiesRepository respects limit", async () => {
    const result = await repo.searchEntitiesRepository("a", undefined, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it("searchEntitiesRepository returns empty for gibberish query", async () => {
    const result = await repo.searchEntitiesRepository("xyzzyplugh99999", undefined, 10);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("searchEntitiesRepository returns empty for empty string", async () => {
    const result = await repo.searchEntitiesRepository("", undefined, 10);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it("search results have id, label, and type", async () => {
    const result = await repo.searchEntitiesRepository("texas", undefined, 5);
    for (const r of result) {
      expect(r.id).toBeTruthy();
      expect(r.label).toBeTruthy();
      expect(r.type).toBeTruthy();
    }
  });
});

// ─── Donors ───────────────────────────────────────────────────────

describe("Donors", () => {
  it("getDonorProfilesRepository returns an array", async () => {
    const result = await repo.getDonorProfilesRepository(10);
    expect(Array.isArray(result)).toBe(true);
  });

  it.skipIf(!hasFundingReadModels)(
    "getDonorProfilesRepository returns items with donor field",
    async () => {
      const result = await repo.getDonorProfilesRepository(5);
      if (result.length > 0) {
        for (const d of result) {
          expect(d.donor).toBeTruthy();
          expect(d.id).toBeTruthy();
        }
      }
    },
  );

  it.skipIf(!hasFundingReadModels)(
    "getDonorProfileRepository returns a donor for a valid ID",
    async () => {
      const donors = await repo.getDonorProfilesRepository(1);
      if (donors.length > 0) {
        const result = await repo.getDonorProfileRepository(donors[0].id);
        expect(result).not.toBeNull();
        if (result) {
          expect(result.id).toBe(donors[0].id);
        }
      }
    },
  );

  it("getDonorProfileRepository returns null for bogus ID", async () => {
    const result = await repo.getDonorProfileRepository("BOGUS_DONOR_ZZZZZZ");
    expect(result).toBeNull();
  });

  it.skipIf(!hasFundingReadModels)(
    "getDonorProfileRepository matches by donor name",
    async () => {
      const donors = await repo.getDonorProfilesRepository(1);
      if (donors.length > 0) {
        const result = await repo.getDonorProfileRepository(donors[0].donor);
        expect(result).not.toBeNull();
      }
    },
  );
});

// ─── Contracts ────────────────────────────────────────────────────

describe("Contracts", () => {
  const hasData = hasContracts || hasTopContractors;

  it.skipIf(!hasData)(
    "getTopContractorsRepository returns an array",
    async () => {
      const result = await repo.getTopContractorsRepository(10);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(10);
    },
  );

  it.skipIf(!hasData)(
    "getTopContractorsRepository items have recipientName and totalObligatedAmount",
    async () => {
      const result = await repo.getTopContractorsRepository(5);
      for (const c of result) {
        expect(c.recipientName).toBeTruthy();
        expect(typeof c.totalObligatedAmount).toBe("number");
      }
    },
  );

  it.skipIf(!hasContracts)(
    "getContractsByCompanyRepository returns results for a known company",
    async () => {
      const contractors = await repo.getTopContractorsRepository(1);
      if (contractors.length > 0) {
        const result = await repo.getContractsByCompanyRepository(
          contractors[0].recipientName,
          5,
        );
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
      }
    },
  );

  it("getContractsByCompanyRepository returns empty for bogus company", async () => {
    const result = await repo.getContractsByCompanyRepository("ZZZZZ_NONEXISTENT_CORP", 5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(0);
  });

  it.skipIf(!hasData)(
    "getContractorProfileRepository returns a profile for a known company",
    async () => {
      const contractors = await repo.getTopContractorsRepository(1);
      if (contractors.length > 0) {
        const result = await repo.getContractorProfileRepository(
          contractors[0].recipientName,
        );
        expect(result).not.toBeNull();
        if (result) {
          expect(result.recipientName).toBeTruthy();
        }
      }
    },
  );

  it("getContractorProfileRepository returns null for bogus company", async () => {
    const result = await repo.getContractorProfileRepository("ZZZZZ_NONEXISTENT_CORP");
    expect(result).toBeNull();
  });
});

// ─── Lobbying ─────────────────────────────────────────────────────

describe("Lobbying", () => {
  it.skipIf(!hasLobbyingClients)(
    "getLobbyingClientsRepository returns an array",
    async () => {
      const result = await repo.getLobbyingClientsRepository(10);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(10);
    },
  );

  it.skipIf(!hasLobbyingClients)(
    "lobbying clients have clientName and totalSpending",
    async () => {
      const result = await repo.getLobbyingClientsRepository(5);
      for (const c of result) {
        expect(c.clientName).toBeTruthy();
        expect(typeof c.totalSpending).toBe("number");
      }
    },
  );

  it.skipIf(!(hasLobbyingClients && hasLobbyingFilings))(
    "getLobbyingByClientRepository returns profile for a known client",
    async () => {
      const clients = await repo.getLobbyingClientsRepository(1);
      if (clients.length > 0) {
        const result = await repo.getLobbyingByClientRepository(clients[0].clientName);
        expect(result).not.toBeNull();
        if (result) {
          expect(result.clientName).toBeTruthy();
          expect(Array.isArray(result.filings)).toBe(true);
        }
      }
    },
  );

  it.skipIf(!hasLobbyingClients)(
    "getLobbyingByClientRepository returns null for bogus client",
    async () => {
      const result = await repo.getLobbyingByClientRepository("ZZZZZ_NONEXISTENT_CLIENT");
      expect(result).toBeNull();
    },
  );

  it.skipIf(!hasLobbyistContributions)(
    "getLobbyistContributionsForMemberRepository returns an array",
    async () => {
      const result = await repo.getLobbyistContributionsForMemberRepository("Smith", 5);
      expect(Array.isArray(result)).toBe(true);
    },
  );

  it.skipIf(!hasLobbyistContributions)(
    "getLobbyistContributionsForMemberRepository returns empty for bogus name",
    async () => {
      const result = await repo.getLobbyistContributionsForMemberRepository(
        "ZZZZZ_NONEXISTENT_MEMBER",
        5,
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    },
  );

  it.skipIf(!hasLobbyingFilings)(
    "getBillsLobbiedRepository returns an array",
    async () => {
      const result = await repo.getBillsLobbiedRepository(10);
      expect(Array.isArray(result)).toBe(true);
    },
  );

  it.skipIf(!hasLobbyingFilings)(
    "getBillsLobbiedRepository items have billNumber and filingCount",
    async () => {
      const result = await repo.getBillsLobbiedRepository(5);
      for (const b of result) {
        expect(b.billNumber).toBeTruthy();
        expect(typeof b.filingCount).toBe("number");
        expect(typeof b.uniqueClients).toBe("number");
        expect(Array.isArray(b.topClients)).toBe(true);
        expect(Array.isArray(b.issues)).toBe(true);
      }
    },
  );
});

// ─── Insider trades ───────────────────────────────────────────────

describe("Insider trades", () => {
  it.skipIf(!hasInsiderTradeSummaries)(
    "getInsiderTradeSummariesRepository returns an array",
    async () => {
      const result = await repo.getInsiderTradeSummariesRepository(10);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result.length).toBeLessThanOrEqual(10);
    },
  );

  it.skipIf(!hasInsiderTradeSummaries)(
    "insider trade summaries have ticker and companyName",
    async () => {
      const result = await repo.getInsiderTradeSummariesRepository(5);
      for (const s of result) {
        expect(s.ticker).toBeTruthy();
        expect(s.companyName).toBeTruthy();
        expect(typeof s.netValue).toBe("number");
      }
    },
  );

  it.skipIf(!hasInsiderTrades)(
    "getInsiderTradesByCompanyRepository returns summary and trades for a known ticker",
    async () => {
      const summaries = await repo.getInsiderTradeSummariesRepository(1);
      if (summaries.length > 0) {
        const result = await repo.getInsiderTradesByCompanyRepository(
          summaries[0].ticker,
          5,
        );
        expect(result).toBeTruthy();
        expect(result.summary === null || typeof result.summary === "object").toBe(true);
        expect(Array.isArray(result.trades)).toBe(true);
      }
    },
  );

  it.skipIf(!hasInsiderTrades)(
    "getInsiderTradesByCompanyRepository returns empty trades for bogus ticker",
    async () => {
      const result = await repo.getInsiderTradesByCompanyRepository("ZZZZZ99", 5);
      expect(result).toBeTruthy();
      expect(result.summary).toBeNull();
      expect(Array.isArray(result.trades)).toBe(true);
      expect(result.trades.length).toBe(0);
    },
  );
});
