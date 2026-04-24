import type {
  ContractorProfile,
  FecCommittee,
  GovernmentContract,
} from "@/lib/ingest/types";

const BASE_URL = "https://api.usaspending.gov/api/v2";

// Award type codes for contracts: A=BPA Call, B=Purchase Order, C=Delivery Order, D=Definitive Contract
const CONTRACT_AWARD_TYPE_CODES = ["A", "B", "C", "D"];

type SpendingByAwardRow = {
  internal_id: number;
  "Award ID": string;
  "Recipient Name": string;
  "Award Amount": number | null;
  "Start Date": string | null;
  "End Date": string | null;
  "Awarding Agency": string | null;
  "Awarding Sub Agency": string | null;
  "Contract Award Type": string | null;
  "NAICS Code": string | null;
  "NAICS Description": string | null;
  Description: string | null;
  "Place of Performance State Code": string | null;
  "Place of Performance City Name": string | null;
  generated_internal_id: string;
};

type SpendingByAwardResponse = {
  results: SpendingByAwardRow[];
  page_metadata: {
    page: number;
    hasNext: boolean;
  };
};

type RecipientRow = {
  id: string;
  duns: string | null;
  uei: string | null;
  name: string;
  recipient_level: string;
  amount: number;
};

type RecipientListResponse = {
  page_metadata: {
    page: number;
    hasNext: boolean;
    total: number;
  };
  results: RecipientRow[];
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`USASpending POST failed (${response.status}) for ${url}: ${text.slice(0, 200)}`);
  }
  return (await response.json()) as T;
}

function mapAwardRow(row: SpendingByAwardRow): GovernmentContract {
  return {
    awardId: row["Award ID"],
    recipientName: row["Recipient Name"] ?? "Unknown",
    awardAmount: row["Award Amount"] ?? 0,
    awardDate: row["Start Date"] ?? undefined,
    startDate: row["Start Date"] ?? undefined,
    endDate: row["End Date"] ?? undefined,
    awardingAgency: row["Awarding Agency"] ?? undefined,
    awardingSubAgency: row["Awarding Sub Agency"] ?? undefined,
    contractDescription: row.Description ?? undefined,
    naicsCode: row["NAICS Code"] ?? undefined,
    naicsDescription: row["NAICS Description"] ?? undefined,
    placeOfPerformanceState: row["Place of Performance State Code"] ?? undefined,
    placeOfPerformanceCity: row["Place of Performance City Name"] ?? undefined,
    contractType: row["Contract Award Type"] ?? undefined,
  };
}

