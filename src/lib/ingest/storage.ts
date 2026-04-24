import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CongressBill,
  CongressMember,
  CongressMembership,
  CongressTradeDisclosure,
  ContractorProfile,
  FecCandidate,
  FecCommittee,
  FecCandidateCommitteeLink,
  FecCandidateFinancials,
  FecContribution,
  FecIndependentExpenditure,
  FecLeadershipPacLink,
  FecPacSummary,
  FecRecentEfiling,
  FaraForeignPrincipal,
  FaraRegistrant,
  GovernmentContract,
  IngestArtifacts,
  IngestRunSummary,
  InsiderTrade,
  InsiderTradeSummary,
  LobbyingClientProfile,
  LobbyingFiling,
  LobbyistContribution,
  HouseRollCallMemberVote,
  HouseRollCallVote,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";
import type {
  FundingReadModelsArtifact,
  LaunchSummaryArtifact,
  VoteFundingSummaryArtifact,
} from "@/lib/launch-summary";
import type { OutcomeRow } from "@/lib/state-outcomes";

const INGEST_BASE_DIR = path.join(process.cwd(), "data", "ingest");
const LATEST_DIR = path.join(INGEST_BASE_DIR, "latest");
const HISTORY_DIR = path.join(INGEST_BASE_DIR, "runs");
const jsonReadCache = new Map<string, Promise<unknown>>();
const latestArtifactsCacheKey = "__latest_artifacts__";

async function ensureDirs() {
  await mkdir(LATEST_DIR, { recursive: true });
  await mkdir(HISTORY_DIR, { recursive: true });
}

async function writeJson(filePath: string, payload: unknown) {
  await writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
  invalidateJsonCache(filePath);
}

function invalidateJsonCache(...keys: string[]) {
  if (!keys.length) {
    jsonReadCache.clear();
    return;
  }

  for (const key of keys) {
    jsonReadCache.delete(key);
  }
}

async function readJsonOptional<T>(filePath: string, fallback: T): Promise<T> {
  const cached = jsonReadCache.get(filePath);
  if (cached) return cached as Promise<T>;

  const pending = readFile(filePath, "utf8")
    .then((raw) => JSON.parse(raw) as T)
    .catch((error) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return fallback;
      jsonReadCache.delete(filePath);
      throw error;
    });

  jsonReadCache.set(filePath, pending);
  return pending;
}

export async function readLatestDataset<T>(fileName: string, fallback: T): Promise<T> {
  return readJsonOptional(path.join(LATEST_DIR, fileName), fallback);
}

