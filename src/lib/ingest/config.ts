export type IngestConfig = {
  fecApiKey: string | null;
  congressApiKey: string | null;
  cycles: number[];
  outcomesYears: number[];
  candidateLimit: number;
  fecCommitteeLimit: number;
  fecContributionLimit: number;
  fecMaxPagesPerDataset: number;
  fecContributionPageDelayMs: number;
  faraRegistrantLimit: number;
  healthStaleMinutes: number;
  scheduleIntervalMinutes: number;
  bulkCycles: number[];
  bulkCacheDir: string;
  bulkBatchSize: number;
  bulkCleanupAfterIngest: boolean;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
}

function parseCycleList(value: string | undefined, fallback: number[]): number[] {
  if (!value) return fallback;
  const items = value
    .split(",")
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n > 0);
  return items.length > 0 ? items : fallback;
}

export function getIngestConfig(): IngestConfig {
  const currentYear = new Date().getUTCFullYear();
  const singleCycleFallback = process.env.INGEST_CYCLE
    ? [parsePositiveInt(process.env.INGEST_CYCLE, currentYear)]
    : [2020, 2022, 2024, 2026];
  return {
    fecApiKey: process.env.FEC_API_KEY || null,
    congressApiKey: process.env.CONGRESS_API_KEY || null,
    cycles: parseCycleList(process.env.INGEST_CYCLES, singleCycleFallback),
    outcomesYears: parseCycleList(process.env.INGEST_OUTCOMES_YEARS, [2019, 2021, 2023]),
    candidateLimit: parsePositiveInt(process.env.INGEST_CANDIDATE_LIMIT, 800),
    fecCommitteeLimit: parsePositiveInt(process.env.INGEST_FEC_COMMITTEE_LIMIT, 2000),
    fecContributionLimit: parsePositiveInt(process.env.INGEST_FEC_CONTRIBUTION_LIMIT, 100000),
    fecMaxPagesPerDataset: parsePositiveInt(process.env.INGEST_FEC_MAX_PAGES_PER_DATASET, 500),
    fecContributionPageDelayMs: parseNonNegativeInt(
      process.env.INGEST_FEC_CONTRIBUTION_PAGE_DELAY_MS,
      800,
    ),
    faraRegistrantLimit: parsePositiveInt(process.env.INGEST_FARA_REGISTRANT_LIMIT, 25),
    healthStaleMinutes: parsePositiveInt(process.env.INGEST_HEALTH_STALE_MINUTES, 720),
    scheduleIntervalMinutes: parsePositiveInt(process.env.INGEST_SCHEDULE_INTERVAL_MINUTES, 360),
    bulkCycles: parseCycleList(process.env.INGEST_BULK_CYCLES, []),
    bulkCacheDir: process.env.INGEST_BULK_CACHE_DIR || "data/ingest/bulk-cache",
    bulkBatchSize: parsePositiveInt(process.env.INGEST_BULK_BATCH_SIZE, 5000),
    bulkCleanupAfterIngest: process.env.INGEST_BULK_CLEANUP !== "false",
  };
}
