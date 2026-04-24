import { loadEnvConfig } from "@next/env";
import { getIngestConfig } from "../lib/ingest/config";
import {
  buildIngestHealthReport,
  writeIngestHealthReport,
} from "../lib/ingest/health";
import { runIngestionPipeline } from "../lib/ingest/pipeline";
import { readLatestSummary } from "../lib/ingest/storage";

loadEnvConfig(process.cwd());

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSingleCycle() {
  console.log(`[scheduler] ${new Date().toISOString()} starting ingest cycle`);
  try {
    const summary = await runIngestionPipeline();
    console.log(
      `[scheduler] completed run ${summary.runId} with ${summary.warnings.length} warning(s)`,
    );
  } catch (error) {
    console.error("[scheduler] ingest cycle failed");
    console.error(error);

    const config = getIngestConfig();
    const latest = await readLatestSummary();
    const health = buildIngestHealthReport(latest, config.healthStaleMinutes);
    health.ok = false;
    health.message = `Latest scheduler cycle failed: ${
      error instanceof Error ? error.message : "unknown error"
    }`;
    await writeIngestHealthReport(health);
  }
}

async function main() {
  const runOnce = process.argv.includes("--once");
  const config = getIngestConfig();
  const intervalMs = config.scheduleIntervalMinutes * 60_000;

  if (runOnce) {
    await runSingleCycle();
    return;
  }

  console.log(
    `[scheduler] started, interval=${config.scheduleIntervalMinutes} minute(s), stale-threshold=${config.healthStaleMinutes} minute(s)`,
  );

  while (true) {
    await runSingleCycle();
    console.log(
      `[scheduler] sleeping ${config.scheduleIntervalMinutes} minute(s) until next cycle`,
    );
    await sleep(intervalMs);
  }
}

main().catch((error) => {
  console.error("[scheduler] fatal startup error");
  console.error(error);
  process.exit(1);
});
