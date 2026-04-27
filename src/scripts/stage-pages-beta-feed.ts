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
const INGEST_DIR = path.resolve(
  process.env.POLITIMONEY_INGEST_DIR ?? path.join(process.cwd(), "data", "ingest", "latest"),
);
const BETA_LIMIT = Number(process.env.POLITIMONEY_BETA_FEED_LIMIT ?? 200);
const SECTIONS = ["members", "pacs", "donors", "bills", "votes", "states", "congressTrades"];

/**
 * For sections like "votes" where one index multiplexes multiple sub-shards
 * (votes/house/* and votes/senate/*), interleave entries across shards so the
 * beta limit doesn't accidentally drop one chamber entirely.
 */
function interleaveByShard(entries: FeedEntry[]): FeedEntry[] {
  const shards = new Map<string, FeedEntry[]>();
  for (const entry of entries) {
    const segs = entry.datasetPath.split("/");
    const shardKey = segs.length >= 2 ? segs[1] : "_root";
    const list = shards.get(shardKey);
    if (list) list.push(entry);
    else shards.set(shardKey, [entry]);
  }
  if (shards.size <= 1) return entries;
  const result: FeedEntry[] = [];
  const iters = [...shards.values()].map((list) => list[Symbol.iterator]());
  let active = iters.length;
  while (active > 0) {
    active = 0;
    for (const it of iters) {
      const next = it.next();
      if (!next.done) {
        result.push(next.value);
        active++;
      }
    }
  }
  return result;
}

async function scoreEntry(section: string, entry: FeedEntry): Promise<number> {
  if (section === "pacs") {
    return entry.amount ?? 0;
  }
  if (section === "bills") {
    const detail = await readJsonOptional<{ linkedVotes?: unknown[]; bill?: { sponsor?: string; summary?: string } }>(
      path.join(SOURCE_DIR, entry.datasetPath),
    );
    return (
      (detail?.linkedVotes?.length ?? 0) * 100 +
      (detail?.bill?.sponsor ? 10 : 0) +
      (detail?.bill?.summary ? 5 : 0)
    );
  }
  return 0;
}

async function orderEntriesForBeta(section: string, entries: FeedEntry[]): Promise<FeedEntry[]> {
  if (section === "votes") return interleaveByShard(entries);
  if (section !== "pacs" && section !== "bills") return entries;

  const scored = await Promise.all(
    entries.map(async (entry, index) => ({
      entry,
      index,
      score: await scoreEntry(section, entry),
    })),
  );
  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((row) => row.entry);
}

async function readJsonOptional<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

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
    const ordered = await orderEntriesForBeta(section, entries);
    const stagedEntries = ordered.slice(0, BETA_LIMIT);
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

  // ── Auxiliary files needed by the Vite SPA pages ──────────────────────────

  // 1. launch-summary.json — shape the derived ingest artifact for the SPA
  const launchSrc = await readJsonOptional<{
    runId?: string;
    generatedAt?: string;
    totals?: Record<string, number>;
    topMembers?: Array<{ id: string; label: string; amount: number; party?: string; state?: string }>;
    topCommittees?: Array<{ id: string; label: string; amount: number }>;
    latestHouseVote?: { voteId: string; billId?: string; question?: string; result?: string };
    latestSenateVote?: { voteId: string; billId?: string; question?: string; result?: string };
  }>(path.join(INGEST_DIR, "derived.launch-summary.json"));
  if (launchSrc) {
    const launchSummary = {
      runId: launchSrc.runId,
      generatedAt: launchSrc.generatedAt,
      totals: {
        members: launchSrc.totals?.congressMembers ?? launchSrc.totals?.members ?? 0,
        committees: launchSrc.totals?.committees ?? 0,
        bills: launchSrc.totals?.bills ?? 0,
        votes: launchSrc.totals?.votes ?? 0,
        states: launchSrc.totals?.states ?? 0,
        candidates: launchSrc.totals?.candidates ?? 0,
      },
      topMembers: (launchSrc.topMembers ?? []).map((m) => ({
        bioguideId: m.id,
        name: m.label,
        total: m.amount,
        party: m.party,
        state: m.state,
      })),
      topCommittees: (launchSrc.topCommittees ?? []).map((c) => ({
        committeeId: c.id,
        name: c.label,
        total: c.amount,
      })),
      latestHouseVote: launchSrc.latestHouseVote,
      latestSenateVote: launchSrc.latestSenateVote,
    };
    await writeJson(path.join(TARGET_DIR, "launch-summary.json"), launchSummary);
  }

  // 2. state-outcomes.json — single aggregated outcomes file
  const outcomes = await readJsonOptional<unknown[]>(path.join(INGEST_DIR, "outcomes.states.json"));
  if (outcomes) {
    await writeJson(path.join(TARGET_DIR, "state-outcomes.json"), outcomes);
  }

  // 3. members.json — flat list (used by state delegation panel)
  const members = await readJsonOptional<unknown[]>(path.join(INGEST_DIR, "congress.members.json"));
  if (members) {
    await writeJson(path.join(TARGET_DIR, "members.json"), members);
  }

  // 4. committees.json — flat committee list (recent-receipts ticker lookup)
  const committees = await readJsonOptional<unknown[]>(path.join(INGEST_DIR, "fec.committees.json"));
  if (committees) {
    await writeJson(path.join(TARGET_DIR, "committees.json"), committees);
  }

  // 5. recent-receipts.json — most recent contribution rows (limit to 200)
  const contributions = await readJsonOptional<Array<{ contributionDate?: string }>>(
    path.join(INGEST_DIR, "fec.contributions.json"),
  );
  if (contributions) {
    const recent = [...contributions]
      .filter((c) => c.contributionDate && !Number.isNaN(new Date(c.contributionDate).getTime()))
      .sort(
        (a, b) =>
          new Date(b.contributionDate as string).getTime() -
          new Date(a.contributionDate as string).getTime(),
      )
      .slice(0, 200);
    await writeJson(path.join(TARGET_DIR, "recent-receipts.json"), recent);
  }

  console.log(`Staged Pages beta feed at ${TARGET_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