export async function saveIngestArtifacts(
  runSummary: IngestRunSummary,
  artifacts: IngestArtifacts,
) {
  await ensureDirs();

  const runDir = path.join(HISTORY_DIR, runSummary.runId);
  await mkdir(runDir, { recursive: true });

  await writeJson(path.join(runDir, "summary.json"), runSummary);
  await writeJson(path.join(runDir, "fec.candidates.json"), artifacts.fec.candidates);
  await writeJson(path.join(runDir, "fec.committees.json"), artifacts.fec.committees);
  await writeJson(path.join(runDir, "fec.contributions.json"), artifacts.fec.contributions);
  await writeJson(path.join(runDir, "fara.registrants.json"), artifacts.fara.registrants);
  await writeJson(
    path.join(runDir, "fara.foreign-principals.json"),
    artifacts.fara.foreignPrincipals,
  );
  await writeJson(path.join(runDir, "congress.bills.json"), artifacts.congress.bills);
  await writeJson(path.join(runDir, "congress.members.json"), artifacts.congress.members);
  await writeJson(
    path.join(runDir, "congress.memberships.json"),
    artifacts.congress.memberships ?? [],
  );
  await writeJson(path.join(runDir, "congress.house-votes.json"), artifacts.congress.houseVotes);
  await writeJson(
    path.join(runDir, "congress.house-vote-member-votes.json"),
    artifacts.congress.houseVoteMemberVotes,
  );
  await writeJson(
    path.join(runDir, "congress.senate-votes.json"),
    artifacts.congress.senateVotes ?? [],
  );
  await writeJson(
    path.join(runDir, "congress.senate-vote-member-votes.json"),
    artifacts.congress.senateVoteMemberVotes ?? [],
  );
  await writeJson(path.join(runDir, "outcomes.states.json"), artifacts.outcomes.states);

  await writeJson(path.join(LATEST_DIR, "summary.json"), runSummary);
  await writeJson(path.join(LATEST_DIR, "fec.candidates.json"), artifacts.fec.candidates);
  await writeJson(path.join(LATEST_DIR, "fec.committees.json"), artifacts.fec.committees);
  await writeJson(
    path.join(LATEST_DIR, "fec.contributions.json"),
    artifacts.fec.contributions,
  );
  await writeJson(path.join(LATEST_DIR, "fara.registrants.json"), artifacts.fara.registrants);
  await writeJson(
    path.join(LATEST_DIR, "fara.foreign-principals.json"),
    artifacts.fara.foreignPrincipals,
  );
  await writeJson(path.join(LATEST_DIR, "congress.bills.json"), artifacts.congress.bills);
  await writeJson(path.join(LATEST_DIR, "congress.members.json"), artifacts.congress.members);
  await writeJson(
    path.join(LATEST_DIR, "congress.memberships.json"),
    artifacts.congress.memberships ?? [],
  );
  await writeJson(path.join(LATEST_DIR, "congress.house-votes.json"), artifacts.congress.houseVotes);
  await writeJson(
    path.join(LATEST_DIR, "congress.house-vote-member-votes.json"),
    artifacts.congress.houseVoteMemberVotes,
  );
  await writeJson(
    path.join(LATEST_DIR, "congress.senate-votes.json"),
    artifacts.congress.senateVotes ?? [],
  );
  await writeJson(
    path.join(LATEST_DIR, "congress.senate-vote-member-votes.json"),
    artifacts.congress.senateVoteMemberVotes ?? [],
  );
  await writeJson(path.join(LATEST_DIR, "outcomes.states.json"), artifacts.outcomes.states);

  // Financial artifacts (from bulk ingest)
  if (artifacts.fec.candidateFinancials?.length) {
    await writeJson(path.join(LATEST_DIR, "fec.candidate-financials.json"), artifacts.fec.candidateFinancials);
    await writeJson(path.join(runDir, "fec.candidate-financials.json"), artifacts.fec.candidateFinancials);
  }
  if (artifacts.fec.pacSummaries?.length) {
    await writeJson(path.join(LATEST_DIR, "fec.pac-summaries.json"), artifacts.fec.pacSummaries);
    await writeJson(path.join(runDir, "fec.pac-summaries.json"), artifacts.fec.pacSummaries);
  }
  if (artifacts.fec.candidateCommitteeLinks?.length) {
    await writeJson(path.join(LATEST_DIR, "fec.candidate-committee-links.json"), artifacts.fec.candidateCommitteeLinks);
    await writeJson(path.join(runDir, "fec.candidate-committee-links.json"), artifacts.fec.candidateCommitteeLinks);
  }
  if (artifacts.fec.independentExpenditures?.length) {
    await writeJson(path.join(LATEST_DIR, "fec.independent-expenditures.json"), artifacts.fec.independentExpenditures);
    await writeJson(path.join(runDir, "fec.independent-expenditures.json"), artifacts.fec.independentExpenditures);
  }
  if (artifacts.fec.leadershipPacLinks?.length) {
    await writeJson(path.join(LATEST_DIR, "fec.leadership-pac-links.json"), artifacts.fec.leadershipPacLinks);
    await writeJson(path.join(runDir, "fec.leadership-pac-links.json"), artifacts.fec.leadershipPacLinks);
  }

  invalidateJsonCache(latestArtifactsCacheKey);
}

export async function readLatestSummary(): Promise<IngestRunSummary | null> {
  return readJsonOptional(path.join(LATEST_DIR, "summary.json"), null);
}

export async function readLaunchSummary(): Promise<LaunchSummaryArtifact | null> {
  return readJsonOptional(path.join(LATEST_DIR, "derived.launch-summary.json"), null);
}

export async function readVoteFundingSummaries(): Promise<VoteFundingSummaryArtifact | null> {
  return readJsonOptional(path.join(LATEST_DIR, "derived.vote-funding.json"), null);
}

export async function readFundingReadModels(): Promise<FundingReadModelsArtifact | null> {
  return readJsonOptional(path.join(LATEST_DIR, "derived.funding-read-models.json"), null);
}

