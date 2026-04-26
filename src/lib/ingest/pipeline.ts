import { getIngestConfig } from "@/lib/ingest/config";
import { BulkDbWriter } from "@/lib/db/bulk-ingest-writer";
import { buildCandidateMemberCrosswalk } from "@/lib/data/crosswalk";
import { getPrismaClient } from "@/lib/db/client";
import { createIngestRunPlaceholder, persistIngestionToDatabase } from "@/lib/db/ingest-writer";
import { buildIngestHealthReport, writeIngestHealthReport } from "@/lib/ingest/health";
import {
  buildFundingReadModels,
  buildLaunchSummaryArtifact,
  buildVoteFundingSummaryArtifact,
} from "@/lib/launch-summary";
import {
  ingestCongressBills,
  ingestCongressMembers,
  ingestHouseRollCallVotes,
  ingestSenateRollCallVotes,
} from "@/lib/ingest/providers/congress";
import { ingestFaraData } from "@/lib/ingest/providers/fara";
import { ingestFecData } from "@/lib/ingest/providers/fec";
import type { FecIngestResult } from "@/lib/ingest/providers/fec";
import { ingestFecBulkData } from "@/lib/ingest/providers/fec-bulk";
import { ingestStateOutcomes } from "@/lib/ingest/providers/outcomes";
import { ingestCongressTradeDisclosures } from "@/lib/ingest/providers/congress-trades";
import { ingestLdaData } from "@/lib/ingest/providers/lda";
import { ingestSecInsiderData } from "@/lib/ingest/providers/sec-insider";
import { ingestUsaSpendingData } from "@/lib/ingest/providers/usaspending";
import {
  saveCongressTradeDisclosures,
  saveFundingReadModels,
  saveIngestArtifacts,
  saveInsiderTradeArtifacts,
  saveLaunchSummary,
  saveLobbyingArtifacts,
  saveUsaSpendingArtifacts,
  saveVoteFundingSummaries,
} from "@/lib/ingest/storage";
import type { CycleDetail, FecCandidate, FecCommittee, IngestArtifacts, IngestRunSummary, SourceName, SourceRunStatus } from "@/lib/ingest/types";

function sourceFailure(source: SourceName, error: unknown): SourceRunStatus {
  return {
    ok: false,
    ingestedAt: new Date().toISOString(),
    records: 0,
    warnings: [],
    error: error instanceof Error ? `${source}: ${error.message}` : `${source}: unknown error`,
  };
}

function sourceSuccess(records: number, warnings: string[]): SourceRunStatus {
  return {
    ok: true,
    ingestedAt: new Date().toISOString(),
    records,
    warnings,
  };
}

function appendAll<T>(target: T[], source: T[]) {
  for (const item of source) {
    target.push(item);
  }
}

function mergeFecResult(
  target: IngestArtifacts["fec"],
  source: FecIngestResult,
) {
  mergeCandidates(target, source.candidates);
  mergeCommittees(target, source.committees);
  appendAll(target.contributions, source.contributions);
}

function mergeCandidates(target: IngestArtifacts["fec"], candidates: FecCandidate[]) {
  const candidateMap = new Map(target.candidates.map((c) => [c.candidateId, c]));
  for (const c of candidates) {
    candidateMap.set(c.candidateId, c);
  }
  target.candidates = [...candidateMap.values()];
}

function mergeCommittees(target: IngestArtifacts["fec"], committees: FecCommittee[]) {
  const committeeMap = new Map(target.committees.map((c) => [c.committeeId, c]));
  for (const c of committees) {
    committeeMap.set(c.committeeId, c);
  }
  target.committees = [...committeeMap.values()];
}

function ensureCycleDetail(
  details: Record<number, CycleDetail>,
  key: number,
): CycleDetail {
  if (!details[key]) {
    details[key] = {
      fecCandidates: 0,
      fecCommittees: 0,
      fecContributions: 0,
      congressBills: 0,
      outcomeStates: 0,
    };
  }
  return details[key];
}

