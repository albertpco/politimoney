import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CongressBill,
  CongressMember,
  FaraForeignPrincipal,
  FecCandidate,
  FecCandidateFinancials,
  FecCommittee,
  FecContribution,
  FecPacSummary,
  GovernmentContract,
  HouseRollCallMemberVote,
  HouseRollCallVote,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";
import type { OutcomeRow } from "@/lib/state-outcomes";

vi.mock("@/lib/db/client", () => ({
  getPrismaClient: () => null,
}));

const storage = vi.hoisted(() => ({
  latestArtifacts: null as Awaited<ReturnType<typeof import("@/lib/ingest/storage").readLatestArtifacts>>,
  latestSummary: null,
  fecCandidates: [] as FecCandidate[],
  fecCommittees: [] as FecCommittee[],
  fecContributions: [] as FecContribution[],
  faraForeignPrincipals: [] as FaraForeignPrincipal[],
  congressBills: [] as CongressBill[],
  congressMembers: [] as CongressMember[],
  houseVotes: [] as HouseRollCallVote[],
  houseVoteMemberVotes: [] as HouseRollCallMemberVote[],
  senateVotes: [] as SenateRollCallVote[],
  senateVoteMemberVotes: [] as SenateRollCallMemberVote[],
  outcomeStates: [] as OutcomeRow[],
  candidateFinancials: [] as FecCandidateFinancials[],
  fundingReadModels: null,
  pacSummaries: [] as FecPacSummary[],
  contracts: [] as GovernmentContract[],
  topContractors: [],
  voteFundingSummaries: null,
  lobbyingClients: [],
  lobbyingFilings: [],
  lobbyistContributions: [],
  insiderTradeSummaries: [],
  insiderTrades: [],
}));

vi.mock("@/lib/ingest/storage", () => ({
  readLatestArtifacts: vi.fn(() => Promise.resolve(storage.latestArtifacts)),
  readLatestSummary: vi.fn(() => Promise.resolve(storage.latestSummary)),
  readFecCandidates: vi.fn(() => Promise.resolve(storage.fecCandidates)),
  readFecCommittees: vi.fn(() => Promise.resolve(storage.fecCommittees)),
  readFecContributions: vi.fn(() => Promise.resolve(storage.fecContributions)),
  readFaraForeignPrincipals: vi.fn(() => Promise.resolve(storage.faraForeignPrincipals)),
  readCongressBills: vi.fn(() => Promise.resolve(storage.congressBills)),
  readCongressMembers: vi.fn(() => Promise.resolve(storage.congressMembers)),
  readHouseVotes: vi.fn(() => Promise.resolve(storage.houseVotes)),
  readHouseVoteMemberVotes: vi.fn(() => Promise.resolve(storage.houseVoteMemberVotes)),
  readOutcomeStates: vi.fn(() => Promise.resolve(storage.outcomeStates)),
  readSenateVotes: vi.fn(() => Promise.resolve(storage.senateVotes)),
  readSenateVoteMemberVotes: vi.fn(() => Promise.resolve(storage.senateVoteMemberVotes)),
  readCandidateFinancials: vi.fn(() => Promise.resolve(storage.candidateFinancials)),
  readFundingReadModels: vi.fn(() => Promise.resolve(storage.fundingReadModels)),
  readPacSummaries: vi.fn(() => Promise.resolve(storage.pacSummaries)),
  readContracts: vi.fn(() => Promise.resolve(storage.contracts)),
  readTopContractors: vi.fn(() => Promise.resolve(storage.topContractors)),
  readVoteFundingSummaries: vi.fn(() => Promise.resolve(storage.voteFundingSummaries)),
  readLobbyingClients: vi.fn(() => Promise.resolve(storage.lobbyingClients)),
  readLobbyingFilings: vi.fn(() => Promise.resolve(storage.lobbyingFilings)),
  readLobbyistContributions: vi.fn(() => Promise.resolve(storage.lobbyistContributions)),
  readInsiderTradeSummaries: vi.fn(() => Promise.resolve(storage.insiderTradeSummaries)),
  readInsiderTrades: vi.fn(() => Promise.resolve(storage.insiderTrades)),
}));