/** List run IDs from data/ingest/runs, newest first (by runId descending). */
export async function listIngestRunIds(): Promise<string[]> {
  try {
    const entries = await readdir(HISTORY_DIR, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .filter((name) => /^\d+$/.test(name));
    return dirs.sort((a, b) => Number(b) - Number(a));
  } catch {
    return [];
  }
}

/** Read summary for a specific run by runId. */
export async function readRunSummary(runId: string): Promise<IngestRunSummary | null> {
  try {
    const raw = await readFile(path.join(HISTORY_DIR, runId, "summary.json"), "utf8");
    return JSON.parse(raw) as IngestRunSummary;
  } catch {
    return null;
  }
}

export async function readLatestArtifacts(): Promise<IngestArtifacts | null> {
  const cached = jsonReadCache.get(latestArtifactsCacheKey);
  if (cached) return cached as Promise<IngestArtifacts | null>;

  const pending = (async () => {
    try {
      const [
        candidates,
        committees,
        contributions,
        registrants,
        foreignPrincipals,
        bills,
        members,
        memberships,
        houseVotes,
        houseVoteMemberVotes,
        senateVotes,
        senateVoteMemberVotes,
        outcomesStates,
        candidateFinancials,
        pacSummaries,
        candidateCommitteeLinks,
        independentExpenditures,
        leadershipPacLinks,
      ] = await Promise.all([
        readJsonOptional(path.join(LATEST_DIR, "fec.candidates.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "fec.committees.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "fec.contributions.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "fara.registrants.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "fara.foreign-principals.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.bills.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.members.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.memberships.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.house-votes.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.house-vote-member-votes.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.senate-votes.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "congress.senate-vote-member-votes.json"), []),
        readJsonOptional(path.join(LATEST_DIR, "outcomes.states.json"), []),
        readJsonOptional<FecCandidateFinancials[]>(path.join(LATEST_DIR, "fec.candidate-financials.json"), []),
        readJsonOptional<FecPacSummary[]>(path.join(LATEST_DIR, "fec.pac-summaries.json"), []),
        readJsonOptional<FecCandidateCommitteeLink[]>(path.join(LATEST_DIR, "fec.candidate-committee-links.json"), []),
        readJsonOptional<FecIndependentExpenditure[]>(path.join(LATEST_DIR, "fec.independent-expenditures.json"), []),
        readJsonOptional<FecLeadershipPacLink[]>(path.join(LATEST_DIR, "fec.leadership-pac-links.json"), []),
      ]);

      return {
        fec: {
          candidates,
          committees,
          contributions,
          candidateFinancials,
          pacSummaries,
          candidateCommitteeLinks,
          independentExpenditures,
          leadershipPacLinks,
        },
        fara: {
          registrants,
          foreignPrincipals,
        },
        congress: {
          bills,
          members,
          memberships,
          houseVotes,
          houseVoteMemberVotes,
          senateVotes,
          senateVoteMemberVotes,
        },
        outcomes: {
          states: outcomesStates,
        },
      } satisfies IngestArtifacts;
    } catch {
      jsonReadCache.delete(latestArtifactsCacheKey);
      return null;
    }
  })();

  jsonReadCache.set(latestArtifactsCacheKey, pending);
  return pending;
}

// --- Dedicated readers for individual datasets (avoid loading everything) ---

export async function readFecCandidates(): Promise<FecCandidate[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.candidates.json"), []);
}

export async function readFecCommittees(): Promise<FecCommittee[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.committees.json"), []);
}

export async function readFecContributions(): Promise<FecContribution[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.contributions.json"), []);
}

export async function readFaraRegistrants(): Promise<FaraRegistrant[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fara.registrants.json"), []);
}

export async function readFaraForeignPrincipals(): Promise<FaraForeignPrincipal[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fara.foreign-principals.json"), []);
}

export async function readCongressBills(): Promise<CongressBill[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.bills.json"), []);
}

export async function readCongressMembers(): Promise<CongressMember[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.members.json"), []);
}

export async function readCongressMemberships(): Promise<CongressMembership[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.memberships.json"), []);
}

export async function readHouseVotes(): Promise<HouseRollCallVote[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.house-votes.json"), []);
}

export async function readHouseVoteMemberVotes(): Promise<HouseRollCallMemberVote[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.house-vote-member-votes.json"), []);
}

export async function readSenateVotes(): Promise<SenateRollCallVote[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.senate-votes.json"), []);
}

export async function readSenateVoteMemberVotes(): Promise<SenateRollCallMemberVote[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.senate-vote-member-votes.json"), []);
}

export async function readOutcomeStates(): Promise<OutcomeRow[]> {
  return readJsonOptional(path.join(LATEST_DIR, "outcomes.states.json"), []);
}

export async function readCandidateFinancials(): Promise<FecCandidateFinancials[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.candidate-financials.json"), []);
}

export async function readPacSummaries(): Promise<FecPacSummary[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.pac-summaries.json"), []);
}

export async function readCandidateCommitteeLinks(): Promise<FecCandidateCommitteeLink[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.candidate-committee-links.json"), []);
}

export async function readIndependentExpenditures(): Promise<FecIndependentExpenditure[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.independent-expenditures.json"), []);
}

export async function readLeadershipPacLinks(): Promise<FecLeadershipPacLink[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.leadership-pac-links.json"), []);
}

export async function readPacToCandidate(): Promise<FecContribution[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.pac-to-candidate.json"), []);
}

// --- FEC eFiling (real-time contributions) ---

export async function readRecentEfilings(): Promise<FecRecentEfiling[]> {
  return readJsonOptional(path.join(LATEST_DIR, "fec.recent-efilings.json"), []);
}

export async function saveRecentEfilings(efilings: FecRecentEfiling[]): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "fec.recent-efilings.json"), efilings);
}

