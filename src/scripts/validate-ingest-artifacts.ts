import { readFile } from "node:fs/promises";
import path from "node:path";

type DatasetKey =
  | "members"
  | "pacs"
  | "donors"
  | "bills"
  | "houseVotes"
  | "houseVoteMemberVotes"
  | "senateVotes"
  | "senateVoteMemberVotes"
  | "states";

type DatasetRule = {
  file: string;
  min: number;
};

type IngestSummary = {
  sources?: Record<string, { ok?: boolean; error?: string; records?: number }>;
};

const INGEST_DIR = path.resolve(
  process.env.POLITIMONEY_INGEST_VALIDATE_DIR ??
    path.join(process.cwd(), "data", "ingest", "latest"),
);

const RULES: Record<DatasetKey, DatasetRule> = {
  members: {
    file: "congress.members.json",
    min: Number(process.env.POLITIMONEY_MIN_MEMBERS ?? 1),
  },
  pacs: {
    file: "derived.funding-read-models.json",
    min: Number(process.env.POLITIMONEY_MIN_PACS ?? 1),
  },
  donors: {
    file: "derived.funding-read-models.json",
    min: Number(process.env.POLITIMONEY_MIN_DONORS ?? 1),
  },
  bills: {
    file: "congress.bills.json",
    min: Number(process.env.POLITIMONEY_MIN_BILLS ?? 1),
  },
  houseVotes: {
    file: "congress.house-votes.json",
    min: Number(process.env.POLITIMONEY_MIN_HOUSE_VOTES ?? 1),
  },
  houseVoteMemberVotes: {
    file: "congress.house-vote-member-votes.json",
    min: Number(process.env.POLITIMONEY_MIN_HOUSE_MEMBER_VOTES ?? 1),
  },
  senateVotes: {
    file: "congress.senate-votes.json",
    min: Number(process.env.POLITIMONEY_MIN_SENATE_VOTES ?? 1),
  },
  senateVoteMemberVotes: {
    file: "congress.senate-vote-member-votes.json",
    min: Number(process.env.POLITIMONEY_MIN_SENATE_MEMBER_VOTES ?? 1),
  },
  states: {
    file: "outcomes.states.json",
    min: Number(process.env.POLITIMONEY_MIN_STATES ?? 50),
  },
};

const REQUIRED_SOURCES = (process.env.POLITIMONEY_REQUIRED_INGEST_SOURCES ?? "fec,congress,outcomes")
  .split(",")
  .map((source) => source.trim())
  .filter(Boolean);

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function countRows(key: DatasetKey, payload: unknown): number {
  if (Array.isArray(payload)) return payload.length;

  if (key === "pacs" && payload && typeof payload === "object") {
    const profiles = (payload as { profiles?: unknown[] }).profiles ?? [];
    return profiles.filter((profile) => {
      return (
        profile &&
        typeof profile === "object" &&
        (profile as { entityType?: unknown }).entityType === "committee"
      );
    }).length;
  }

  if (key === "donors" && payload && typeof payload === "object") {
    return ((payload as { donors?: unknown[] }).donors ?? []).length;
  }

  return 0;
}

async function main() {
  const errors: string[] = [];
  const summary = await readJson<IngestSummary>(path.join(INGEST_DIR, "summary.json"));

  for (const sourceName of REQUIRED_SOURCES) {
    const source = summary.sources?.[sourceName];
    if (!source) {
      errors.push(`source ${sourceName}: missing from summary`);
    } else if (!source.ok) {
      errors.push(`source ${sourceName}: failed${source.error ? ` (${source.error})` : ""}`);
    }
  }

  for (const [key, rule] of Object.entries(RULES) as [DatasetKey, DatasetRule][]) {
    let payload: unknown;
    try {
      payload = await readJson(path.join(INGEST_DIR, rule.file));
    } catch (error) {
      errors.push(`${key}: cannot read ${rule.file} (${error instanceof Error ? error.message : "unknown error"})`);
      continue;
    }

    const count = countRows(key, payload);
    if (count < rule.min) {
      errors.push(`${key}: ${count} rows in ${rule.file}, below minimum ${rule.min}`);
    }
  }

  if (errors.length > 0) {
    throw new Error(`Ingest artifact validation failed:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  console.log(`Ingest artifact validation passed for ${INGEST_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
