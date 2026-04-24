import { fetchJson } from "@/lib/ingest/http";
import type {
  FecCandidate,
  FecCommittee,
  FecContribution,
  FecRecentEfiling,
} from "@/lib/ingest/types";

type FecCandidateApiRow = {
  candidate_id?: string;
  name?: string;
  office?: string;
  state?: string;
  party_full?: string;
  incumbent_challenge_full?: string;
  principal_committees?: { committee_id?: string; name?: string }[];
};

type FecCommitteeApiRow = {
  committee_id?: string;
  name?: string;
  committee_type_full?: string;
  party_full?: string;
  candidate_ids?: string[];
};

type FecContributionApiRow = {
  committee_id?: string;
  committee_name?: string;
  contributor_name?: string;
  entity_type_desc?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contribution_receipt_amount?: number;
  contribution_receipt_date?: string;
  contributor_city?: string;
  contributor_state?: string;
  memo_text?: string;
};

export type FecIngestResult = {
  candidates: FecCandidate[];
  committees: FecCommittee[];
  contributions: FecContribution[];
  warnings: string[];
};

const FEC_BASE_URL = "https://api.open.fec.gov/v1";
const FEDERAL_OFFICES = ["S", "H"] as const;

function buildFecUrl(
  path: string,
  params: Record<string, string | number | undefined>,
  apiKey: string,
) {
  const query = new URLSearchParams();
  query.set("api_key", apiKey);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    query.set(key, String(value));
  }
  return `${FEC_BASE_URL}${path}?${query.toString()}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function ingestFecData({
  apiKey,
  cycle,
  candidateLimit,
  committeeLimit,
  contributionLimit,
  maxPagesPerDataset,
  contributionPageDelayMs,
}: {
  apiKey: string | null;
  cycle: number;
  candidateLimit: number;
  committeeLimit: number;
  contributionLimit: number;
  maxPagesPerDataset: number;
  contributionPageDelayMs: number;
}): Promise<FecIngestResult> {
  const warnings: string[] = [];
  if (!apiKey) {
    warnings.push("FEC_API_KEY missing. Skipping FEC ingestion.");
    return { candidates: [], committees: [], contributions: [], warnings };
  }
  const fecApiKey = apiKey;

  async function fetchRowsWithPagination<T>({
    endpoint,
    limit,
    sort,
    extraParams,
    pageDelayMs = 0,
  }: {
    endpoint: string;
    limit: number;
    sort: string;
    extraParams?: Record<string, string | number | undefined>;
    pageDelayMs?: number;
  }): Promise<T[]> {
    const rows: T[] = [];
    let page = 1;
    let totalPages = 1;
    const perPage = 100;

    while (
      rows.length < limit &&
      page <= totalPages &&
      page <= maxPagesPerDataset
    ) {
      if (page > 1 && pageDelayMs > 0) {
        await sleep(pageDelayMs);
      }
      const url = buildFecUrl(
        endpoint,
        {
          page,
          per_page: perPage,
          sort,
          sort_hide_null: "false",
          sort_null_only: "false",
          ...extraParams,
        },
        fecApiKey,
      );

      let payload: { results?: T[]; pagination?: { pages?: number } } | null = null;
      try {
        payload = await fetchJson<{
          results?: T[];
          pagination?: { pages?: number };
        }>(url);
      } catch (error) {
        warnings.push(
          `FEC ${endpoint} pagination halted at page ${page}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        break;
      }
      if (!payload) break;

      const pageRows = payload.results ?? [];
      totalPages = payload.pagination?.pages ?? totalPages;
      rows.push(...pageRows);
      page += 1;
    }

    if (page > maxPagesPerDataset && page <= totalPages) {
      warnings.push(
        `FEC ${endpoint} truncated at ${maxPagesPerDataset} pages. Increase INGEST_FEC_MAX_PAGES_PER_DATASET to pull more.`,
      );
    }

    return rows.slice(0, limit);
  }

  let candidateRows: FecCandidateApiRow[] = [];
  const candidateRowsById = new Map<string, FecCandidateApiRow>();
  const officeCandidateCounts: Partial<Record<(typeof FEDERAL_OFFICES)[number], number>> = {};
  for (const office of FEDERAL_OFFICES) {
    try {
      const officeRows = await fetchRowsWithPagination<FecCandidateApiRow>({
        endpoint: "/candidates/",
        limit: candidateLimit,
        sort: "name",
        extraParams: { cycle, office },
      });
      officeCandidateCounts[office] = officeRows.length;
      for (const row of officeRows) {
        if (row.candidate_id) {
          candidateRowsById.set(row.candidate_id, row);
        }
      }
    } catch (error) {
      const officeName = office === "S" ? "Senate" : "House";
      warnings.push(
        `FEC ${officeName} candidates pull failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }
  candidateRows = [...candidateRowsById.values()];

  if (!candidateRows.length) {
    try {
      // Fallback: preserve previous behavior if office-filtered pulls fail.
      candidateRows = await fetchRowsWithPagination<FecCandidateApiRow>({
        endpoint: "/candidates/",
        limit: candidateLimit,
        sort: "name",
        extraParams: { cycle },
      });
    } catch (error) {
      warnings.push(
        `FEC candidates pull failed: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    }
  }

  let committeeRows: FecCommitteeApiRow[] = [];
  try {
    committeeRows = await fetchRowsWithPagination<FecCommitteeApiRow>({
      endpoint: "/committees/",
      limit: committeeLimit,
      sort: "name",
      extraParams: { cycle },
    });
  } catch (error) {
    warnings.push(
      `FEC committees pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  let contributionRows: FecContributionApiRow[] = [];
  try {
    contributionRows = await fetchRowsWithPagination<FecContributionApiRow>({
      endpoint: "/schedules/schedule_a/",
      limit: contributionLimit,
      sort: "-contribution_receipt_amount",
      extraParams: { two_year_transaction_period: cycle },
      pageDelayMs: contributionPageDelayMs,
    });
  } catch (error) {
    warnings.push(
      `FEC contributions pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  const committees = committeeRows
    .filter((row): row is Required<Pick<FecCommitteeApiRow, "committee_id">> & FecCommitteeApiRow => Boolean(row.committee_id))
    .map((row) => ({
      committeeId: row.committee_id,
      name: row.name ?? row.committee_id,
      committeeType: row.committee_type_full,
      party: row.party_full,
    }));

  const candidateCommitteeMap = new Map<string, Set<string>>();
  for (const row of committeeRows) {
    const committeeId = row.committee_id;
    if (!committeeId) continue;
    for (const candidateId of row.candidate_ids ?? []) {
      const linked = candidateCommitteeMap.get(candidateId) ?? new Set<string>();
      linked.add(committeeId);
      candidateCommitteeMap.set(candidateId, linked);
    }
  }

  const candidates = candidateRows
    .filter((row): row is Required<Pick<FecCandidateApiRow, "candidate_id">> & FecCandidateApiRow => Boolean(row.candidate_id))
    .map((row) => {
      const fromCommitteeDataset = [
        ...(candidateCommitteeMap.get(row.candidate_id) ?? new Set<string>()),
      ];
      const fromCandidateRow = (row.principal_committees ?? [])
        .map((committee) => committee.committee_id)
        .filter((value): value is string => Boolean(value));
      const principalCommittees = [...new Set([...fromCommitteeDataset, ...fromCandidateRow])];

      return {
        candidateId: row.candidate_id,
        name: row.name ?? row.candidate_id,
        office: row.office ?? "Unknown",
        officeState: row.state,
        party: row.party_full,
        incumbentChallenge: row.incumbent_challenge_full,
        principalCommittees,
      };
    });

  const contributions = contributionRows
    .filter(
      (row): row is Required<Pick<FecContributionApiRow, "committee_id" | "contributor_name">> & FecContributionApiRow =>
        Boolean(row.committee_id && row.contributor_name),
    )
    .map((row) => ({
      committeeId: row.committee_id,
      committeeName: row.committee_name,
      donorName: row.contributor_name,
      donorEntityType: row.entity_type_desc,
      donorEmployer: row.contributor_employer,
      donorOccupation: row.contributor_occupation,
      amount: row.contribution_receipt_amount ?? 0,
      contributionDate: row.contribution_receipt_date,
      city: row.contributor_city,
      state: row.contributor_state,
      memoText: row.memo_text,
    }));

  if (!committees.length) {
    warnings.push("No FEC committees returned for this cycle/limit window.");
  }
  if (!officeCandidateCounts.S) {
    warnings.push("No Senate candidates returned for this cycle/limit window.");
  }
  if (!officeCandidateCounts.H) {
    warnings.push("No House candidates returned for this cycle/limit window.");
  }
  if (!contributions.length) {
    warnings.push("No FEC contributions returned for this cycle/limit window.");
  }

  return {
    candidates,
    committees,
    contributions,
    warnings,
  };
}

// --- eFiling (real-time contributions) ---

type FecEfilingApiRow = {
  committee_id?: string;
  committee_name?: string;
  contributor_name?: string;
  contributor_employer?: string;
  contributor_occupation?: string;
  contribution_receipt_amount?: number;
  contribution_receipt_date?: string;
  contributor_city?: string;
  contributor_state?: string;
  sub_id?: string;
  file_number?: number;
  image_number?: string;
};

export type EfilingIngestResult = {
  efilings: FecRecentEfiling[];
  warnings: string[];
};

export async function ingestRecentEfilings({
  apiKey,
  daysBack = 30,
  limit = 10000,
  committeeId,
}: {
  apiKey: string | null;
  daysBack?: number;
  limit?: number;
  committeeId?: string;
}): Promise<EfilingIngestResult> {
  const warnings: string[] = [];
  if (!apiKey) {
    warnings.push("FEC_API_KEY missing. Skipping eFiling ingestion.");
    return { efilings: [], warnings };
  }

  const now = new Date();
  const minDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
  const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

  const rows: FecEfilingApiRow[] = [];
  let page = 1;
  let totalPages = 1;
  const perPage = 100;
  const maxPages = Math.ceil(limit / perPage) + 1;

  while (rows.length < limit && page <= totalPages && page <= maxPages) {
    if (page > 1) await sleep(400);

    const extraParams: Record<string, string | number> = {
      min_date: fmtDate(minDate),
      max_date: fmtDate(now),
      sort: "-contribution_receipt_date",
      sort_hide_null: "false",
      sort_null_only: "false",
      per_page: perPage,
      page,
    };
    if (committeeId) extraParams.committee_id = committeeId;

    const url = buildFecUrl("/schedules/schedule_a/efile/", extraParams, apiKey);

    try {
      const payload = await fetchJson<{
        results?: FecEfilingApiRow[];
        pagination?: { pages?: number };
      }>(url);
      totalPages = payload.pagination?.pages ?? totalPages;
      rows.push(...(payload.results ?? []));
    } catch (error) {
      warnings.push(
        `FEC eFiling page ${page} failed: ${error instanceof Error ? error.message : "unknown"}`,
      );
      break;
    }
    page += 1;
  }

  // Deduplicate by sub_id (amendments replace earlier records)
  const seen = new Map<string, FecEfilingApiRow>();
  for (const row of rows) {
    const key = row.sub_id ?? `${row.committee_id}-${row.contributor_name}-${row.contribution_receipt_amount}-${row.contribution_receipt_date}`;
    seen.set(key, row);
  }

  const efilings: FecRecentEfiling[] = [...seen.values()]
    .filter((row): row is FecEfilingApiRow & { committee_id: string; contributor_name: string } =>
      Boolean(row.committee_id && row.contributor_name),
    )
    .slice(0, limit)
    .map((row) => ({
      committeeId: row.committee_id,
      committeeName: row.committee_name,
      donorName: row.contributor_name,
      donorEmployer: row.contributor_employer,
      donorOccupation: row.contributor_occupation,
      amount: row.contribution_receipt_amount ?? 0,
      contributionDate: row.contribution_receipt_date,
      city: row.contributor_city,
      state: row.contributor_state,
      subId: row.sub_id,
      filingId: row.file_number,
      imageNumber: row.image_number,
    }));

  return { efilings, warnings };
}
