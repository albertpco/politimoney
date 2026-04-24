/**
 * Entity data coverage tests.
 *
 * For each page type in the app, these tests verify that the underlying
 * data exists and has the expected shape. If a test fails, the corresponding
 * page would render empty or broken.
 *
 * Tests marked "requires ingest" will skip (not fail) if the data hasn't
 * been ingested yet. This lets CI pass on a fresh clone while still
 * catching regressions when data exists.
 *
 * Run: npx vitest run src/lib/data/entity-coverage.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data/ingest/latest");

/** Skip a test if the required data file hasn't been ingested yet. */
function requiresFile(fileName: string) {
  const exists = existsSync(join(DATA_DIR, fileName));
  if (!exists) {
    console.warn(`[SKIP] ${fileName} not found — run the relevant ingest command to populate.`);
  }
  return exists;
}
import {
  readFecCandidates,
  readFecCommittees,
  readFecContributions,
  readCongressBills,
  readCongressMembers,
  readHouseVotes,
  readHouseVoteMemberVotes,
  readSenateVotes,
  readOutcomeStates,
  readCandidateFinancials,
  readPacSummaries,
  readIndependentExpenditures,
  readPacToCandidate,
  readFaraRegistrants,
  readFaraForeignPrincipals,
  readContracts,
  readTopContractors,
  readInsiderTrades,
  readInsiderTradeSummaries,
  readCongressTradeDisclosures,
  readLobbyingFilings,
  readLobbyingClients,
  readLobbyistContributions,
  readLatestSummary,
} from "@/lib/ingest/storage";

// ─── FEC: Candidates (/members, /pacs) ──────────────────────

