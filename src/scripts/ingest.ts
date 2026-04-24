import { readLatestSummary } from "../lib/ingest/storage";
import { runIngestionPipeline } from "../lib/ingest/pipeline";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
  const showStatusOnly = process.argv.includes("--status");

  if (showStatusOnly) {
    const summary = await readLatestSummary();
    if (!summary) {
      console.log("No ingest run found yet. Run `npm run ingest` first.");
      return;
    }
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const result = await runIngestionPipeline();
  console.log("Ingestion completed:");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error("Ingestion failed:");
  console.error(error);
  process.exit(1);
});