export async function fetchTopContracts({
  startDate = "2024-01-01",
  endDate = "2025-12-31",
  limit = 500,
  maxPages = 5,
}: {
  startDate?: string;
  endDate?: string;
  limit?: number;
  maxPages?: number;
} = {}): Promise<{ contracts: GovernmentContract[]; warnings: string[] }> {
  const warnings: string[] = [];
  const contracts: GovernmentContract[] = [];
  const pageSize = Math.min(limit, 100);
  let page = 1;

  while (contracts.length < limit && page <= maxPages) {
    let data: SpendingByAwardResponse;
    try {
      data = await postJson<SpendingByAwardResponse>(
        `${BASE_URL}/search/spending_by_award/`,
        {
          filters: {
            award_type_codes: CONTRACT_AWARD_TYPE_CODES,
            time_period: [{ start_date: startDate, end_date: endDate }],
          },
          fields: [
            "Award ID",
            "Recipient Name",
            "Award Amount",
            "Start Date",
            "End Date",
            "Awarding Agency",
            "Awarding Sub Agency",
            "Contract Award Type",
            "NAICS Code",
            "NAICS Description",
            "Description",
            "Place of Performance State Code",
            "Place of Performance City Name",
          ],
          limit: pageSize,
          page,
          sort: "Award Amount",
          order: "desc",
          subawards: false,
        },
      );
    } catch (error) {
      warnings.push(
        `USASpending contract fetch failed on page ${page}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      break;
    }

    if (!data.results.length) break;
    contracts.push(...data.results.map(mapAwardRow));
    if (!data.page_metadata.hasNext) break;
    page++;
  }

  return { contracts: contracts.slice(0, limit), warnings };
}

export async function fetchTopContractors({
  limit = 100,
  maxPages = 3,
}: {
  limit?: number;
  maxPages?: number;
} = {}): Promise<{ recipients: RecipientRow[]; warnings: string[] }> {
  const warnings: string[] = [];
  const recipients: RecipientRow[] = [];
  const pageSize = Math.min(limit, 100);
  let page = 1;

  while (recipients.length < limit && page <= maxPages) {
    let data: RecipientListResponse;
    try {
      data = await postJson<RecipientListResponse>(`${BASE_URL}/recipient/`, {
        order: "desc",
        sort: "amount",
        limit: pageSize,
        page,
        award_type: "contracts",
      });
    } catch (error) {
      warnings.push(
        `USASpending recipient fetch failed on page ${page}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      break;
    }

    if (!data.results.length) break;
    // Keep only parent-level (P) or child (C) — skip R (recipient w/o hierarchy)
    recipients.push(...data.results.filter((r) => r.recipient_level === "P" || r.recipient_level === "C"));
    if (!data.page_metadata.hasNext) break;
    page++;
  }

  // De-duplicate by name, keeping the entry with the highest amount
  const byName = new Map<string, RecipientRow>();
  for (const row of recipients) {
    const key = normalizeCompanyName(row.name);
    const existing = byName.get(key);
    if (!existing || row.amount > existing.amount) {
      byName.set(key, row);
    }
  }

  return {
    recipients: [...byName.values()]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit),
    warnings,
  };
}

// --- Company-name crosswalk: USASpending recipients ↔ FEC committees ---

