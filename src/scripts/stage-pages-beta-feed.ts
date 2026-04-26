import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

type FeedEntry = {
  id: string;
  label: string;
  href: string;
  datasetPath: string;
  summary?: string;
  amount?: number;
  tags?: string[];
};

type Manifest = {
  schemaVersion: number;
  generatedAt: string;
  runId?: string;
  source: { kind: string; note: string };
  datasets: Record<string, { path: string; count: number; description: string }>;
  caveats: string[];
};

const SOURCE_DIR = path.resolve(
  process.env.POLITIMONEY_FEED_SOURCE_DIR ??
    process.env.POLITIRED_FEED_SOURCE_DIR ??
    path.join(process.cwd(), "dist", "public-feed", "latest"),
);
const TARGET_DIR = path.resolve(
  process.env.POLITIMONEY_PAGES_FEED_DIR ??
    path.join(process.cwd(), "dist", "cloudflare", "data", "latest"),
);
const BETA_LIMIT = Number(process.env.POLITIMONEY_BETA_FEED_LIMIT ?? 200);
const SECTIONS = ["members", "pacs", "donors", "bills", "votes", "states", "congressTrades"];

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, payload: unknown) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function copyFeedFile(relativePath: string) {
  if (path.isAbsolute(relativePath) || relativePath.split(path.sep).includes("..") || relativePath.includes("../")) {
    throw new Error(`Unsafe feed path: ${relativePath}`);
  }
  const source = path.resolve(SOURCE_DIR, relativePath);
  const target = path.resolve(TARGET_DIR, relativePath);
  if (!source.startsWith(`${SOURCE_DIR}${path.sep}`) || !target.startsWith(`${TARGET_DIR}${path.sep}`)) {
    throw new Error(`Feed path escapes staging directories: ${relativePath}`);
  }
  await mkdir(path.dirname(target), { recursive: true });
  await cp(source, target);
}

function validateIndex(section: string, entries: FeedEntry[]) {
  const ids = new Set<string>();
  const datasetPaths = new Set<string>();

  for (const entry of entries) {
    if (!entry.id.trim() || !entry.href.trim() || !entry.datasetPath.trim()) {
      throw new Error(`${section} contains a blank id, href, or datasetPath`);
    }
    for (const [label, value, seen] of [
      ["id", entry.id.toLowerCase(), ids],
      ["datasetPath", entry.datasetPath, datasetPaths],
    ] as const) {
      if (seen.has(value)) {
        throw new Error(`${section} contains duplicate ${label}: ${value}`);
      }
      seen.add(value);
    }
  }
}

async function main() {
  const manifest = await readJson<Manifest>(path.join(SOURCE_DIR, "manifest.json"));
  const stagedManifest: Manifest = {
    ...manifest,
    generatedAt: new Date().toISOString(),
    source: {
      ...manifest.source,
      note: `${manifest.source.note} This Pages beta includes curated indexes and detail records; use the full feed/R2 path for complete exports.`,
    },
    caveats: [
      "This is a curated Pages beta feed. It is intentionally smaller than the full generated feed.",
      ...manifest.caveats,
    ],
  };

  await rm(TARGET_DIR, { recursive: true, force: true });
  await mkdir(TARGET_DIR, { recursive: true });

  for (const section of SECTIONS) {
    const dataset = manifest.datasets[section];
    if (!dataset) continue;

    const entries = await readJson<FeedEntry[]>(path.join(SOURCE_DIR, dataset.path));
    validateIndex(section, entries);
    const stagedEntries = entries.slice(0, BETA_LIMIT);
    validateIndex(section, stagedEntries);
    await writeJson(path.join(TARGET_DIR, dataset.path), stagedEntries);

    stagedManifest.datasets[section] = {
      ...dataset,
      count: stagedEntries.length,
      description: `${dataset.description} Curated beta subset of ${entries.length.toLocaleString()} generated records.`,
    };

    for (const entry of stagedEntries) {
      await copyFeedFile(entry.datasetPath);
    }
  }

  await writeJson(path.join(TARGET_DIR, "manifest.json"), stagedManifest);
  console.log(`Staged Pages beta feed at ${TARGET_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
