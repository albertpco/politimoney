import { describe, it, expect, vi } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Mock Prisma so repository functions use JSON fallback
vi.mock("@/lib/db/client", () => ({
  getPrismaClient: () => null,
}));

const DATA_DIR = join(process.cwd(), "data/ingest/latest");
function hasFile(name: string) {
  return existsSync(join(DATA_DIR, name));
}

// ─── Registration smoke tests ────────────────────────────────────────────────

describe("MCP tool registration", () => {
  it("registerPolitiredTools registers tools without errors", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { registerPolitiredTools } = await import("./register-tools");

    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerPolitiredTools(server)).not.toThrow();
  });

  it("registerPolitiredTools with includeIngest registers extra tool", async () => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { registerPolitiredTools } = await import("./register-tools");

    const server = new McpServer({ name: "test", version: "0.0.1" });
    expect(() => registerPolitiredTools(server, { includeIngest: true })).not.toThrow();
  });
});

// ─── FEC data layer ──────────────────────────────────────────────────────────

describe("MCP tool data layer: FEC", () => {
  it.skipIf(!hasFile("derived.launch-summary.json"))(
    "get_launch_summary: readLaunchSummary returns object or null",
    async () => {
      const { readLaunchSummary } = await import("@/lib/ingest/storage");
      const result = await readLaunchSummary();
      if (result !== null) {
        expect(typeof result).toBe("object");
      }
    },
  );

  it.skipIf(!hasFile("summary.json"))(
    "get_latest_ingest_summary: readLatestSummary returns object or null",
    async () => {
      const { readLatestSummary } = await import("@/lib/ingest/storage");
      const result = await readLatestSummary();
      if (result !== null) {
        expect(typeof result).toBe("object");
        expect(result).toHaveProperty("startedAt");
      }
    },
  );

  it.skipIf(!hasFile("fec.pac-summaries.json"))(
    "get_pac_rankings: readPacSummaries returns array sortable by disbursements",
    async () => {
      const { readPacSummaries } = await import("@/lib/ingest/storage");
      const pacs = await readPacSummaries();
      expect(Array.isArray(pacs)).toBe(true);
      if (pacs.length > 0) {
        const first = pacs[0];
        expect(first).toHaveProperty("committeeId");
        expect(first).toHaveProperty("name");
        expect(first).toHaveProperty("totalDisbursements");
        const sorted = [...pacs].sort(
          (a, b) => (b.totalDisbursements ?? 0) - (a.totalDisbursements ?? 0),
        );
        expect(sorted[0].totalDisbursements).toBeGreaterThanOrEqual(
          sorted[sorted.length - 1].totalDisbursements ?? 0,
        );
      }
    },
  );

  it.skipIf(!hasFile("fec.candidate-financials.json"))(
    "get_candidate_financials: readCandidateFinancials returns array with candidateId",
    async () => {
      const { readCandidateFinancials } = await import("@/lib/ingest/storage");
      const financials = await readCandidateFinancials();
      expect(Array.isArray(financials)).toBe(true);
      if (financials.length > 0) {
        expect(financials[0]).toHaveProperty("candidateId");
        expect(typeof financials[0].candidateId).toBe("string");
      }
    },
  );

  it.skipIf(!hasFile("fec.independent-expenditures.json"))(
    "get_independent_expenditures: readIndependentExpenditures returns array with amount",
    async () => {
      const { readIndependentExpenditures } = await import("@/lib/ingest/storage");
      const expenditures = await readIndependentExpenditures();
      expect(Array.isArray(expenditures)).toBe(true);
      if (expenditures.length > 0) {
        expect(expenditures[0]).toHaveProperty("committeeId");
        expect(expenditures[0]).toHaveProperty("amount");
        expect(typeof expenditures[0].amount).toBe("number");
      }
    },
  );

  it.skipIf(!hasFile("fec.candidates.json"))(
    "export_dataset(candidates): readFecCandidates returns array",
    async () => {
      const { readFecCandidates } = await import("@/lib/ingest/storage");
      const candidates = await readFecCandidates();
      expect(Array.isArray(candidates)).toBe(true);
      if (candidates.length > 0) {
        expect(candidates[0]).toHaveProperty("candidateId");
      }
    },
  );

  it.skipIf(!hasFile("fec.committees.json"))(
    "export_dataset(committees): readFecCommittees returns array",
    async () => {
      const { readFecCommittees } = await import("@/lib/ingest/storage");
      const committees = await readFecCommittees();
      expect(Array.isArray(committees)).toBe(true);
      if (committees.length > 0) {
        expect(committees[0]).toHaveProperty("committeeId");
      }
    },
  );

  it.skipIf(!hasFile("congress.members.json"))(
    "export_dataset(members): readCongressMembers returns array",
    async () => {
      const { readCongressMembers } = await import("@/lib/ingest/storage");
      const members = await readCongressMembers();
      expect(Array.isArray(members)).toBe(true);
      if (members.length > 0) {
        expect(members[0]).toHaveProperty("bioguideId");
      }
    },
  );

  it.skipIf(!hasFile("congress.bills.json"))(
    "export_dataset(bills): readCongressBills returns array",
    async () => {
      const { readCongressBills } = await import("@/lib/ingest/storage");
      const bills = await readCongressBills();
      expect(Array.isArray(bills)).toBe(true);
      if (bills.length > 0) {
        expect(bills[0]).toHaveProperty("billType");
      }
    },
  );

  it.skipIf(!hasFile("fec.pac-to-candidate.json"))(
    "export_dataset(pac_to_candidate): readPacToCandidate returns array",
    async () => {
      const { readPacToCandidate } = await import("@/lib/ingest/storage");
      const data = await readPacToCandidate();
      expect(Array.isArray(data)).toBe(true);
    },
    30_000,
  );

  it.skipIf(!hasFile("fec.recent-efilings.json"))(
    "get_recent_contributions: readRecentEfilings returns filterable array",
    async () => {
      const { readRecentEfilings } = await import("@/lib/ingest/storage");
      const efilings = await readRecentEfilings();
      expect(Array.isArray(efilings)).toBe(true);
      if (efilings.length > 0) {
        expect(efilings[0]).toHaveProperty("committeeId");
        expect(efilings[0]).toHaveProperty("donorName");
        expect(efilings[0]).toHaveProperty("amount");
        expect(efilings[0]).toHaveProperty("state");
      }
    },
  );
});

