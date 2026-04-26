import { readFile } from "node:fs/promises";
import path from "node:path";

type DatasetKey = "members" | "pacs" | "donors" | "bills" | "votes" | "states";

type Manifest = {
  datasets: Record<DatasetKey, { path: string; count: number; description: string }>;
};

const FEED_DIR = path.resolve(
  process.env.POLITIMONEY_FEED_VALIDATE_DIR ??
    process.env.POLITIMONEY_PAGES_FEED_DIR ??
    path.join(process.cwd(), "dist", "cloudflare", "data", "latest"),
);

const MIN_COUNTS: Record<DatasetKey, number> = {
  members: Number(process.env.POLITIMONEY_MIN_MEMBERS ?? 1),
  pacs: Number(process.env.POLITIMONEY_MIN_PACS ?? 1),
  donors: Number(process.env.POLITIMONEY_MIN_DONORS ?? 1),
  bills: Number(process.env.POLITIMONEY_MIN_BILLS ?? 1),
  votes: Number(process.env.POLITIMONEY_MIN_VOTES ?? 1),
  states: Number(process.env.POLITIMONEY_MIN_STATES ?? 50),
};

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function main() {
  const manifest = await readJson<Manifest>(path.join(FEED_DIR, "manifest.json"));
  const errors: string[] = [];

  for (const [section, minCount] of Object.entries(MIN_COUNTS) as [DatasetKey, number][]) {
    const dataset = manifest.datasets[section];
    if (!dataset) {
      errors.push(`${section}: missing from manifest`);
      continue;
    }

    if (dataset.count < minCount) {
      errors.push(`${section}: manifest count ${dataset.count} is below minimum ${minCount}`);
    }

    const entries = await readJson<unknown[]>(path.join(FEED_DIR, dataset.path));
    if (entries.length !== dataset.count) {
      errors.push(`${section}: index length ${entries.length} does not match manifest count ${dataset.count}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Public feed validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.log(`Public feed validation passed for ${FEED_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