beforeEach(() => {
  storage.latestArtifacts = null;
  storage.latestSummary = null;
  storage.fecCandidates = [];
  storage.fecCommittees = [];
  storage.fecContributions = [];
  storage.faraForeignPrincipals = [];
  storage.congressBills = [];
  storage.congressMembers = [];
  storage.houseVotes = [];
  storage.houseVoteMemberVotes = [];
  storage.senateVotes = [];
  storage.senateVoteMemberVotes = [];
  storage.outcomeStates = [];
  storage.candidateFinancials = [];
  storage.fundingReadModels = null;
  storage.pacSummaries = [];
  storage.contracts = [];
  storage.topContractors = [];
  storage.voteFundingSummaries = null;
  storage.lobbyingClients = [];
  storage.lobbyingFilings = [];
  storage.lobbyistContributions = [];
  storage.insiderTradeSummaries = [];
  storage.insiderTrades = [];
});

describe("repository JSON fallback with deterministic fixtures", () => {
  it("sorts House votes by congress, session, and roll call descending before applying limit", async () => {
    const { getLatestHouseVotesRepository } = await import("./repository");
    storage.houseVotes = [
      houseVote({ voteId: "old", congress: 118, session: 2, rollCallNumber: 500 }),
      houseVote({ voteId: "newer-roll", congress: 119, session: 1, rollCallNumber: 12 }),
      houseVote({ voteId: "newer-session", congress: 119, session: 2, rollCallNumber: 1 }),
    ];

    const votes = await getLatestHouseVotesRepository(2);

    expect(votes.map((vote) => vote.voteId)).toEqual(["newer-session", "newer-roll"]);
  });

  it("sorts Senate votes by congress, session, and roll call descending before applying limit", async () => {
    const { getLatestSenateVotesRepository } = await import("./repository");
    storage.senateVotes = [
      senateVote({ voteId: "119-1-10", congress: 119, session: 1, rollCallNumber: 10 }),
      senateVote({ voteId: "119-1-11", congress: 119, session: 1, rollCallNumber: 11 }),
      senateVote({ voteId: "118-2-99", congress: 118, session: 2, rollCallNumber: 99 }),
    ];

    const votes = await getLatestSenateVotesRepository(2);

    expect(votes.map((vote) => vote.voteId)).toEqual(["119-1-11", "119-1-10"]);
  });

  it("keeps the last state outcome row per state in JSON fallback mode", async () => {
    const { getLatestStateOutcomesRepository } = await import("./repository");
    storage.outcomeStates = [
      outcomeRow({ stateCode: "CA", year: 2022, population: 39_000_000 }),
      outcomeRow({ stateCode: "TX", year: 2023, population: 30_000_000 }),
      outcomeRow({ stateCode: "CA", year: 2023, population: 39_200_000 }),
    ];

    const rows = await getLatestStateOutcomesRepository();

    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.stateCode === "CA")?.population).toBe(39_200_000);
  });

  it("ranks committees by PAC disbursements and filters zero-disbursement rows", async () => {
    const { rankEntitiesRepository } = await import("./repository");
    storage.pacSummaries = [
      pacSummary({ committeeId: "C_LOW", name: "Low Committee", totalDisbursements: 100 }),
      pacSummary({ committeeId: "C_ZERO", name: "Zero Committee", totalDisbursements: 0 }),
      pacSummary({ committeeId: "C_HIGH", name: "High Committee", totalDisbursements: 900 }),
    ];

    const ranked = await rankEntitiesRepository({ type: "committee", limit: 5 });

    expect(ranked.map((row) => [row.rank, row.id, row.totalReceipts])).toEqual([
      [1, "C_HIGH", 900],
      [2, "C_LOW", 100],
    ]);
  });

  it("ranks candidates by total receipts and applies the requested limit", async () => {
    const { rankEntitiesRepository } = await import("./repository");
    storage.candidateFinancials = [
      candidateFinancials({ candidateId: "P1", name: "First", totalReceipts: 250 }),
      candidateFinancials({ candidateId: "P2", name: "Second", totalReceipts: 1_000 }),
      candidateFinancials({ candidateId: "P3", name: "Third", totalReceipts: 500 }),
    ];

    const ranked = await rankEntitiesRepository({ type: "candidate", limit: 2 });

    expect(ranked.map((row) => [row.rank, row.id, row.totalReceipts])).toEqual([
      [1, "P2", 1_000],
      [2, "P3", 500],
    ]);
  });

  it("returns a committee funding profile directly from PAC summaries", async () => {
    const { getFundingProfileRepository } = await import("./repository");
    storage.pacSummaries = [
      pacSummary({
        committeeId: "C_PROFILE",
        name: "Profile Committee",
        totalReceipts: 1_200,
        totalDisbursements: 700,
        independentExpenditures: 300,
        cashOnHand: 200,
      }),
    ];

    const profile = await getFundingProfileRepository(" c_profile ");

    expect(profile).toMatchObject({
      entityType: "committee",
      entityId: "C_PROFILE",
      label: "Profile Committee",
      committeeIds: ["C_PROFILE"],
      totalReceipts: 1_200,
      totalDisbursements: 700,
      independentExpenditures: 300,
      cashOnHand: 200,
    });
  });

  it("searches members, candidates, committees, bills, and donors with normalized text", async () => {
    const { searchEntitiesRepository } = await import("./repository");
    storage.congressMembers = [
      member({ bioguideId: "M001", name: "Jane Public", firstName: "Jane", lastName: "Public", state: "CA" }),
    ];
    storage.fecCandidates = [
      candidate({ candidateId: "P001", name: "PUBLIC, JANE", officeState: "CA" }),
    ];
    storage.pacSummaries = [
      pacSummary({ committeeId: "C001", name: "Public Accountability PAC", totalDisbursements: 100 }),
    ];
    storage.congressBills = [
      bill({ billNumber: "42", title: "Public Records Transparency Act" }),
    ];
    storage.fundingReadModels = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      profiles: [],
      donors: [
        {
          id: "donor-public",
          donor: "Public Citizen",
          donorType: "person",
          total: 100,
          rows: 1,
          topRecipients: [],
        },
      ],
    };

    const results = await searchEntitiesRepository("public", undefined, 10);

    expect(results.map((result) => result.type)).toEqual([
      "member",
      "candidate",
      "committee",
      "bill",
      "donor",
    ]);
  });

  it("looks up donor profiles by id or exact donor name case-insensitively", async () => {
    const { getDonorProfileRepository } = await import("./repository");
    storage.fundingReadModels = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      profiles: [],
      donors: [
        {
          id: "donor-1",
          donor: "Jane Public",
          donorType: "person",
          total: 500,
          rows: 2,
          topRecipients: [],
        },
      ],
    };

    await expect(getDonorProfileRepository("DONOR-1")).resolves.toMatchObject({
      donor: "Jane Public",
    });
    await expect(getDonorProfileRepository(" jane public ")).resolves.toMatchObject({
      id: "donor-1",
    });
  });

  it("uses derived vote funding summaries before rebuilding vote analysis", async () => {
    const { analyzeHouseVoteFundingRepository } = await import("./repository");
    storage.voteFundingSummaries = {
      generatedAt: "2026-01-01T00:00:00.000Z",
      house: [
        {
          voteId: "h-derived",
          billId: "119-hr-1",
          question: "On Passage",
          result: "Passed",
          groups: [
            {
              voteCast: "Yea",
              memberCount: 2,
              matchedCandidateCount: 2,
              totalReceipts: 1_000,
              averageReceipts: 500,
              topMembers: [
                {
                  bioguideId: "M001",
                  candidateId: "P001",
                  name: "Jane Public",
                  totalReceipts: 700,
                },
              ],
            },
          ],
        },
      ],
      senate: [],
    };

    const analysis = await analyzeHouseVoteFundingRepository({ billId: "119-hr-1" });

    expect(analysis).toMatchObject({
      voteId: "h-derived",
      billId: "119-hr-1",
      groups: [
        {
          voteCast: "Yea",
          memberCount: 2,
          totalReceipts: 1_000,
        },
      ],
    });
  });

  it("filters contracts by company name case-insensitively and sorts by award amount", async () => {
    const { getContractsByCompanyRepository } = await import("./repository");
    storage.contracts = [
      contract({ id: "small", recipientName: "Acme Defense LLC", awardAmount: 100 }),
      contract({ id: "other", recipientName: "Other Vendor", awardAmount: 1_000 }),
      contract({ id: "large", recipientName: "ACME Systems", awardAmount: 900 }),
    ];

    const contracts = await getContractsByCompanyRepository("acme", 5);

    expect(contracts.map((contract) => contract.id)).toEqual(["large", "small"]);
  });

  it("sorts lobbying clients by total spending", async () => {
    const { getLobbyingClientsRepository } = await import("./repository");
    storage.lobbyingClients = [
      { clientName: "Lower", totalSpending: 100 },
      { clientName: "Higher", totalSpending: 900 },
      { clientName: "Middle", totalSpending: 300 },
    ];

    const clients = await getLobbyingClientsRepository(2);

    expect(clients.map((client) => client.clientName)).toEqual(["Higher", "Middle"]);
  });

  it("sorts insider trade summaries by absolute net value", async () => {
    const { getInsiderTradeSummariesRepository } = await import("./repository");
    storage.insiderTradeSummaries = [
      { ticker: "AAA", companyName: "A Corp", netValue: 50 },
      { ticker: "BBB", companyName: "B Corp", netValue: -700 },
      { ticker: "CCC", companyName: "C Corp", netValue: 200 },
    ];

    const summaries = await getInsiderTradeSummariesRepository(2);

    expect(summaries.map((summary) => summary.ticker)).toEqual(["BBB", "CCC"]);
  });
});