function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,\-'"()]/g, " ")
    .replace(/\b(CORP|CORPORATION|INC|INCORPORATED|LLC|LLP|CO|COMPANY|LTD|LIMITED|GROUP|HOLDINGS|ENTERPRISES|LP|NA|N A)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type ContractorFecLink = {
  recipientName: string;
  fecCommitteeId: string;
  fecCommitteeName: string;
  fecConnectedOrgName: string;
  matchType: "exact_org_name" | "normalized_org_name";
  confidence: number;
};

export function buildContractorFecCrosswalk(
  recipientNames: string[],
  committees: FecCommittee[],
): ContractorFecLink[] {
  // Build lookup from normalized connected org names → committee
  const orgIndex = new Map<string, FecCommittee>();
  for (const committee of committees) {
    if (!committee.connectedOrgName) continue;
    const normalized = normalizeCompanyName(committee.connectedOrgName);
    if (normalized) {
      // Keep committee with the longest original name (most specific)
      const existing = orgIndex.get(normalized);
      if (!existing || (committee.connectedOrgName.length > (existing.connectedOrgName?.length ?? 0))) {
        orgIndex.set(normalized, committee);
      }
    }
  }

  const links: ContractorFecLink[] = [];
  for (const recipientName of recipientNames) {
    const normalized = normalizeCompanyName(recipientName);
    if (!normalized) continue;

    const exactMatch = orgIndex.get(normalized);
    if (exactMatch) {
      links.push({
        recipientName,
        fecCommitteeId: exactMatch.committeeId,
        fecCommitteeName: exactMatch.name,
        fecConnectedOrgName: exactMatch.connectedOrgName ?? "",
        matchType: "normalized_org_name",
        confidence: 0.9,
      });
      continue;
    }

    // Try substring matching: if the normalized recipient name contains or is contained by an org name
    for (const [orgNorm, committee] of orgIndex.entries()) {
      if (
        (normalized.length >= 5 && orgNorm.includes(normalized)) ||
        (orgNorm.length >= 5 && normalized.includes(orgNorm))
      ) {
        links.push({
          recipientName,
          fecCommitteeId: committee.committeeId,
          fecCommitteeName: committee.name,
          fecConnectedOrgName: committee.connectedOrgName ?? "",
          matchType: "normalized_org_name",
          confidence: 0.75,
        });
        break;
      }
    }
  }

  return links;
}

export function buildContractorProfiles(
  contracts: GovernmentContract[],
  recipients: RecipientRow[],
  fecLinks: ContractorFecLink[],
): ContractorProfile[] {
  const fecByRecipient = new Map(fecLinks.map((l) => [normalizeCompanyName(l.recipientName), l]));

  // Build profiles from recipients list, enriched with contract details
  const contractsByRecipient = new Map<string, GovernmentContract[]>();
  for (const contract of contracts) {
    const key = normalizeCompanyName(contract.recipientName);
    const existing = contractsByRecipient.get(key) ?? [];
    existing.push(contract);
    contractsByRecipient.set(key, existing);
  }

  const profiles: ContractorProfile[] = [];

  for (const recipient of recipients) {
    const key = normalizeCompanyName(recipient.name);
    const recipientContracts = contractsByRecipient.get(key) ?? [];
    const fecLink = fecByRecipient.get(key);

    // Aggregate by agency
    const agencyTotals = new Map<string, number>();
    for (const c of recipientContracts) {
      if (!c.awardingAgency) continue;
      agencyTotals.set(c.awardingAgency, (agencyTotals.get(c.awardingAgency) ?? 0) + c.awardAmount);
    }
    const topAgencies = [...agencyTotals.entries()]
      .map(([agency, amount]) => ({ agency, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Aggregate by NAICS
    const naicsTotals = new Map<string, { description: string; amount: number }>();
    for (const c of recipientContracts) {
      if (!c.naicsCode) continue;
      const existing = naicsTotals.get(c.naicsCode) ?? { description: c.naicsDescription ?? "", amount: 0 };
      existing.amount += c.awardAmount;
      naicsTotals.set(c.naicsCode, existing);
    }
    const topNaics = [...naicsTotals.entries()]
      .map(([code, { description, amount }]) => ({ code, description, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    profiles.push({
      recipientName: recipient.name,
      recipientDuns: recipient.duns ?? undefined,
      totalObligatedAmount: recipient.amount,
      contractCount: recipientContracts.length,
      topAgencies,
      topNaics,
      fecCommitteeId: fecLink?.fecCommitteeId,
      fecCommitteeName: fecLink?.fecCommitteeName,
      fecConnectedOrgName: fecLink?.fecConnectedOrgName,
    });
  }

  return profiles.sort((a, b) => b.totalObligatedAmount - a.totalObligatedAmount);
}

export type UsaSpendingIngestResult = {
  contracts: GovernmentContract[];
  contractors: ContractorProfile[];
  fecLinks: ContractorFecLink[];
  warnings: string[];
};

export async function ingestUsaSpendingData({
  contractLimit = 500,
  contractorLimit = 100,
  committees = [],
}: {
  contractLimit?: number;
  contractorLimit?: number;
  committees?: FecCommittee[];
} = {}): Promise<UsaSpendingIngestResult> {
  const [contractResult, recipientResult] = await Promise.all([
    fetchTopContracts({ limit: contractLimit }),
    fetchTopContractors({ limit: contractorLimit }),
  ]);

  const warnings = [...contractResult.warnings, ...recipientResult.warnings];

  const fecLinks = buildContractorFecCrosswalk(
    recipientResult.recipients.map((r) => r.name),
    committees,
  );

  const contractors = buildContractorProfiles(
    contractResult.contracts,
    recipientResult.recipients,
    fecLinks,
  );

  if (!contractResult.contracts.length) {
    warnings.push("No contracts returned from USASpending API.");
  }
  if (!recipientResult.recipients.length) {
    warnings.push("No recipients returned from USASpending API.");
  }
  if (fecLinks.length > 0) {
    warnings.push(`Linked ${fecLinks.length} contractors to FEC committees.`);
  }

  return {
    contracts: contractResult.contracts,
    contractors,
    fecLinks,
    warnings,
  };
}