// --- USASpending readers ---

export async function readContracts(): Promise<GovernmentContract[]> {
  return readJsonOptional(path.join(LATEST_DIR, "usaspending.contracts.json"), []);
}

export async function readTopContractors(): Promise<ContractorProfile[]> {
  return readJsonOptional(path.join(LATEST_DIR, "usaspending.top-contractors.json"), []);
}

export async function saveUsaSpendingArtifacts(
  contracts: GovernmentContract[],
  contractors: ContractorProfile[],
): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "usaspending.contracts.json"), contracts);
  await writeJson(path.join(LATEST_DIR, "usaspending.top-contractors.json"), contractors);
}

// --- SEC EDGAR insider trade readers and writers ---

export async function readInsiderTrades(): Promise<InsiderTrade[]> {
  return readJsonOptional(path.join(LATEST_DIR, "sec.insider-trades.json"), []);
}

export async function readInsiderTradeSummaries(): Promise<InsiderTradeSummary[]> {
  return readJsonOptional(path.join(LATEST_DIR, "sec.insider-trade-summaries.json"), []);
}

export async function saveInsiderTradeArtifacts(
  trades: InsiderTrade[],
  summaries: InsiderTradeSummary[],
): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "sec.insider-trades.json"), trades);
  await writeJson(path.join(LATEST_DIR, "sec.insider-trade-summaries.json"), summaries);
}

// --- Congress STOCK Act trade disclosure readers and writers ---

export async function readCongressTradeDisclosures(): Promise<CongressTradeDisclosure[]> {
  return readJsonOptional(path.join(LATEST_DIR, "congress.trade-disclosures.json"), []);
}

export async function saveCongressTradeDisclosures(
  disclosures: CongressTradeDisclosure[],
): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "congress.trade-disclosures.json"), disclosures);
}

// --- LDA (Lobbying Disclosure) readers and writers ---

export async function readLobbyingFilings(): Promise<LobbyingFiling[]> {
  return readJsonOptional(path.join(LATEST_DIR, "lda.lobbying-filings.json"), []);
}

export async function readLobbyistContributions(): Promise<LobbyistContribution[]> {
  return readJsonOptional(path.join(LATEST_DIR, "lda.lobbying-contributions.json"), []);
}

export async function readLobbyingClients(): Promise<LobbyingClientProfile[]> {
  return readJsonOptional(path.join(LATEST_DIR, "lda.lobbying-clients.json"), []);
}

export async function saveLobbyingArtifacts(
  filings: LobbyingFiling[],
  contributions: LobbyistContribution[],
  clients: LobbyingClientProfile[],
): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "lda.lobbying-filings.json"), filings);
  await writeJson(path.join(LATEST_DIR, "lda.lobbying-contributions.json"), contributions);
  await writeJson(path.join(LATEST_DIR, "lda.lobbying-clients.json"), clients);
}

export async function saveLaunchSummary(summary: LaunchSummaryArtifact): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "derived.launch-summary.json"), summary);
}

export async function saveVoteFundingSummaries(summary: VoteFundingSummaryArtifact): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "derived.vote-funding.json"), summary);
}

export async function saveFundingReadModels(summary: FundingReadModelsArtifact): Promise<void> {
  await ensureDirs();
  await writeJson(path.join(LATEST_DIR, "derived.funding-read-models.json"), summary);
}
