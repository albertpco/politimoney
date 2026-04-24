import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IngestRunSummary } from "@/lib/ingest/types";

export type IngestHealthReport = {
  ok: boolean;
  checkedAt: string;
  staleThresholdMinutes: number;
  isStale: boolean;
  latestRunId?: string;
  latestFinishedAt?: string;
  warningCount: number;
  sourceStatus: Record<string, { ok: boolean; records: number; error?: string }>;
  message: string;
};

const HEALTH_DIR = path.join(process.cwd(), "data", "ingest");
const HEALTH_FILE = path.join(HEALTH_DIR, "health.json");

export function buildIngestHealthReport(
  summary: IngestRunSummary | null,
  staleThresholdMinutes: number,
): IngestHealthReport {
  const checkedAt = new Date().toISOString();
  if (!summary) {
    return {
      ok: false,
      checkedAt,
      staleThresholdMinutes,
      isStale: true,
      warningCount: 0,
      sourceStatus: {},
      message: "No ingest summary available yet.",
    };
  }

  const finishedAtMs = Date.parse(summary.finishedAt);
  const ageMinutes = Number.isFinite(finishedAtMs)
    ? (Date.now() - finishedAtMs) / 60000
    : Number.POSITIVE_INFINITY;
  const isStale = !Number.isFinite(ageMinutes) || ageMinutes > staleThresholdMinutes;
  const sources = summary.sources;
  const sourceStatus = {
    fec: { ok: sources.fec.ok, records: sources.fec.records, error: sources.fec.error },
    fara: { ok: sources.fara.ok, records: sources.fara.records, error: sources.fara.error },
    congress: {
      ok: sources.congress.ok,
      records: sources.congress.records,
      error: sources.congress.error,
    },
    outcomes: {
      ok: sources.outcomes.ok,
      records: sources.outcomes.records,
      error: sources.outcomes.error,
    },
  };

  const sourcesOk = Object.values(sourceStatus).every((item) => item.ok);
  const ok = sourcesOk && !isStale;

  return {
    ok,
    checkedAt,
    staleThresholdMinutes,
    isStale,
    latestRunId: summary.runId,
    latestFinishedAt: summary.finishedAt,
    warningCount: summary.warnings.length,
    sourceStatus,
    message: ok
      ? "Ingestion is healthy."
      : isStale
        ? `Ingestion is stale (older than ${staleThresholdMinutes} minutes).`
        : "At least one ingestion source failed in latest run.",
  };
}

export async function writeIngestHealthReport(report: IngestHealthReport) {
  await mkdir(HEALTH_DIR, { recursive: true });
  await writeFile(HEALTH_FILE, JSON.stringify(report, null, 2), "utf8");
}

export async function readIngestHealthReport(): Promise<IngestHealthReport | null> {
  try {
    const raw = await readFile(HEALTH_FILE, "utf8");
    return JSON.parse(raw) as IngestHealthReport;
  } catch {
    return null;
  }
}