function houseVote(overrides: Partial<HouseRollCallVote>): HouseRollCallVote {
  return {
    voteId: "vote",
    congress: 119,
    session: 1,
    rollCallNumber: 1,
    result: "Passed",
    voteQuestion: "Question",
    ...overrides,
  };
}

function senateVote(overrides: Partial<SenateRollCallVote>): SenateRollCallVote {
  return {
    voteId: "vote",
    congress: 119,
    session: 1,
    rollCallNumber: 1,
    result: "Passed",
    question: "Question",
    ...overrides,
  };
}

function outcomeRow(overrides: Partial<OutcomeRow>): OutcomeRow {
  return {
    stateCode: "CA",
    stateName: "California",
    year: 2024,
    population: 1,
    childPovertyRate: 0,
    mortalityRate: 0,
    fertilityRate: 0,
    medianHouseholdIncome: 0,
    unemploymentRate: 0,
    ...overrides,
  };
}

function pacSummary(overrides: Partial<FecPacSummary>): FecPacSummary {
  return {
    committeeId: "C_TEST",
    name: "Test Committee",
    totalReceipts: 0,
    totalDisbursements: 0,
    ...overrides,
  };
}

function candidateFinancials(
  overrides: Partial<FecCandidateFinancials>,
): FecCandidateFinancials {
  return {
    candidateId: "P_TEST",
    name: "Test Candidate",
    totalReceipts: 0,
    ...overrides,
  };
}

function candidate(overrides: Partial<FecCandidate>): FecCandidate {
  return {
    candidateId: "P_TEST",
    name: "Test Candidate",
    office: "H",
    officeState: "CA",
    principalCommittees: [],
    ...overrides,
  };
}

function member(overrides: Partial<CongressMember>): CongressMember {
  return {
    bioguideId: "M_TEST",
    name: "Test Member",
    state: "CA",
    chamber: "H",
    ...overrides,
  };
}

function bill(overrides: Partial<CongressBill>): CongressBill {
  return {
    congress: 119,
    billType: "hr",
    billNumber: "1",
    title: "Test Bill",
    ...overrides,
  };
}

function contract(overrides: Partial<GovernmentContract>): GovernmentContract {
  return {
    id: "contract",
    recipientName: "Recipient",
    awardAmount: 0,
    awardingAgency: "Agency",
    fiscalYear: 2024,
    ...overrides,
  };
}
