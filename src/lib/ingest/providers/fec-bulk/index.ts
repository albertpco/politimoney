import type { BulkDbWriter } from "@/lib/db/bulk-ingest-writer";
import type {
  FecCandidate,
  FecCandidateCommitteeLink,
  FecCandidateFinancials,
  FecCommittee,
  FecCommunicationCost,
  FecElectioneeringComm,
  FecIndependentExpenditure,
  FecLeadershipPacLink,
  FecPacSummary,
} from "@/lib/ingest/types";
import {
  ALL_CANDIDATES_COLUMNS,
  CANDIDATE_COMMITTEE_LINKAGE_COLUMNS,
  CANDIDATE_MASTER_COLUMNS,
  COMMITTEE_MASTER_COLUMNS,
  COMMITTEE_TO_CANDIDATE_COLUMNS,
  INDIVIDUAL_CONTRIBUTIONS_COLUMNS,
  INTER_COMMITTEE_COLUMNS,
  LOBBYIST_REGISTRANT_COLUMNS,
  OPERATING_EXPENDITURES_COLUMNS,
  PAC_SUMMARY_COLUMNS,
} from "./columns";
import { cleanupCacheFile, downloadBulkFile, openZipEntryStream } from "./downloader";
import {
  mapCandidateCommitteeLinkRow,
  mapCandidateFinancialsRow,
  mapCandidateRow,
  mapCommitteeRow,
  mapCommunicationCostRow,
  mapContributionRow,
  mapElectioneeringCommRow,
  mapIndependentExpenditureRow,
  mapLeadershipPacLinkRow,
  mapOperatingExpenditureRow,
  mapPacSummaryRow,
} from "./mappers";
import { createFileStream, streamParseBulkFile, type ParsedRow } from "./parser";

export type FecBulkIngestResult = {
  candidates: FecCandidate[];
  committees: FecCommittee[];
  contributionCount: number;
  candidateCommitteeLinks: FecCandidateCommitteeLink[];
  candidateFinancials: FecCandidateFinancials[];
  pacSummaries: FecPacSummary[];
  independentExpenditures: FecIndependentExpenditure[];
  operatingExpenditureCount: number;
  communicationCosts: FecCommunicationCost[];
  electioneeringComms: FecElectioneeringComm[];
  leadershipPacLinks: FecLeadershipPacLink[];
  intercommitteeTransactionCount: number;
  warnings: string[];
};

type StreamParseOptions = {
  delimiter: "|" | ",";
  columns: readonly string[];
  hasHeaders: boolean;
};

async function parseSmallZipFile<T>(
  zipPath: string,
  options: StreamParseOptions,
  mapper: (row: ParsedRow) => T | null,
): Promise<T[]> {
  const stream = await openZipEntryStream(zipPath);
  const results: T[] = [];
  for await (const row of streamParseBulkFile(stream, options)) {
    const mapped = mapper(row);
    if (mapped) results.push(mapped);
  }
  return results;
}

async function parseSmallCsvFile<T>(
  filePath: string,
  options: StreamParseOptions,
  mapper: (row: ParsedRow) => T | null,
): Promise<T[]> {
  const stream = createFileStream(filePath);
  const results: T[] = [];
  for await (const row of streamParseBulkFile(stream, options)) {
    const mapped = mapper(row);
    if (mapped) results.push(mapped);
  }
  return results;
}

async function streamLargeZipFile<T>(
  zipPath: string,
  options: StreamParseOptions,
  mapper: (row: ParsedRow) => T | null,
  batchSize: number,
  onBatch: (batch: T[]) => Promise<void>,
): Promise<number> {
  const stream = await openZipEntryStream(zipPath);
  let batch: T[] = [];
  let total = 0;

  for await (const row of streamParseBulkFile(stream, options)) {
    const mapped = mapper(row);
    if (!mapped) continue;
    batch.push(mapped);
    if (batch.length >= batchSize) {
      await onBatch(batch);
      total += batch.length;
      if (total % 100_000 === 0) {
        console.log(`[bulk] streamed ${total.toLocaleString()} rows...`);
      }
      batch = [];
    }
  }

  if (batch.length > 0) {
    await onBatch(batch);
    total += batch.length;
  }

  return total;
}

