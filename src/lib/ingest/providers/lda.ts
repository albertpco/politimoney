/**
 * Senate Lobbying Disclosure Act (LDA) provider.
 *
 * Fetches lobbying filings and lobbyist political contributions from
 * https://lda.senate.gov/api/v1/, paginates through results, extracts
 * bill numbers from activity descriptions, and aggregates client profiles
 * with crosswalk links to FEC committees and USASpending contractors.
 */

import { fetchJson } from "@/lib/ingest/http";
import type {
  ContractorProfile,
  FecCommittee,
  CongressMember,
  LobbyingFiling,
  LobbyistContribution,
  LobbyingClientProfile,
  LobbyingActivity,
} from "@/lib/ingest/types";

const LDA_BASE = "https://lda.gov/api/v1";
const PAGE_SIZE = 25;
const PAGE_DELAY_MS = 1500; // polite rate-limiting
const DEFAULT_MAX_PAGES = Number(process.env.INGEST_LDA_MAX_PAGES ?? 20);
const QUARTERLY_PERIODS = [
  { period: "first_quarter", filingType: "Q1", label: "Q1" },
  { period: "second_quarter", filingType: "Q2", label: "Q2" },
  { period: "third_quarter", filingType: "Q3", label: "Q3" },
  { period: "fourth_quarter", filingType: "Q4", label: "Q4" },
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Bill number regex ---

const BILL_NUMBER_RE =
  /[HS]\.?\s*(?:R|J\.?\s*Res|Con\.?\s*Res|Res)?\.?\s*\d+/gi;

function extractBillNumbers(text: string): string[] {
  const matches = text.match(BILL_NUMBER_RE);
  if (!matches) return [];
  // Deduplicate and normalize whitespace
  const seen = new Set<string>();
  const results: string[] = [];
  for (const raw of matches) {
    const normalized = raw.replace(/\s+/g, " ").trim();
    if (!seen.has(normalized.toUpperCase())) {
      seen.add(normalized.toUpperCase());
      results.push(normalized);
    }
  }
  return results;
}

// --- LDA API response types ---

type LdaPaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type LdaFilingActivity = {
  general_issue_code?: string;
  general_issue_code_display?: string;
  description?: string;
  foreign_entity_issues?: string;
  lobbyists?: { lobbyist_full_display_name?: string }[];
  government_entities?: { name?: string }[];
};

type LdaFilingRow = {
  filing_uuid?: string;
  filing_type?: string;
  filing_year?: number;
  filing_period?: string;
  filing_period_display?: string;
  registrant?: { name?: string; id?: number };
  client?: { name?: string; id?: number };
  income?: string | number | null;
  expenses?: string | number | null;
  lobbying_activities?: LdaFilingActivity[];
};

type LdaContributionRow = {
  filing_uuid?: string;
  filing_year?: number;
  filing_type?: string;
  contributor_name?: string;
  payee_name?: string;
  honoree_name?: string;
  amount?: string | number | null;
  date?: string;
  contribution_type?: string;
};

function parseAmount(value: string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  const parsed = Number.parseFloat(value.replace(/[,$]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapActivity(raw: LdaFilingActivity): LobbyingActivity {
  const description = raw.description ?? "";
  return {
    issueCode: raw.general_issue_code ?? raw.general_issue_code_display ?? "",
    description,
    billNumbers: extractBillNumbers(description),
    governmentEntities: (raw.government_entities ?? [])
      .map((e) => e.name ?? "")
      .filter(Boolean),
  };
}

// --- Paginated fetch helper ---

async function paginateAll<TRaw, TMapped>(
  baseUrl: string,
  mapFn: (row: TRaw) => TMapped,
  maxPages = DEFAULT_MAX_PAGES,
  label = "",
): Promise<{ results: TMapped[]; warnings: string[] }> {
  const warnings: string[] = [];
  const results: TMapped[] = [];
  let url: string | null = baseUrl;
  let page = 0;

  while (url && page < maxPages) {
    page++;
    const pageResult = await fetchLdaPage<TRaw>(url, label, page);
    if (pageResult.warning) warnings.push(pageResult.warning);
    if (!pageResult.data) break;
    const data = pageResult.data;

    for (const row of data.results) {
      results.push(mapFn(row));
    }

    if (page % 50 === 0 || page === 1) {
      const totalPages = Math.ceil(data.count / PAGE_SIZE);
      console.log(`  LDA ${label}: page ${page}/${totalPages} (${results.length}/${data.count} records)`);
    }

    url = data.next;
    if (url) await sleep(PAGE_DELAY_MS);
  }

  return { results, warnings };
}

async function fetchLdaPage<TRaw>(
  url: string,
  label: string,
  page: number,
): Promise<{ data?: LdaPaginatedResponse<TRaw>; warning?: string }> {
  let lastMessage = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      return { data: await fetchJson<LdaPaginatedResponse<TRaw>>(url) };
    } catch (error) {
      lastMessage = error instanceof Error ? error.message : "unknown error";
      const retrySeconds = Number(lastMessage.match(/Expected available in (\d+) seconds/)?.[1] ?? 0);
      const waitMs = retrySeconds > 0 ? (retrySeconds + 1) * 1000 : PAGE_DELAY_MS * (attempt + 2);
      if (!lastMessage.includes("(429)") || attempt === 3) break;
      await sleep(waitMs);
    }
  }

  return {
    warning: `LDA fetch failed on page ${page} of ${label}: ${lastMessage}`,
  };
}

// --- Public ingest functions ---

export async function ingestLobbyingFilings({
  year = 2024,
  periods = QUARTERLY_PERIODS.map((period) => period.label),
}: {
  year?: number;
  periods?: string[];
} = {}): Promise<{ filings: LobbyingFiling[]; warnings: string[] }> {
  const allFilings: LobbyingFiling[] = [];
  const allWarnings: string[] = [];

  for (const requestedPeriod of periods) {
    const quarter =
      QUARTERLY_PERIODS.find((period) => period.label === requestedPeriod) ??
      QUARTERLY_PERIODS.find((period) => period.period === requestedPeriod);
    if (!quarter) {
      allWarnings.push(`Skipping unknown LDA filing period: ${requestedPeriod}`);
      continue;
    }

    const url = `${LDA_BASE}/filings/?filing_year=${year}&filing_period=${quarter.period}&filing_type=${quarter.filingType}&page_size=${PAGE_SIZE}`;
    console.log(`\nFetching LDA filings for ${year} ${quarter.label}...`);

    const { results, warnings } = await paginateAll<LdaFilingRow, LobbyingFiling>(
      url,
      (row) => ({
        registrantName: row.registrant?.name ?? "Unknown",
        clientName: row.client?.name ?? "Unknown",
        income: parseAmount(row.income),
        expenses: parseAmount(row.expenses),
        filingYear: row.filing_year ?? year,
        filingPeriod: row.filing_period_display ?? quarter.label,
        lobbyingActivities: (row.lobbying_activities ?? []).map(mapActivity),
      }),
      DEFAULT_MAX_PAGES,
      `filings ${year} ${quarter.label}`,
    );

    allFilings.push(...results);
    allWarnings.push(...warnings);
    console.log(`  ${quarter.label}: ${results.length} filings`);
  }

  return { filings: allFilings, warnings: allWarnings };
}

export async function ingestLobbyistContributions({
  year = 2024,
}: {
  year?: number;
} = {}): Promise<{ contributions: LobbyistContribution[]; warnings: string[] }> {
  const url = `${LDA_BASE}/contributions/?filing_year=${year}&page_size=${PAGE_SIZE}`;
  console.log(`\nFetching LDA contributions for ${year}...`);

  const { results, warnings } = await paginateAll<LdaContributionRow, LobbyistContribution>(
    url,
    (row) => ({
      contributorName: row.contributor_name ?? "Unknown",
      payeeName: row.payee_name ?? "",
      honoreeName: row.honoree_name ?? "",
      amount: parseAmount(row.amount),
      date: row.date ?? "",
      contributionType: row.contribution_type ?? "",
    }),
    DEFAULT_MAX_PAGES,
    `contributions ${year}`,
  );

  console.log(`  Contributions: ${results.length} records`);
  return { contributions: results, warnings };
}

// --- Crosswalk helpers ---

function normalizeForMatch(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,\-'"()]/g, " ")
    .replace(/\b(CORP|CORPORATION|INC|INCORPORATED|LLC|LLP|CO|COMPANY|LTD|LIMITED|GROUP|HOLDINGS|ENTERPRISES|LP|NA|N A|PAC|POLITICAL ACTION COMMITTEE)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function matchPayeeToCommittee(
  payeeName: string,
  committeeIndex: Map<string, string>,
): string | undefined {
  // Try exact normalized match first
  const normalized = normalizeForMatch(payeeName);
  const exact = committeeIndex.get(normalized);
  if (exact) return exact;

  // Try substring match for shorter payee names (e.g. "AIPAC" matching "AMERICAN ISRAEL PUBLIC AFFAIRS COMMITTEE")
  if (normalized.length >= 4) {
    for (const [key, id] of committeeIndex) {
      if (key.includes(normalized) || normalized.includes(key)) {
        return id;
      }
    }
  }
  return undefined;
}

function matchHonoreeToMember(
  honoreeName: string,
  memberIndex: Map<string, string>,
): string | undefined {
  if (!honoreeName) return undefined;
  const normalized = honoreeName.toUpperCase().trim();

  // Direct match
  const direct = memberIndex.get(normalized);
  if (direct) return direct;

  // Try last name match
  const tokens = normalized.split(/\s+/);
  const lastName = tokens[tokens.length - 1];
  if (lastName && lastName.length >= 3) {
    for (const [key, name] of memberIndex) {
      if (key.includes(lastName)) return name;
    }
  }
  return undefined;
}

// --- Client profile aggregation ---

export function buildLobbyingClientProfiles(
  filings: LobbyingFiling[],
  committees: FecCommittee[],
  contractors: ContractorProfile[],
): LobbyingClientProfile[] {
  // Build committee name index: normalized name → committeeId
  const committeeIndex = new Map<string, string>();
  for (const c of committees) {
    committeeIndex.set(normalizeForMatch(c.name), c.committeeId);
    if (c.connectedOrgName) {
      committeeIndex.set(normalizeForMatch(c.connectedOrgName), c.committeeId);
    }
  }

  // Build contractor name index: normalized name → recipientName
  const contractorIndex = new Map<string, string>();
  for (const c of contractors) {
    contractorIndex.set(normalizeForMatch(c.recipientName), c.recipientName);
  }

  // Aggregate filings by client
  const byClient = new Map<string, {
    totalSpending: number;
    filingCount: number;
    issueCounts: Map<string, number>;
    billNumbers: Set<string>;
  }>();

  for (const filing of filings) {
    const key = filing.clientName;
    const entry = byClient.get(key) ?? {
      totalSpending: 0,
      filingCount: 0,
      issueCounts: new Map(),
      billNumbers: new Set(),
    };

    // Use income if available (reported by registrant), else expenses
    entry.totalSpending += filing.income > 0 ? filing.income : filing.expenses;
    entry.filingCount += 1;

    for (const activity of filing.lobbyingActivities) {
      if (activity.issueCode) {
        entry.issueCounts.set(
          activity.issueCode,
          (entry.issueCounts.get(activity.issueCode) ?? 0) + 1,
        );
      }
      for (const bill of activity.billNumbers) {
        entry.billNumbers.add(bill);
      }
    }

    byClient.set(key, entry);
  }

  // Build profiles
  const profiles: LobbyingClientProfile[] = [];
  for (const [clientName, data] of byClient) {
    const topIssues = [...data.issueCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code]) => code);

    // Crosswalk to FEC
    const normalizedClient = normalizeForMatch(clientName);
    const linkedFecCommittees: string[] = [];
    const fecMatch = committeeIndex.get(normalizedClient);
    if (fecMatch) linkedFecCommittees.push(fecMatch);

    // Crosswalk to USASpending contractors
    let linkedContractorName: string | undefined;
    const contractorMatch = contractorIndex.get(normalizedClient);
    if (contractorMatch) linkedContractorName = contractorMatch;
    // Also try substring for large companies
    if (!linkedContractorName && normalizedClient.length >= 5) {
      for (const [key, name] of contractorIndex) {
        if (key.includes(normalizedClient) || normalizedClient.includes(key)) {
          linkedContractorName = name;
          break;
        }
      }
    }

    profiles.push({
      clientName,
      totalSpending: data.totalSpending,
      filingCount: data.filingCount,
      topIssues,
      linkedFecCommittees,
      linkedBillNumbers: [...data.billNumbers].slice(0, 50),
      linkedContractorName,
    });
  }

  return profiles.sort((a, b) => b.totalSpending - a.totalSpending);
}

export function enrichContributionsWithCrosswalk(
  contributions: LobbyistContribution[],
  committees: FecCommittee[],
  members: CongressMember[],
): {
  payeeToCommittee: Map<string, string>;
  honoreeToMember: Map<string, string>;
} {
  // Build committee lookup
  const committeeIndex = new Map<string, string>();
  for (const c of committees) {
    committeeIndex.set(normalizeForMatch(c.name), c.committeeId);
  }

  // Build member lookup
  const memberIndex = new Map<string, string>();
  for (const m of members) {
    memberIndex.set(m.name.toUpperCase().trim(), m.name);
    if (m.directOrderName) {
      memberIndex.set(m.directOrderName.toUpperCase().trim(), m.name);
    }
    // Also index by last name + first initial for fuzzy matching
    if (m.lastName && m.firstName) {
      memberIndex.set(`${m.lastName.toUpperCase()} ${m.firstName[0].toUpperCase()}`, m.name);
    }
  }

  const payeeToCommittee = new Map<string, string>();
  const honoreeToMember = new Map<string, string>();

  const seenPayees = new Set<string>();
  const seenHonorees = new Set<string>();

  for (const c of contributions) {
    if (c.payeeName && !seenPayees.has(c.payeeName)) {
      seenPayees.add(c.payeeName);
      const match = matchPayeeToCommittee(c.payeeName, committeeIndex);
      if (match) payeeToCommittee.set(c.payeeName, match);
    }
    if (c.honoreeName && !seenHonorees.has(c.honoreeName)) {
      seenHonorees.add(c.honoreeName);
      const match = matchHonoreeToMember(c.honoreeName, memberIndex);
      if (match) honoreeToMember.set(c.honoreeName, match);
    }
  }

  return { payeeToCommittee, honoreeToMember };
}

export type LdaIngestResult = {
  filings: LobbyingFiling[];
  contributions: LobbyistContribution[];
  clients: LobbyingClientProfile[];
  warnings: string[];
  crosswalk: {
    payeeToCommitteeCount: number;
    honoreeToMemberCount: number;
    clientToFecCount: number;
    clientToContractorCount: number;
  };
};

export async function ingestLdaData({
  year = 2024,
  periods = ["Q1", "Q2", "Q3", "Q4"],
  committees = [],
  members = [],
  contractors = [],
}: {
  year?: number;
  periods?: string[];
  committees?: FecCommittee[];
  members?: CongressMember[];
  contractors?: ContractorProfile[];
} = {}): Promise<LdaIngestResult> {
  const [filingResult, contribResult] = await Promise.all([
    ingestLobbyingFilings({ year, periods }),
    ingestLobbyistContributions({ year }),
  ]);

  const warnings = [...filingResult.warnings, ...contribResult.warnings];
  const filings = filingResult.filings;
  const contributions = contribResult.contributions;

  const clients = buildLobbyingClientProfiles(filings, committees, contractors);

  const { payeeToCommittee, honoreeToMember } = enrichContributionsWithCrosswalk(
    contributions,
    committees,
    members,
  );

  const clientToFecCount = clients.filter((c) => c.linkedFecCommittees.length > 0).length;
  const clientToContractorCount = clients.filter((c) => c.linkedContractorName).length;

  console.log(`\nLDA ingest complete:`);
  console.log(`  Filings: ${filings.length}`);
  console.log(`  Contributions: ${contributions.length}`);
  console.log(`  Unique clients: ${clients.length}`);
  console.log(`  Crosswalk: ${payeeToCommittee.size} payee→FEC, ${honoreeToMember.size} honoree→member, ${clientToFecCount} client→FEC, ${clientToContractorCount} client→contractor`);

  return {
    filings,
    contributions,
    clients,
    warnings,
    crosswalk: {
      payeeToCommitteeCount: payeeToCommittee.size,
      honoreeToMemberCount: honoreeToMember.size,
      clientToFecCount,
      clientToContractorCount,
    },
  };
}
