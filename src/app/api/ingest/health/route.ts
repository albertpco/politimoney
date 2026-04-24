import { NextResponse } from "next/server";
import { getIngestConfig } from "@/lib/ingest/config";
import {
  buildIngestHealthReport,
  readIngestHealthReport,
} from "@/lib/ingest/health";
import { readLatestSummary } from "@/lib/ingest/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const config = getIngestConfig();
  const [summary, persistedHealth] = await Promise.all([
    readLatestSummary(),
    readIngestHealthReport(),
  ]);
  const computedHealth = buildIngestHealthReport(
    summary,
    config.healthStaleMinutes,
  );

  return NextResponse.json({
    ok: computedHealth.ok,
    computed: computedHealth,
    persisted: persistedHealth,
  });
}