export async function runIngestionPipeline(): Promise<IngestRunSummary> {
  const config = getIngestConfig();
  const startedAt = new Date().toISOString();
  const runId = `${Date.now()}`;

  const artifacts: IngestArtifacts = {
    fec: {
      candidates: [],
      committees: [],
      contributions: [],
    },
    fara: {
      registrants: [],
      foreignPrincipals: [],
    },
    congress: {
      bills: [],
      members: [],
      memberships: [],
      houseVotes: [],
      houseVoteMemberVotes: [],
      senateVotes: [],
      senateVoteMemberVotes: [],
    },
    outcomes: {
      states: [],
    },
  };

  const cycleDetails: Record<number, CycleDetail> = {};
  const fecWarnings: string[] = [];
  const congressWarnings: string[] = [];
  const outcomesWarnings: string[] = [];
  let bulkContributionCount = 0;

  // Pre-create IngestRun so bulk streaming can satisfy FK constraints
  await createIngestRunPlaceholder(runId, startedAt, config.cycles);

  // --- FEC: route bulk vs API per cycle ---
  let fecStatus: SourceRunStatus;
  try {
    const prisma = getPrismaClient();

    for (const cycle of config.cycles) {
      if (config.bulkCycles.includes(cycle)) {
        // Bulk path: download ZIPs, stream large files to DB
        console.log(`[pipeline] cycle ${cycle}: using BULK ingestion`);
        const bulkWriter = prisma ? new BulkDbWriter(prisma, runId) : null;
        const bulk = await ingestFecBulkData({
          cycle,
          cacheDir: config.bulkCacheDir,
          batchSize: config.bulkBatchSize,
          cleanupAfterIngest: config.bulkCleanupAfterIngest,
          dbWriter: bulkWriter,
        });

        mergeCandidates(artifacts.fec, bulk.candidates);
        mergeCommittees(artifacts.fec, bulk.committees);
        // Bulk contributions are streamed to DB — only count is tracked
        bulkContributionCount += bulk.contributionCount;

        // Merge bulk-specific datasets
        artifacts.fec.candidateCommitteeLinks = [
          ...(artifacts.fec.candidateCommitteeLinks ?? []),
          ...bulk.candidateCommitteeLinks,
        ];
        artifacts.fec.candidateFinancials = [
          ...(artifacts.fec.candidateFinancials ?? []),
          ...bulk.candidateFinancials,
        ];
        artifacts.fec.pacSummaries = [
          ...(artifacts.fec.pacSummaries ?? []),
          ...bulk.pacSummaries,
        ];
        artifacts.fec.independentExpenditures = [
          ...(artifacts.fec.independentExpenditures ?? []),
          ...bulk.independentExpenditures,
        ];
        artifacts.fec.communicationCosts = [
          ...(artifacts.fec.communicationCosts ?? []),
          ...bulk.communicationCosts,
        ];
        artifacts.fec.electioneeringComms = [
          ...(artifacts.fec.electioneeringComms ?? []),
          ...bulk.electioneeringComms,
        ];
        artifacts.fec.leadershipPacLinks = [
          ...(artifacts.fec.leadershipPacLinks ?? []),
          ...bulk.leadershipPacLinks,
        ];

        fecWarnings.push(...bulk.warnings.map((w) => `[bulk cycle=${cycle}] ${w}`));
        const detail = ensureCycleDetail(cycleDetails, cycle);
        detail.fecCandidates = bulk.candidates.length;
        detail.fecCommittees = bulk.committees.length;
        detail.fecContributions = bulk.contributionCount;
        detail.fecIndependentExpenditures = bulk.independentExpenditures.length;
        detail.fecOperatingExpenditures = bulk.operatingExpenditureCount;
        detail.fecIntercommitteeTransactions = bulk.intercommitteeTransactionCount;
      } else {
        // API path: existing behavior
        console.log(`[pipeline] cycle ${cycle}: using API ingestion`);
        const fec = await ingestFecData({
          apiKey: config.fecApiKey,
          cycle,
          candidateLimit: config.candidateLimit,
          committeeLimit: config.fecCommitteeLimit,
          contributionLimit: config.fecContributionLimit,
          maxPagesPerDataset: config.fecMaxPagesPerDataset,
          contributionPageDelayMs: config.fecContributionPageDelayMs,
        });
        mergeFecResult(artifacts.fec, fec);
        fecWarnings.push(...fec.warnings.map((w) => `[cycle=${cycle}] ${w}`));
        const detail = ensureCycleDetail(cycleDetails, cycle);
        detail.fecCandidates = fec.candidates.length;
        detail.fecCommittees = fec.committees.length;
        detail.fecContributions = fec.contributions.length;
      }
    }

    const totalRecords =
      artifacts.fec.candidates.length +
      artifacts.fec.committees.length +
      artifacts.fec.contributions.length +
      bulkContributionCount;
    fecStatus = sourceSuccess(totalRecords, fecWarnings);
  } catch (error) {
    fecStatus = sourceFailure("fec", error);
  }

  // --- FARA: unchanged (no cycle concept) ---
  let faraStatus: SourceRunStatus;
  try {
    const fara = await ingestFaraData({
      registrantLimit: config.faraRegistrantLimit,
    });
    artifacts.fara = {
      registrants: fara.registrants,
      foreignPrincipals: fara.foreignPrincipals,
    };
    faraStatus = sourceSuccess(
      fara.registrants.length + fara.foreignPrincipals.length,
      fara.warnings,
    );
  } catch (error) {
    faraStatus = sourceFailure("fara", error);
  }

  // --- Congress: bills per cycle, members once ---
  let congressStatus: SourceRunStatus;
  try {
    for (const cycle of config.cycles) {
      const billResult = await ingestCongressBills({
        apiKey: config.congressApiKey,
        cycle,
        limit: 300,
      });
      appendAll(artifacts.congress.bills, billResult.bills);
      congressWarnings.push(...billResult.warnings.map((w) => `[cycle=${cycle}] ${w}`));
      const detail = ensureCycleDetail(cycleDetails, cycle);
      detail.congressBills = billResult.bills.length;
    }

    const memberResult = await ingestCongressMembers({
      apiKey: config.congressApiKey,
      congresses: [...new Set(config.cycles.map((cycle) => Math.floor((cycle - 1789) / 2) + 1))],
      limit: 600,
    });
    artifacts.congress.members = memberResult.members;
    artifacts.congress.memberships = memberResult.memberships;
    congressWarnings.push(...memberResult.warnings);

    for (const cycle of config.cycles) {
      const voteResult = await ingestHouseRollCallVotes({
        apiKey: config.congressApiKey,
        cycle,
      });
      appendAll(artifacts.congress.houseVotes, voteResult.houseVotes);
      appendAll(artifacts.congress.houseVoteMemberVotes, voteResult.houseVoteMemberVotes);
      congressWarnings.push(...voteResult.warnings.map((w) => `[cycle=${cycle}] ${w}`));
      const detail = ensureCycleDetail(cycleDetails, cycle);
      detail.houseVotes = voteResult.houseVotes.length;
      detail.houseVoteMemberVotes = voteResult.houseVoteMemberVotes.length;

      const senateVoteResult = await ingestSenateRollCallVotes({
        cycle,
        members: memberResult.members,
        memberships: memberResult.memberships,
      });
      artifacts.congress.senateVotes ??= [];
      artifacts.congress.senateVoteMemberVotes ??= [];
      appendAll(artifacts.congress.senateVotes, senateVoteResult.senateVotes);
      appendAll(artifacts.congress.senateVoteMemberVotes, senateVoteResult.senateVoteMemberVotes);
      congressWarnings.push(...senateVoteResult.warnings.map((w) => `[cycle=${cycle}] ${w}`));
      detail.senateVotes = senateVoteResult.senateVotes.length;
      detail.senateVoteMemberVotes = senateVoteResult.senateVoteMemberVotes.length;
    }

    congressStatus = sourceSuccess(
      artifacts.congress.bills.length +
        artifacts.congress.members.length +
        artifacts.congress.houseVotes.length +
        artifacts.congress.houseVoteMemberVotes.length +
        (artifacts.congress.senateVotes?.length ?? 0) +
        (artifacts.congress.senateVoteMemberVotes?.length ?? 0),
      congressWarnings,
    );
  } catch (error) {
    congressStatus = sourceFailure("congress", error);
  }

  const candidateMemberCrosswalks = buildCandidateMemberCrosswalk(
    artifacts.fec.candidates,
    artifacts.congress.members,
    artifacts.fec.committees,
  );

  // --- Outcomes: loop over years ---
  let outcomesStatus: SourceRunStatus;
  try {
    for (const year of config.outcomesYears) {
      const outcomes = await ingestStateOutcomes({ year });
      artifacts.outcomes.states.push(...outcomes.states);
      outcomesWarnings.push(...outcomes.warnings.map((w) => `[year=${year}] ${w}`));
      const detail = ensureCycleDetail(cycleDetails, year);
      detail.outcomeStates = outcomes.states.length;
    }
    outcomesStatus = sourceSuccess(artifacts.outcomes.states.length, outcomesWarnings);
  } catch (error) {
    outcomesStatus = sourceFailure("outcomes", error);
  }

  // --- USASpending: federal contracts (uses FEC committees for crosswalk) ---
  let usaspendingStatus: SourceRunStatus;
  const usaspendingWarnings: string[] = [];
  let usaspendingContractors: import("@/lib/ingest/types").ContractorProfile[] = [];
  try {
    console.log("[pipeline] fetching USASpending contract data");
    const usaResult = await ingestUsaSpendingData({
      committees: artifacts.fec.committees,
    });
    await saveUsaSpendingArtifacts(usaResult.contracts, usaResult.contractors);
    usaspendingContractors = usaResult.contractors;
    usaspendingWarnings.push(...usaResult.warnings);
    usaspendingStatus = sourceSuccess(
      usaResult.contracts.length + usaResult.contractors.length,
      usaspendingWarnings,
    );
    console.log(
      `[pipeline] USASpending: ${usaResult.contracts.length} contracts, ${usaResult.contractors.length} contractors, ${usaResult.fecLinks.length} FEC links`,
    );
  } catch (error) {
    usaspendingStatus = sourceFailure("usaspending" as SourceName, error);
  }

  // --- Congress STOCK Act trade disclosures (House PTR filings) ---
  const congressTradeWarnings: string[] = [];
  try {
    console.log("[pipeline] fetching House PTR trade disclosures");
    // Fetch disclosures for the most recent 2 years of data
    const tradeYears = [...new Set(config.cycles.flatMap((c) => [c - 1, c]))].sort();
    const tradeResult = await ingestCongressTradeDisclosures({
      years: tradeYears,
      members: artifacts.congress.members,
    });
    await saveCongressTradeDisclosures(tradeResult.disclosures);
    congressTradeWarnings.push(...tradeResult.warnings);
    console.log(`[pipeline] Congress trades: ${tradeResult.disclosures.length} PTR disclosures`);
  } catch (error) {
    congressTradeWarnings.push(
      `congress-trades: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }

  // --- SEC EDGAR insider trading (Form 4 filings) ---
  let secStatus: SourceRunStatus;
  const secWarnings: string[] = [];
  try {
    console.log("[pipeline] fetching SEC EDGAR insider trade data");
    const secResult = await ingestSecInsiderData({
      committees: artifacts.fec.committees,
      maxCompanies: 30,
      filingsPerCompany: 10,
      includeTopBuyers: true,
    });
    await saveInsiderTradeArtifacts(secResult.trades, secResult.summaries);
    secWarnings.push(...secResult.warnings);
    secStatus = sourceSuccess(
      secResult.trades.length + secResult.summaries.length,
      secWarnings,
    );
    console.log(
      `[pipeline] SEC: ${secResult.trades.length} trades, ${secResult.summaries.length} companies`,
    );
  } catch (error) {
    secStatus = sourceFailure("sec", error);
  }

  // --- LDA: Senate lobbying disclosures (uses FEC committees, members, contractors for crosswalk) ---
  let ldaStatus: SourceRunStatus;
  const ldaWarnings: string[] = [];
  try {
    console.log("[pipeline] fetching Senate LDA lobbying data");
    const ldaResult = await ingestLdaData({
      year: config.cycles[0],
      committees: artifacts.fec.committees,
      members: artifacts.congress.members,
      contractors: usaspendingContractors,
    });
    await saveLobbyingArtifacts(ldaResult.filings, ldaResult.contributions, ldaResult.clients);
    ldaWarnings.push(...ldaResult.warnings);
    ldaStatus = sourceSuccess(
      ldaResult.filings.length + ldaResult.contributions.length + ldaResult.clients.length,
      ldaWarnings,
    );
    console.log(
      `[pipeline] LDA: ${ldaResult.filings.length} filings, ${ldaResult.contributions.length} contributions, ${ldaResult.clients.length} clients`,
    );
  } catch (error) {
    ldaStatus = sourceFailure("lda", error);
  }

  const summary: IngestRunSummary = {
    runId,
    startedAt,
    finishedAt: new Date().toISOString(),
    cycles: config.cycles,
    candidateLimit: config.candidateLimit,
    fecCommitteeLimit: config.fecCommitteeLimit,
    fecContributionLimit: config.fecContributionLimit,
    faraRegistrantLimit: config.faraRegistrantLimit,
    sources: {
      fec: fecStatus,
      fara: faraStatus,
      congress: congressStatus,
      outcomes: outcomesStatus,
      usaspending: usaspendingStatus,
      sec: secStatus,
      lda: ldaStatus,
    },
    totals: {
      candidates: artifacts.fec.candidates.length,
      committees: artifacts.fec.committees.length,
      contributions: artifacts.fec.contributions.length + bulkContributionCount,
      faraRegistrants: artifacts.fara.registrants.length,
      faraForeignPrincipals: artifacts.fara.foreignPrincipals.length,
      bills: artifacts.congress.bills.length,
      congressMembers: artifacts.congress.members.length,
      houseVotes: artifacts.congress.houseVotes.length,
      houseVoteMemberVotes: artifacts.congress.houseVoteMemberVotes.length,
      senateVotes: artifacts.congress.senateVotes?.length ?? 0,
      senateVoteMemberVotes: artifacts.congress.senateVoteMemberVotes?.length ?? 0,
      candidateMemberCrosswalks: candidateMemberCrosswalks.length,
      stateOutcomes: artifacts.outcomes.states.length,
    },
    cycleDetails,
    warnings: [
      ...fecWarnings,
      ...faraStatus.warnings,
      ...congressWarnings,
      ...outcomesWarnings,
      ...(fecStatus.error ? [fecStatus.error] : []),
      ...(faraStatus.error ? [faraStatus.error] : []),
      ...(congressStatus.error ? [congressStatus.error] : []),
      ...(outcomesStatus.error ? [outcomesStatus.error] : []),
      ...usaspendingWarnings,
      ...(usaspendingStatus.error ? [usaspendingStatus.error] : []),
      ...congressTradeWarnings,
      ...secWarnings,
      ...(secStatus.error ? [secStatus.error] : []),
      ...ldaWarnings,
      ...(ldaStatus.error ? [ldaStatus.error] : []),
    ],
  };

  const dbPersistResult = await persistIngestionToDatabase(summary, artifacts);
  if (dbPersistResult.enabled && dbPersistResult.message) {
    summary.warnings.push(dbPersistResult.message);
  }

  await saveIngestArtifacts(summary, artifacts);
  await saveLaunchSummary(buildLaunchSummaryArtifact(summary, artifacts));
  await saveVoteFundingSummaries(buildVoteFundingSummaryArtifact(artifacts));
  await saveFundingReadModels(buildFundingReadModels(artifacts));
  const health = buildIngestHealthReport(summary, config.healthStaleMinutes);
  await writeIngestHealthReport(health);
  return summary;
}