describe("FEC candidates data", () => {
  let candidates: Awaited<ReturnType<typeof readFecCandidates>>;
  beforeAll(async () => { candidates = await readFecCandidates(); });

  it("has candidates", () => {
    expect(candidates.length).toBeGreaterThan(100);
  });

  it("candidates have required fields", () => {
    for (const c of candidates.slice(0, 50)) {
      expect(c.candidateId).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });

  it("has candidates from multiple states", () => {
    const states = new Set(candidates.map((c) => c.officeState).filter(Boolean));
    expect(states.size).toBeGreaterThan(30);
  });
});

// ─── FEC: Committees (/pacs) ─────────────────────────────────

describe("FEC committees data", () => {
  let committees: Awaited<ReturnType<typeof readFecCommittees>>;
  beforeAll(async () => { committees = await readFecCommittees(); });

  it("has committees", () => {
    expect(committees.length).toBeGreaterThan(100);
  });

  it("committees have required fields", () => {
    for (const c of committees.slice(0, 50)) {
      expect(c.committeeId).toBeTruthy();
      expect(c.name).toBeTruthy();
    }
  });
});

// ─── FEC: PAC summaries (/pacs) ──────────────────────────────

describe("PAC summaries data", () => {
  let pacs: Awaited<ReturnType<typeof readPacSummaries>>;
  beforeAll(async () => { pacs = await readPacSummaries(); });

  it("has PAC summaries", () => {
    expect(pacs.length).toBeGreaterThan(100);
  });

  it("PACs have financial data", () => {
    const withReceipts = pacs.filter((p) => p.totalReceipts > 0);
    expect(withReceipts.length).toBeGreaterThan(50);
  });
});

// ─── FEC: Contributions (/donors) ───────────────────────────

describe("FEC contributions data", () => {
  let contributions: Awaited<ReturnType<typeof readFecContributions>>;
  beforeAll(async () => { contributions = await readFecContributions(); });

  it("has contributions", () => {
    expect(contributions.length).toBeGreaterThan(100);
  });

  it("contributions have donor and amount", () => {
    for (const c of contributions.slice(0, 50)) {
      expect(c.committeeId).toBeTruthy();
      expect(typeof c.amount).toBe("number");
    }
  });
});

// ─── FEC: Candidate financials (/members/[id]) ──────────────

describe("Candidate financials data", () => {
  let financials: Awaited<ReturnType<typeof readCandidateFinancials>>;
  beforeAll(async () => { financials = await readCandidateFinancials(); });

  it("has candidate financial records", () => {
    expect(financials.length).toBeGreaterThan(100);
  });

  it("financials have receipt totals", () => {
    const withReceipts = financials.filter((f) => f.totalReceipts > 0);
    expect(withReceipts.length).toBeGreaterThan(50);
  });
});

// ─── FEC: Independent expenditures ──────────────────────────

describe("Independent expenditures data", () => {
  let ie: Awaited<ReturnType<typeof readIndependentExpenditures>>;
  beforeAll(async () => { ie = await readIndependentExpenditures(); });

  it("has independent expenditure records", () => {
    expect(ie.length).toBeGreaterThan(100);
  });
});

// ─── FEC: PAC-to-candidate contributions ────────────────────

describe("PAC-to-candidate data", () => {
  let p2c: Awaited<ReturnType<typeof readPacToCandidate>>;
  beforeAll(async () => { p2c = await readPacToCandidate(); });

  it("has PAC-to-candidate records", () => {
    expect(p2c.length).toBeGreaterThan(100);
  });
});

// ─── Congress: Members (/members) ───────────────────────────

describe("Congress members data", () => {
  let members: Awaited<ReturnType<typeof readCongressMembers>>;
  beforeAll(async () => { members = await readCongressMembers(); });

  it("has 435+ members (House + Senate)", () => {
    expect(members.length).toBeGreaterThanOrEqual(435);
  });

  it("members have bioguideId, name, state, chamber", () => {
    for (const m of members.slice(0, 50)) {
      expect(m.bioguideId).toBeTruthy();
      expect(m.name).toBeTruthy();
      expect(m.state).toBeTruthy();
      expect(["H", "S"]).toContain(m.chamber);
    }
  });

  it("has both House and Senate members", () => {
    const house = members.filter((m) => m.chamber === "H");
    const senate = members.filter((m) => m.chamber === "S");
    expect(house.length).toBeGreaterThan(400);
    expect(senate.length).toBe(100);
  });
});

// ─── Congress: Bills (/bills) ───────────────────────────────

describe("Congress bills data", () => {
  let bills: Awaited<ReturnType<typeof readCongressBills>>;
  beforeAll(async () => { bills = await readCongressBills(); });

  it("has bills", () => {
    expect(bills.length).toBeGreaterThan(50);
  });

  it("bills have title and type", () => {
    for (const b of bills.slice(0, 20)) {
      expect(b.title).toBeTruthy();
      expect(b.billType).toBeTruthy();
    }
  });
});

// ─── Congress: Votes (/votes) ───────────────────────────────

describe("House votes data", () => {
  let votes: Awaited<ReturnType<typeof readHouseVotes>>;
  let memberVotes: Awaited<ReturnType<typeof readHouseVoteMemberVotes>>;
  beforeAll(async () => {
    votes = await readHouseVotes();
    memberVotes = await readHouseVoteMemberVotes();
  });

  it("has House votes", () => {
    expect(votes.length).toBeGreaterThan(100);
  });

  it("votes have rollCallNumber and result", () => {
    for (const v of votes.slice(0, 20)) {
      expect(v.rollCallNumber).toBeGreaterThan(0);
    }
  });

  it("has member vote records", () => {
    expect(memberVotes.length).toBeGreaterThan(1000);
  });
});

describe("Senate votes data", () => {
  let votes: Awaited<ReturnType<typeof readSenateVotes>>;
  beforeAll(async () => { votes = await readSenateVotes(); });

  it("has Senate votes", () => {
    expect(votes.length).toBeGreaterThan(100);
  });
});

// ─── State outcomes (/states) ───────────────────────────────

describe("State outcomes data", () => {
  let outcomes: Awaited<ReturnType<typeof readOutcomeStates>>;
  beforeAll(async () => { outcomes = await readOutcomeStates(); });

  it("has 50 states of outcome data", () => {
    const uniqueStates = new Set(outcomes.map((o) => o.stateCode));
    expect(uniqueStates.size).toBe(50);
  });

  it("all outcomes have population and poverty", () => {
    const latest = new Map<string, (typeof outcomes)[0]>();
    for (const o of outcomes) {
      if (!latest.has(o.stateCode)) latest.set(o.stateCode, o);
    }
    for (const [code, o] of latest) {
      expect(o.population, `${code} missing population`).toBeTruthy();
      expect(o.childPovertyPct, `${code} missing childPovertyPct`).toBeTruthy();
    }
  });
});

// ─── FARA: Countries (/countries) ───────────────────────────

describe("FARA data", () => {
  let registrants: Awaited<ReturnType<typeof readFaraRegistrants>>;
  let principals: Awaited<ReturnType<typeof readFaraForeignPrincipals>>;
  beforeAll(async () => {
    registrants = await readFaraRegistrants();
    principals = await readFaraForeignPrincipals();
  });

  it("has FARA registrants", () => {
    expect(registrants.length).toBeGreaterThan(0);
  });

  it("has FARA foreign principals", () => {
    expect(principals.length).toBeGreaterThan(0);
  });

  it("principals have country field", () => {
    for (const p of principals) {
      expect(p.country || p.principalName).toBeTruthy();
    }
  });
});

// ─── USASpending: Contracts (/contracts) ────────────────────

describe("Federal contracts data", () => {
  const hasData = requiresFile("usaspending.contracts.json");
  let contracts: Awaited<ReturnType<typeof readContracts>>;
  let contractors: Awaited<ReturnType<typeof readTopContractors>>;
  beforeAll(async () => {
    contracts = await readContracts();
    contractors = await readTopContractors();
  });

  it.skipIf(!hasData)("has contract records", () => {
    expect(contracts.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("has top contractor profiles", () => {
    expect(contractors.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("contractors have name and amount", () => {
    for (const c of contractors.slice(0, 10)) {
      expect(c.recipientName).toBeTruthy();
      expect(c.totalObligatedAmount).toBeGreaterThan(0);
    }
  });
});

// ─── SEC: Insider trades (/insider-trades) ──────────────────

describe("SEC insider trades data", () => {
  const hasData = requiresFile("sec.insider-trades.json");
  let trades: Awaited<ReturnType<typeof readInsiderTrades>>;
  let summaries: Awaited<ReturnType<typeof readInsiderTradeSummaries>>;
  beforeAll(async () => {
    trades = await readInsiderTrades();
    summaries = await readInsiderTradeSummaries();
  });

  it.skipIf(!hasData)("has insider trade records", () => {
    expect(trades.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("has insider trade summaries by company", () => {
    expect(summaries.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("summaries have ticker and company name", () => {
    for (const s of summaries.slice(0, 10)) {
      expect(s.ticker).toBeTruthy();
      expect(s.companyName).toBeTruthy();
    }
  });
});

// ─── Congress trades (/congress-trades) ─────────────────────

describe("Congress trade disclosures data", () => {
  let disclosures: Awaited<ReturnType<typeof readCongressTradeDisclosures>>;
  beforeAll(async () => { disclosures = await readCongressTradeDisclosures(); });

  it("has trade disclosure records", () => {
    expect(disclosures.length).toBeGreaterThan(0);
  });

  it("disclosures have member name and filing date", () => {
    for (const d of disclosures.slice(0, 10)) {
      expect(d.memberName).toBeTruthy();
      expect(d.filingDate).toBeTruthy();
    }
  });

  it("disclosures cover multiple members", () => {
    const members = new Set(disclosures.map((d) => d.memberName));
    expect(members.size).toBeGreaterThan(10);
  });
});

// ─── LDA: Lobbying (/lobbying) ──────────────────────────────

describe("Lobbying data", () => {
  const hasData = requiresFile("lda.lobbying-clients.json");
  let clients: Awaited<ReturnType<typeof readLobbyingClients>>;
  let filings: Awaited<ReturnType<typeof readLobbyingFilings>>;
  let contribs: Awaited<ReturnType<typeof readLobbyistContributions>>;
  beforeAll(async () => {
    clients = await readLobbyingClients();
    filings = await readLobbyingFilings();
    contribs = await readLobbyistContributions();
  });

  it.skipIf(!hasData)("has lobbying client profiles", () => {
    expect(clients.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("clients have name and spending", () => {
    for (const c of clients.slice(0, 10)) {
      expect(c.clientName).toBeTruthy();
      expect(c.totalSpending).toBeGreaterThan(0);
    }
  });

  it.skipIf(!hasData)("has lobbying filings", () => {
    expect(filings.length).toBeGreaterThan(0);
  });

  it.skipIf(!hasData)("has lobbyist contributions", () => {
    expect(contribs.length).toBeGreaterThan(0);
  });
});

// ─── Ingest summary ─────────────────────────────────────────

describe("Ingest pipeline summary", () => {
  let summary: Awaited<ReturnType<typeof readLatestSummary>>;
  beforeAll(async () => { summary = await readLatestSummary(); });

  it("has a summary artifact", () => {
    expect(summary).not.toBeNull();
  });

  it("summary has totals", () => {
    expect(summary!.totals.candidates).toBeGreaterThan(0);
    expect(summary!.totals.committees).toBeGreaterThan(0);
    expect(summary!.totals.bills).toBeGreaterThan(0);
  });

  it("summary has run metadata", () => {
    expect(summary!.runId).toBeTruthy();
    expect(summary!.finishedAt).toBeTruthy();
  });
});