// ─── Search and entities ─────────────────────────────────────────────────────

describe("MCP tool data layer: Search and entities", () => {
  const hasCoreData =
    hasFile("fec.candidates.json") &&
    hasFile("fec.committees.json") &&
    hasFile("congress.members.json");

  it.skipIf(!hasCoreData)(
    "search_entities: searchEntitiesRepository returns array of results",
    async () => {
      const { searchEntitiesRepository } = await import("@/lib/data/repository");
      const results = await searchEntitiesRepository("Cruz");
      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toHaveProperty("type");
      }
    },
  );

  it.skipIf(!hasCoreData)(
    "search_entities with type filter returns filtered results",
    async () => {
      const { searchEntitiesRepository } = await import("@/lib/data/repository");
      const results = await searchEntitiesRepository("Cruz", "member", 5);
      expect(Array.isArray(results)).toBe(true);
      for (const r of results) {
        expect(r.type).toBe("member");
      }
    },
  );

  it.skipIf(!hasCoreData)(
    "get_donor_profile: getDonorProfileRepository returns null for unknown donor",
    async () => {
      const { getDonorProfileRepository } = await import("@/lib/data/repository");
      const result = await getDonorProfileRepository("nonexistent-donor-xyz");
      expect(result === null || typeof result === "object").toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "search_donors: getDonorProfilesRepository returns array",
    async () => {
      const { getDonorProfilesRepository } = await import("@/lib/data/repository");
      const donors = await getDonorProfilesRepository(10);
      expect(Array.isArray(donors)).toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "get_funding_profile: getFundingProfileRepository returns object or null",
    async () => {
      const { getFundingProfileRepository } = await import("@/lib/data/repository");
      const result = await getFundingProfileRepository("nonexistent-id-xyz");
      expect(result === null || typeof result === "object").toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "rank_entities(committee): rankEntitiesRepository returns array",
    async () => {
      const { rankEntitiesRepository } = await import("@/lib/data/repository");
      const rankings = await rankEntitiesRepository({ type: "committee", limit: 10 });
      expect(Array.isArray(rankings)).toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "rank_entities(candidate): rankEntitiesRepository returns array",
    async () => {
      const { rankEntitiesRepository } = await import("@/lib/data/repository");
      const rankings = await rankEntitiesRepository({ type: "candidate", limit: 10 });
      expect(Array.isArray(rankings)).toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "rank_entities(member): rankEntitiesRepository returns array",
    async () => {
      const { rankEntitiesRepository } = await import("@/lib/data/repository");
      const rankings = await rankEntitiesRepository({ type: "member", limit: 10 });
      expect(Array.isArray(rankings)).toBe(true);
    },
  );

  it.skipIf(!hasCoreData)(
    "get_committee_recipients: getCommitteeRecipientsRepository returns array",
    async () => {
      const { getCommitteeRecipientsRepository } = await import("@/lib/data/repository");
      const recipients = await getCommitteeRecipientsRepository("C00000000", 25);
      expect(Array.isArray(recipients)).toBe(true);
    },
  );
});

// ─── Votes ───────────────────────────────────────────────────────────────────

describe("MCP tool data layer: Votes", () => {
  const hasHouseVotes =
    hasFile("congress.house-votes.json") &&
    hasFile("congress.house-vote-member-votes.json");
  const hasSenateVotes =
    hasFile("congress.senate-votes.json") &&
    hasFile("congress.senate-vote-member-votes.json");

  it.skipIf(!hasHouseVotes)(
    "analyze_vote_funding(house): analyzeHouseVoteFundingRepository returns object or null",
    async () => {
      const { analyzeHouseVoteFundingRepository } = await import("@/lib/data/repository");
      const result = await analyzeHouseVoteFundingRepository({});
      expect(result === null || typeof result === "object").toBe(true);
    },
  );

  it.skipIf(!hasSenateVotes)(
    "analyze_vote_funding(senate): analyzeSenateVoteFundingRepository returns object or null",
    async () => {
      const { analyzeSenateVoteFundingRepository } = await import("@/lib/data/repository");
      const result = await analyzeSenateVoteFundingRepository({});
      expect(result === null || typeof result === "object").toBe(true);
    },
  );

  it.skipIf(!hasHouseVotes)(
    "get_member_votes(house): getRecentMemberVotePositionsRepository returns array",
    async () => {
      const { getRecentMemberVotePositionsRepository } = await import("@/lib/data/repository");
      const results = await getRecentMemberVotePositionsRepository({
        bioguideId: "C001098",
        chamber: "H",
        limit: 5,
      });
      expect(Array.isArray(results)).toBe(true);
    },
  );

  it.skipIf(!hasSenateVotes)(
    "get_member_votes(senate): getRecentMemberVotePositionsRepository returns array",
    async () => {
      const { getRecentMemberVotePositionsRepository } = await import("@/lib/data/repository");
      const results = await getRecentMemberVotePositionsRepository({
        bioguideId: "C001098",
        chamber: "S",
        limit: 5,
      });
      expect(Array.isArray(results)).toBe(true);
    },
  );
});

// ─── States ──────────────────────────────────────────────────────────────────

describe("MCP tool data layer: States", () => {
  it.skipIf(!hasFile("outcomes.states.json"))(
    "get_state_outcome: getLatestStateOutcomesRepository returns array with stateCode",
    async () => {
      const { getLatestStateOutcomesRepository } = await import("@/lib/data/repository");
      const outcomes = await getLatestStateOutcomesRepository();
      expect(Array.isArray(outcomes)).toBe(true);
      expect(outcomes.length).toBeGreaterThan(0);
      const sample = outcomes[0];
      expect(sample).toHaveProperty("stateCode");
      expect(typeof sample.stateCode).toBe("string");
      expect(sample.stateCode).toHaveLength(2);
    },
  );

  it.skipIf(!hasFile("outcomes.states.json"))(
    "get_state_outcome: can filter by CA",
    async () => {
      const { getLatestStateOutcomesRepository } = await import("@/lib/data/repository");
      const outcomes = await getLatestStateOutcomesRepository();
      const ca = outcomes.find((row) => row.stateCode === "CA");
      expect(ca).toBeDefined();
      expect(ca!.stateCode).toBe("CA");
    },
  );

  it.skipIf(!hasFile("outcomes.states.json"))(
    "compare_states: can filter outcomes for CA and TX",
    async () => {
      const { getLatestStateOutcomesRepository } = await import("@/lib/data/repository");
      const outcomes = await getLatestStateOutcomesRepository();
      const codes = ["CA", "TX"];
      const filtered = codes.map((code) => ({
        stateCode: code,
        outcomes: outcomes.filter((row) => row.stateCode === code),
      }));
      expect(filtered).toHaveLength(2);
      expect(filtered[0].outcomes.length).toBeGreaterThan(0);
      expect(filtered[1].outcomes.length).toBeGreaterThan(0);
    },
  );
});

// ─── Contracts ───────────────────────────────────────────────────────────────

describe("MCP tool data layer: Contracts", () => {
  it.skipIf(!hasFile("usaspending.contracts.json"))(
    "get_top_contractors: getTopContractorsRepository returns array",
    async () => {
      const { getTopContractorsRepository } = await import("@/lib/data/repository");
      const contractors = await getTopContractorsRepository(50);
      expect(Array.isArray(contractors)).toBe(true);
    },
  );

  it.skipIf(!hasFile("usaspending.contracts.json"))(
    "get_contracts_by_company: getContractsByCompanyRepository returns array",
    async () => {
      const { getContractsByCompanyRepository } = await import("@/lib/data/repository");
      const contracts = await getContractsByCompanyRepository("test", 50);
      expect(Array.isArray(contracts)).toBe(true);
    },
  );
});

// ─── Lobbying ────────────────────────────────────────────────────────────────

describe("MCP tool data layer: Lobbying", () => {
  it.skipIf(!hasFile("lda.lobbying-clients.json"))(
    "get_lobbying_clients: getLobbyingClientsRepository returns array",
    async () => {
      const { getLobbyingClientsRepository } = await import("@/lib/data/repository");
      const clients = await getLobbyingClientsRepository(50);
      expect(Array.isArray(clients)).toBe(true);
    },
  );

  it.skipIf(!hasFile("lda.lobbying-filings.json"))(
    "get_lobbying_by_client: getLobbyingByClientRepository returns object or null",
    async () => {
      const { getLobbyingByClientRepository } = await import("@/lib/data/repository");
      const result = await getLobbyingByClientRepository("nonexistent-client-xyz");
      expect(result === null || typeof result === "object").toBe(true);
    },
  );

  it.skipIf(!hasFile("lda.lobbying-contributions.json"))(
    "get_lobbyist_contributions: getLobbyistContributionsForMemberRepository returns array",
    async () => {
      const { getLobbyistContributionsForMemberRepository } = await import("@/lib/data/repository");
      const contributions = await getLobbyistContributionsForMemberRepository("test", 50);
      expect(Array.isArray(contributions)).toBe(true);
    },
  );

  it.skipIf(!hasFile("lda.lobbying-filings.json"))(
    "get_bills_lobbied: getBillsLobbiedRepository returns array",
    async () => {
      const { getBillsLobbiedRepository } = await import("@/lib/data/repository");
      const bills = await getBillsLobbiedRepository(50);
      expect(Array.isArray(bills)).toBe(true);
    },
  );
});

// ─── Insider trades ──────────────────────────────────────────────────────────

describe("MCP tool data layer: Insider trades", () => {
  it.skipIf(!hasFile("sec.insider-trades.json"))(
    "get_insider_trades: getInsiderTradesByCompanyRepository returns object with trades array",
    async () => {
      const { getInsiderTradesByCompanyRepository } = await import("@/lib/data/repository");
      const result = await getInsiderTradesByCompanyRepository("AAPL", 50);
      expect(result).toHaveProperty("trades");
      expect(Array.isArray(result.trades)).toBe(true);
      expect(result).toHaveProperty("summary");
    },
  );

  it.skipIf(!hasFile("sec.insider-trade-summaries.json"))(
    "get_insider_trade_rankings: getInsiderTradeSummariesRepository returns array",
    async () => {
      const { getInsiderTradeSummariesRepository } = await import("@/lib/data/repository");
      const summaries = await getInsiderTradeSummariesRepository(50);
      expect(Array.isArray(summaries)).toBe(true);
      if (summaries.length > 0) {
        expect(summaries[0]).toHaveProperty("ticker");
        expect(summaries[0]).toHaveProperty("netValue");
      }
    },
  );
});

// ─── Congress trades ─────────────────────────────────────────────────────────

describe("MCP tool data layer: Congress trades", () => {
  it.skipIf(!hasFile("congress.trade-disclosures.json"))(
    "get_congress_trade_disclosures: readCongressTradeDisclosures returns filterable array",
    async () => {
      const { readCongressTradeDisclosures } = await import("@/lib/ingest/storage");
      const disclosures = await readCongressTradeDisclosures();
      expect(Array.isArray(disclosures)).toBe(true);
      if (disclosures.length > 0) {
        const sample = disclosures[0];
        expect(sample).toHaveProperty("memberName");
        expect(sample).toHaveProperty("state");
        expect(sample).toHaveProperty("filingDate");
        expect(typeof sample.memberName).toBe("string");
      }
    },
  );

  it.skipIf(!hasFile("congress.trade-disclosures.json"))(
    "get_congress_trade_disclosures: filtering by member name works",
    async () => {
      const { readCongressTradeDisclosures } = await import("@/lib/ingest/storage");
      const disclosures = await readCongressTradeDisclosures();
      if (disclosures.length > 0) {
        const targetName = disclosures[0].memberName.toLowerCase();
        const filtered = disclosures.filter((d) =>
          d.memberName.toLowerCase().includes(targetName),
        );
        expect(filtered.length).toBeGreaterThan(0);
        for (const d of filtered) {
          expect(d.memberName.toLowerCase()).toContain(targetName);
        }
      }
    },
  );
});
