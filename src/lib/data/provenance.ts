export type DataBackendMode = "database" | "json";

export type DataCoverageStatus = "complete" | "partial" | "missing" | "unknown";

export type DataFreshness = {
  asOf?: string;
  ageMinutes?: number;
  thresholdMinutes?: number;
  isStale: boolean;
  label?: string;
};

export type DataCoverage = {
  status: DataCoverageStatus;
  notes: string[];
  missingFields: string[];
  confidence?: number;
};

export type DataSourceRecord = {
  source: string;
  recordIds?: string[];
  urls?: string[];
  count?: number;
  asOf?: string;
};

export type DataProvenance = {
  backend: DataBackendMode;
  runId?: string;
  generatedAt?: string;
  sourceSystems: string[];
  sourceRecords: DataSourceRecord[];
  freshness: DataFreshness;
  coverage: DataCoverage;
  notes: string[];
};

export function createEmptyFreshness(): DataFreshness {
  return {
    isStale: false,
  };
}

export function createEmptyCoverage(): DataCoverage {
  return {
    status: "unknown",
    notes: [],
    missingFields: [],
  };
}

export function createEmptyProvenance(
  backend: DataBackendMode = "json",
): DataProvenance {
  return {
    backend,
    sourceSystems: [],
    sourceRecords: [],
    freshness: createEmptyFreshness(),
    coverage: createEmptyCoverage(),
    notes: [],
  };
}

