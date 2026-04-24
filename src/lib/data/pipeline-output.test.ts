/**
 * Pipeline output schema tests.
 *
 * Unlike entity-coverage.test.ts (which checks existence and record counts),
 * this file validates the SCHEMA of each record — field types, patterns,
 * and value constraints — for every data pipeline output.
 *
 * Tests marked with skipIf will skip (not fail) when the underlying
 * data file is absent, allowing CI to pass on a fresh clone.
 *
 * Run: npx vitest run src/lib/data/pipeline-output.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import {
  readFecCandidates,
  readFecCommittees,
  readFecContributions,
  readCandidateFinancials,
  readPacSummaries,
  readCandidateCommitteeLinks,
  readIndependentExpenditures,
  readLeadershipPacLinks,
  readPacToCandidate,
  readFaraRegistrants,
  readFaraForeignPrincipals,
  readCongressBills,
  readCongressMembers,
  readHouseVotes,
  readHouseVoteMemberVotes,
  readSenateVotes,
  readSenateVoteMemberVotes,
  readOutcomeStates,
  readCongressTradeDisclosures,
  readContracts,
  readTopContractors,
  readInsiderTrades,
  readInsiderTradeSummaries,
  readLobbyingFilings,
  readLobbyingClients,
  readLobbyistContributions,
  readLatestSummary,
} from "@/lib/ingest/storage";
import { existsSync } from "node:fs";
import { join } from "node:path";

const DATA_DIR = join(process.cwd(), "data/ingest/latest");
function hasFile(name: string) {
  return existsSync(join(DATA_DIR, name));
}

// ─── FEC: Candidates schema ─────────────────────────────────

describe("FEC candidates schema", () => {
  let data: Awaited<ReturnType<typeof readFecCandidates>>;
  beforeAll(async () => {
    data = await readFecCandidates();
  });

  it("candidateId is a string starting with H, S, or P", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.candidateId).toBe("string");
      expect(record.candidateId).toMatch(/^[HSP]/);
    }
  });

  it("name is a non-empty string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
      expect(record.name.length).toBeGreaterThan(0);
    }
  });

  it("office is one of H, S, P", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.office).toBe("string");
      expect(["H", "S", "P"]).toContain(record.office);
    }
  });
});

// ─── FEC: Committees schema ─────────────────────────────────

describe("FEC committees schema", () => {
  let data: Awaited<ReturnType<typeof readFecCommittees>>;
  beforeAll(async () => {
    data = await readFecCommittees();
  });

  it("committeeId is a string starting with C", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
      expect(record.committeeId).toMatch(/^C/);
    }
  });

  it("name is a non-empty string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
      expect(record.name.length).toBeGreaterThan(0);
    }
  });
});

// ─── FEC: Contributions schema ──────────────────────────────

describe("FEC contributions schema", () => {
  let data: Awaited<ReturnType<typeof readFecContributions>>;
  beforeAll(async () => {
    data = await readFecContributions();
  });

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("amount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.amount).toBe("number");
    }
  });

  it("donorName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.donorName).toBe("string");
    }
  });
});

// ─── FEC: Candidate financials schema ───────────────────────

describe("FEC candidate financials schema", () => {
  let data: Awaited<ReturnType<typeof readCandidateFinancials>>;
  beforeAll(async () => {
    data = await readCandidateFinancials();
  });

  it("candidateId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.candidateId).toBe("string");
    }
  });

  it("name is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
    }
  });

  it("totalReceipts is a number or undefined", () => {
    for (const record of data.slice(0, 20)) {
      if (record.totalReceipts !== undefined) {
        expect(typeof record.totalReceipts).toBe("number");
      }
    }
  });
});

// ─── FEC: PAC summaries schema ──────────────────────────────

describe("FEC PAC summaries schema", () => {
  let data: Awaited<ReturnType<typeof readPacSummaries>>;
  beforeAll(async () => {
    data = await readPacSummaries();
  });

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("name is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
    }
  });

  it("totalReceipts is a number or undefined", () => {
    for (const record of data.slice(0, 20)) {
      if (record.totalReceipts !== undefined) {
        expect(typeof record.totalReceipts).toBe("number");
      }
    }
  });

  it("totalDisbursements is a number or undefined", () => {
    for (const record of data.slice(0, 20)) {
      if (record.totalDisbursements !== undefined) {
        expect(typeof record.totalDisbursements).toBe("number");
      }
    }
  });
});

// ─── FEC: Candidate-committee links schema ──────────────────

describe("FEC candidate-committee links schema", () => {
  let data: Awaited<ReturnType<typeof readCandidateCommitteeLinks>>;
  beforeAll(async () => {
    data = await readCandidateCommitteeLinks();
  });

  it("candidateId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.candidateId).toBe("string");
    }
  });

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("candidateElectionYear is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.candidateElectionYear).toBe("number");
    }
  });
});

// ─── FEC: Independent expenditures schema ───────────────────

describe("FEC independent expenditures schema", () => {
  let data: Awaited<ReturnType<typeof readIndependentExpenditures>>;
  beforeAll(async () => {
    data = await readIndependentExpenditures();
  });

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("amount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.amount).toBe("number");
    }
  });

  it("supportOppose is S, O, or undefined", () => {
    for (const record of data.slice(0, 20)) {
      if (record.supportOppose !== undefined) {
        expect(typeof record.supportOppose).toBe("string");
        expect(["S", "O"]).toContain(record.supportOppose);
      }
    }
  });
});

// ─── FEC: Leadership PAC links schema ───────────────────────

describe("FEC leadership PAC links schema", () => {
  let data: Awaited<ReturnType<typeof readLeadershipPacLinks>>;
  beforeAll(async () => {
    data = await readLeadershipPacLinks();
  });

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("candidateId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.candidateId).toBe("string");
    }
  });
});

// ─── FEC: PAC-to-candidate schema ───────────────────────────

describe("FEC PAC-to-candidate schema", () => {
  let data: Awaited<ReturnType<typeof readPacToCandidate>>;
  beforeAll(async () => {
    data = await readPacToCandidate();
  }, 30_000);

  it("committeeId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.committeeId).toBe("string");
    }
  });

  it("amount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.amount).toBe("number");
    }
  });

  it("candidateId is a string when present", () => {
    for (const record of data.slice(0, 20)) {
      if (record.candidateId !== undefined) {
        expect(typeof record.candidateId).toBe("string");
      }
    }
  });
});

// ─── FARA: Registrants schema ───────────────────────────────

describe("FARA registrants schema", () => {
  let data: Awaited<ReturnType<typeof readFaraRegistrants>>;
  beforeAll(async () => {
    data = await readFaraRegistrants();
  });

  it("registrationNumber is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.registrationNumber).toBe("string");
    }
  });

  it("name is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
    }
  });
});

// ─── FARA: Foreign principals schema ────────────────────────

describe("FARA foreign principals schema", () => {
  let data: Awaited<ReturnType<typeof readFaraForeignPrincipals>>;
  beforeAll(async () => {
    data = await readFaraForeignPrincipals();
  });

  it("registrationNumber is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.registrationNumber).toBe("string");
    }
  });

  it("principalName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.principalName).toBe("string");
    }
  });
});

// ─── Congress: Bills schema ─────────────────────────────────

describe("Congress bills schema", () => {
  let data: Awaited<ReturnType<typeof readCongressBills>>;
  beforeAll(async () => {
    data = await readCongressBills();
  });

  it("billType is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.billType).toBe("string");
    }
  });

  it("billNumber is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.billNumber).toBe("string");
    }
  });

  it("title is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.title).toBe("string");
    }
  });

  it("congress is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.congress).toBe("number");
    }
  });
});

// ─── Congress: Members schema ───────────────────────────────

describe("Congress members schema", () => {
  let data: Awaited<ReturnType<typeof readCongressMembers>>;
  beforeAll(async () => {
    data = await readCongressMembers();
  });

  it("bioguideId matches /^[A-Z]\\d{6}$/", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.bioguideId).toBe("string");
      expect(record.bioguideId).toMatch(/^[A-Z]\d{6}$/);
    }
  });

  it("name is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.name).toBe("string");
    }
  });

  it("state is a 2-character string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.state).toBe("string");
      expect(record.state.length).toBe(2);
    }
  });

  it("chamber is H or S", () => {
    for (const record of data.slice(0, 20)) {
      expect(["H", "S"]).toContain(record.chamber);
    }
  });
});

// ─── Congress: House votes schema ───────────────────────────

describe("House votes schema", () => {
  let data: Awaited<ReturnType<typeof readHouseVotes>>;
  beforeAll(async () => {
    data = await readHouseVotes();
  });

  it("voteId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteId).toBe("string");
    }
  });

  it("rollCallNumber is a number > 0", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.rollCallNumber).toBe("number");
      expect(record.rollCallNumber).toBeGreaterThan(0);
    }
  });

  it("congress is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.congress).toBe("number");
    }
  });
});

// ─── Congress: House vote member votes schema ───────────────

describe("House vote member votes schema", () => {
  let data: Awaited<ReturnType<typeof readHouseVoteMemberVotes>>;
  beforeAll(async () => {
    data = await readHouseVoteMemberVotes();
  }, 30_000);

  it("voteId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteId).toBe("string");
    }
  });

  it("bioguideId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.bioguideId).toBe("string");
    }
  });

  it("voteCast is one of Yea, Nay, Not Voting, Present", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteCast).toBe("string");
      expect(["Yea", "Nay", "Not Voting", "Present"]).toContain(record.voteCast);
    }
  });
});

// ─── Congress: Senate votes schema ──────────────────────────

describe("Senate votes schema", () => {
  let data: Awaited<ReturnType<typeof readSenateVotes>>;
  beforeAll(async () => {
    data = await readSenateVotes();
  });

  it("voteId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteId).toBe("string");
    }
  });

  it("rollCallNumber is a number > 0", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.rollCallNumber).toBe("number");
      expect(record.rollCallNumber).toBeGreaterThan(0);
    }
  });
});

// ─── Congress: Senate vote member votes schema ──────────────

describe("Senate vote member votes schema", () => {
  let data: Awaited<ReturnType<typeof readSenateVoteMemberVotes>>;
  beforeAll(async () => {
    data = await readSenateVoteMemberVotes();
  });

  it("voteId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteId).toBe("string");
    }
  });

  it("bioguideId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.bioguideId).toBe("string");
    }
  });

  it("voteCast is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.voteCast).toBe("string");
    }
  });
});

// ─── State outcomes schema ──────────────────────────────────

describe("State outcomes schema", () => {
  let data: Awaited<ReturnType<typeof readOutcomeStates>>;
  beforeAll(async () => {
    data = await readOutcomeStates();
  });

  it("stateCode is a 2-character string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.stateCode).toBe("string");
      expect(record.stateCode.length).toBe(2);
    }
  });

  it("stateName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.stateName).toBe("string");
    }
  });

  it("population is a number > 0", () => {
    for (const record of data.slice(0, 20)) {
      if (record.population != null) {
        expect(typeof record.population).toBe("number");
        expect(record.population).toBeGreaterThan(0);
      }
    }
  });

  it("childPovertyPct is a number > 0", () => {
    for (const record of data.slice(0, 20)) {
      if (record.childPovertyPct != null) {
        expect(typeof record.childPovertyPct).toBe("number");
        expect(record.childPovertyPct).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Congress trade disclosures schema ──────────────────────

describe("Congress trade disclosures schema", () => {
  let data: Awaited<ReturnType<typeof readCongressTradeDisclosures>>;
  beforeAll(async () => {
    data = await readCongressTradeDisclosures();
  });

  it("memberName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.memberName).toBe("string");
    }
  });

  it("filingDate is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.filingDate).toBe("string");
    }
  });

  it("filingType is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.filingType).toBe("string");
    }
  });

  it("docId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.docId).toBe("string");
    }
  });
});

// ─── Federal contracts schema ───────────────────────────────

describe("Federal contracts schema", () => {
  const skip = !hasFile("usaspending.contracts.json");
  let data: Awaited<ReturnType<typeof readContracts>>;
  beforeAll(async () => {
    data = await readContracts();
  });

  it.skipIf(skip)("recipientName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.recipientName).toBe("string");
    }
  });

  it.skipIf(skip)("awardId is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.awardId).toBe("string");
    }
  });

  it.skipIf(skip)("awardAmount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.awardAmount).toBe("number");
    }
  });
});

// ─── Top contractors schema ─────────────────────────────────

describe("Top contractors schema", () => {
  const skip = !hasFile("usaspending.top-contractors.json");
  let data: Awaited<ReturnType<typeof readTopContractors>>;
  beforeAll(async () => {
    data = await readTopContractors();
  });

  it.skipIf(skip)("recipientName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.recipientName).toBe("string");
    }
  });

  it.skipIf(skip)("totalObligatedAmount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.totalObligatedAmount).toBe("number");
    }
  });

  it.skipIf(skip)("contractCount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.contractCount).toBe("number");
    }
  });
});

// ─── Insider trades schema ──────────────────────────────────

describe("Insider trades schema", () => {
  const skip = !hasFile("sec.insider-trades.json");
  let data: Awaited<ReturnType<typeof readInsiderTrades>>;
  beforeAll(async () => {
    data = await readInsiderTrades();
  });

  it.skipIf(skip)("ticker is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.ticker).toBe("string");
    }
  });

  it.skipIf(skip)("companyName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.companyName).toBe("string");
    }
  });

  it.skipIf(skip)("insiderName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.insiderName).toBe("string");
    }
  });

  it.skipIf(skip)("transactionType is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.transactionType).toBe("string");
    }
  });
});

// ─── Insider trade summaries schema ─────────────────────────

describe("Insider trade summaries schema", () => {
  const skip = !hasFile("sec.insider-trade-summaries.json");
  let data: Awaited<ReturnType<typeof readInsiderTradeSummaries>>;
  beforeAll(async () => {
    data = await readInsiderTradeSummaries();
  });

  it.skipIf(skip)("ticker is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.ticker).toBe("string");
    }
  });

  it.skipIf(skip)("companyName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.companyName).toBe("string");
    }
  });

  it.skipIf(skip)("totalBuys is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.totalBuys).toBe("number");
    }
  });

  it.skipIf(skip)("totalSells is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.totalSells).toBe("number");
    }
  });
});

// ─── Lobbying filings schema ────────────────────────────────

describe("Lobbying filings schema", () => {
  const skip = !hasFile("lda.lobbying-filings.json");
  let data: Awaited<ReturnType<typeof readLobbyingFilings>>;
  beforeAll(async () => {
    data = await readLobbyingFilings();
  });

  it.skipIf(skip)("registrantName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.registrantName).toBe("string");
    }
  });

  it.skipIf(skip)("clientName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.clientName).toBe("string");
    }
  });

  it.skipIf(skip)("income is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.income).toBe("number");
    }
  });
});

// ─── Lobbying clients schema ────────────────────────────────

describe("Lobbying clients schema", () => {
  const skip = !hasFile("lda.lobbying-clients.json");
  let data: Awaited<ReturnType<typeof readLobbyingClients>>;
  beforeAll(async () => {
    data = await readLobbyingClients();
  });

  it.skipIf(skip)("clientName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.clientName).toBe("string");
    }
  });

  it.skipIf(skip)("totalSpending is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.totalSpending).toBe("number");
    }
  });

  it.skipIf(skip)("filingCount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.filingCount).toBe("number");
    }
  });
});

// ─── Lobbying contributions schema ──────────────────────────

describe("Lobbying contributions schema", () => {
  const skip = !hasFile("lda.lobbying-contributions.json");
  let data: Awaited<ReturnType<typeof readLobbyistContributions>>;
  beforeAll(async () => {
    data = await readLobbyistContributions();
  });

  it.skipIf(skip)("contributorName is a string", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.contributorName).toBe("string");
    }
  });

  it.skipIf(skip)("amount is a number", () => {
    for (const record of data.slice(0, 20)) {
      expect(typeof record.amount).toBe("number");
    }
  });
});

// ─── Ingest summary schema ──────────────────────────────────

describe("Ingest summary schema", () => {
  let summary: Awaited<ReturnType<typeof readLatestSummary>>;
  beforeAll(async () => {
    summary = await readLatestSummary();
  });

  it("runId is a string", () => {
    expect(summary).not.toBeNull();
    expect(typeof summary!.runId).toBe("string");
  });

  it("finishedAt is a string", () => {
    expect(summary).not.toBeNull();
    expect(typeof summary!.finishedAt).toBe("string");
  });

  it("totals has candidates, committees, bills as numbers", () => {
    expect(summary).not.toBeNull();
    expect(typeof summary!.totals).toBe("object");
    expect(typeof summary!.totals.candidates).toBe("number");
    expect(typeof summary!.totals.committees).toBe("number");
    expect(typeof summary!.totals.bills).toBe("number");
  });
});