export async function ingestFecBulkData({
  cycle,
  cacheDir,
  batchSize,
  cleanupAfterIngest,
  dbWriter,
}: {
  cycle: number;
  cacheDir: string;
  batchSize: number;
  cleanupAfterIngest: boolean;
  dbWriter: BulkDbWriter | null;
}): Promise<FecBulkIngestResult> {
  const yy = String(cycle).slice(-2);
  const yyyy = String(cycle);
  const warnings: string[] = [];
  const downloadedFiles: string[] = [];

  const result: FecBulkIngestResult = {
    candidates: [],
    committees: [],
    contributionCount: 0,
    candidateCommitteeLinks: [],
    candidateFinancials: [],
    pacSummaries: [],
    independentExpenditures: [],
    operatingExpenditureCount: 0,
    communicationCosts: [],
    electioneeringComms: [],
    leadershipPacLinks: [],
    intercommitteeTransactionCount: 0,
    warnings: [],
  };

  // --- Small files: load fully into memory ---

  // Candidate Master
  try {
    const path = await downloadBulkFile(cycle, `cn${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.candidates = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: CANDIDATE_MASTER_COLUMNS,
      hasHeaders: false,
    }, mapCandidateRow);
    console.log(`[bulk] parsed ${result.candidates.length} candidates`);
  } catch (error) {
    warnings.push(`Candidate master: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Committee Master
  try {
    const path = await downloadBulkFile(cycle, `cm${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.committees = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: COMMITTEE_MASTER_COLUMNS,
      hasHeaders: false,
    }, mapCommitteeRow);
    console.log(`[bulk] parsed ${result.committees.length} committees`);
  } catch (error) {
    warnings.push(`Committee master: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // All Candidates (financial summary)
  try {
    const path = await downloadBulkFile(cycle, `weball${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.candidateFinancials = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: ALL_CANDIDATES_COLUMNS,
      hasHeaders: false,
    }, mapCandidateFinancialsRow);
    console.log(`[bulk] parsed ${result.candidateFinancials.length} candidate financials`);
  } catch (error) {
    warnings.push(`Candidate financials: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Candidate-Committee Linkages
  try {
    const path = await downloadBulkFile(cycle, `ccl${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.candidateCommitteeLinks = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: CANDIDATE_COMMITTEE_LINKAGE_COLUMNS,
      hasHeaders: false,
    }, mapCandidateCommitteeLinkRow);
    console.log(`[bulk] parsed ${result.candidateCommitteeLinks.length} candidate-committee links`);
  } catch (error) {
    warnings.push(`Candidate-committee links: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // PAC Summary
  try {
    const path = await downloadBulkFile(cycle, `webk${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.pacSummaries = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: PAC_SUMMARY_COLUMNS,
      hasHeaders: false,
    }, mapPacSummaryRow);
    console.log(`[bulk] parsed ${result.pacSummaries.length} PAC summaries`);
  } catch (error) {
    warnings.push(`PAC summary: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Lobbyist/Registrant PACs (leadership pac links)
  try {
    const path = await downloadBulkFile(cycle, `webl${yy}.zip`, cacheDir);
    downloadedFiles.push(path);
    result.leadershipPacLinks = await parseSmallZipFile(path, {
      delimiter: "|",
      columns: LOBBYIST_REGISTRANT_COLUMNS,
      hasHeaders: false,
    }, mapLeadershipPacLinkRow);
    console.log(`[bulk] parsed ${result.leadershipPacLinks.length} lobbyist PAC links`);
  } catch (error) {
    warnings.push(`Lobbyist PACs: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Independent Expenditures (standalone CSV with headers)
  try {
    const path = await downloadBulkFile(cycle, `independent_expenditure_${yyyy}.csv`, cacheDir);
    downloadedFiles.push(path);
    result.independentExpenditures = await parseSmallCsvFile(path, {
      delimiter: ",",
      columns: [],
      hasHeaders: true,
    }, mapIndependentExpenditureRow);
    console.log(`[bulk] parsed ${result.independentExpenditures.length} independent expenditures`);
  } catch (error) {
    warnings.push(`Independent expenditures: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Communication Costs (standalone CSV)
  try {
    const path = await downloadBulkFile(cycle, `CommunicationCosts_${yyyy}.csv`, cacheDir);
    downloadedFiles.push(path);
    result.communicationCosts = await parseSmallCsvFile(path, {
      delimiter: ",",
      columns: [],
      hasHeaders: true,
    }, mapCommunicationCostRow);
    console.log(`[bulk] parsed ${result.communicationCosts.length} communication costs`);
  } catch (error) {
    warnings.push(`Communication costs: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // Electioneering Communications (standalone CSV)
  try {
    const path = await downloadBulkFile(cycle, `ElectioneeringComm_${yyyy}.csv`, cacheDir);
    downloadedFiles.push(path);
    result.electioneeringComms = await parseSmallCsvFile(path, {
      delimiter: ",",
      columns: [],
      hasHeaders: true,
    }, mapElectioneeringCommRow);
    console.log(`[bulk] parsed ${result.electioneeringComms.length} electioneering communications`);
  } catch (error) {
    warnings.push(`Electioneering communications: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  // --- Large files: stream to DB ---

  // Individual Contributions (4.2GB)
  if (dbWriter) {
    try {
      const path = await downloadBulkFile(cycle, `indiv${yy}.zip`, cacheDir);
      downloadedFiles.push(path);
      console.log(`[bulk] streaming individual contributions to database...`);
      result.contributionCount = await streamLargeZipFile(
        path,
        { delimiter: "|", columns: INDIVIDUAL_CONTRIBUTIONS_COLUMNS, hasHeaders: false },
        mapContributionRow,
        batchSize,
        (batch) => dbWriter.writeContributionBatch(batch),
      );
      console.log(`[bulk] streamed ${result.contributionCount.toLocaleString()} individual contributions`);
    } catch (error) {
      warnings.push(`Individual contributions: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    // Committee-to-Candidate Contributions (pas2, 25MB)
    try {
      const path = await downloadBulkFile(cycle, `pas2${yy}.zip`, cacheDir);
      downloadedFiles.push(path);
      console.log(`[bulk] streaming committee-to-candidate contributions...`);
      const pas2Count = await streamLargeZipFile(
        path,
        { delimiter: "|", columns: COMMITTEE_TO_CANDIDATE_COLUMNS, hasHeaders: false },
        mapContributionRow,
        batchSize,
        (batch) => dbWriter.writeContributionBatch(batch),
      );
      result.contributionCount += pas2Count;
      console.log(`[bulk] streamed ${pas2Count.toLocaleString()} committee-to-candidate contributions`);
    } catch (error) {
      warnings.push(`Committee-to-candidate contributions: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    // Inter-Committee Transactions (oth, 505MB)
    try {
      const path = await downloadBulkFile(cycle, `oth${yy}.zip`, cacheDir);
      downloadedFiles.push(path);
      console.log(`[bulk] streaming inter-committee transactions...`);
      result.intercommitteeTransactionCount = await streamLargeZipFile(
        path,
        { delimiter: "|", columns: INTER_COMMITTEE_COLUMNS, hasHeaders: false },
        mapContributionRow,
        batchSize,
        (batch) => dbWriter.writeContributionBatch(batch),
      );
      console.log(`[bulk] streamed ${result.intercommitteeTransactionCount.toLocaleString()} inter-committee transactions`);
    } catch (error) {
      warnings.push(`Inter-committee transactions: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    // Operating Expenditures (oppexp, 63MB)
    try {
      const path = await downloadBulkFile(cycle, `oppexp${yy}.zip`, cacheDir);
      downloadedFiles.push(path);
      console.log(`[bulk] streaming operating expenditures...`);
      result.operatingExpenditureCount = await streamLargeZipFile(
        path,
        { delimiter: "|", columns: OPERATING_EXPENDITURES_COLUMNS, hasHeaders: false },
        mapOperatingExpenditureRow,
        batchSize,
        (batch) => dbWriter.writeOperatingExpenditureBatch(cycle, batch),
      );
      console.log(`[bulk] streamed ${result.operatingExpenditureCount.toLocaleString()} operating expenditures`);
    } catch (error) {
      warnings.push(`Operating expenditures: ${error instanceof Error ? error.message : "unknown error"}`);
    }

    // Write small datasets to DB
    try {
      await dbWriter.writeCandidateCommitteeLinks(cycle, result.candidateCommitteeLinks);
      await dbWriter.writeCandidateFinancials(cycle, result.candidateFinancials);
      await dbWriter.writePacSummaries(cycle, result.pacSummaries);
      await dbWriter.writeLeadershipPacLinks(result.leadershipPacLinks);
      await dbWriter.writeIndependentExpenditureBatch(cycle, result.independentExpenditures);
    } catch (error) {
      warnings.push(`DB write for small datasets: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  } else {
    warnings.push("No database writer available — skipping large file streaming (indiv, pas2, oth, oppexp). Set DATABASE_URL to enable.");
  }

  // --- Cleanup ---
  if (cleanupAfterIngest) {
    for (const file of downloadedFiles) {
      await cleanupCacheFile(file);
    }
  }

  result.warnings = warnings;
  return result;
}
