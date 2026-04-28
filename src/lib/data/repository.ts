import { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/lib/db/client";

/** Log a warning when a Prisma query fails and we fall back to JSON. */
function warnFallback(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[repository] ${context}: Prisma query failed, falling back to JSON. ${message}`);
}
import {
  buildCandidateMemberCrosswalk,
  mapCrosswalkByBioguide,
  mapCrosswalkByCandidate,
} from "@/lib/data/crosswalk";
import {
  readLatestArtifacts,
  readLatestSummary,
  readFecCandidates,
  readFecCommittees,
  readFecContributions,
  readFaraForeignPrincipals,
  readCongressBills,
  readCongressMembers,
  readHouseVotes,
  readHouseVoteMemberVotes,
  readOutcomeStates,
  readSenateVotes,
  readSenateVoteMemberVotes,
  readCandidateFinancials,
  readFundingReadModels,
  readPacSummaries,
  readContracts,
  readTopContractors,
  readVoteFundingSummaries,
} from "@/lib/ingest/storage";
import type {
  DonorSummary,
  FundingProfileSummary,
  LaunchVoteFundingAnalysis,
} from "@/lib/launch-summary";
import type { OutcomeRow } from "@/lib/state-outcomes";
import type {
  CandidateMemberCrosswalk,
  CongressBill,
  CongressMember,
  ContractorProfile,
  FecCandidate,
  GovernmentContract,
  HouseRollCallMemberVote,
  HouseRollCallVote,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";

export type SenatorEntity = {
  id: string;
  candidateId: string;
  name: string;
  party?: string;
  state: string;
  office: string;
  principalCommittees: string[];
};

export type BillEntity = {
  id: string;
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  status: string;
  sponsor: string;
  sponsorParty?: string;
  sponsorState?: string;
  summary: string;
  latestActionDate?: string;
};

export type OrganizationEntity = {
  id: string;
  committeeId: string;
  name: string;
  issue: string;
  cycleTotal: number;
  donorCount: number;
  contributionCount: number;
  linkedOfficials: number;
  note: string;
};

export type CountryInfluenceEntity = {
  id: string;
  name: string;
  principalCount: number;
  registrantCount: number;
  topPrincipals: string[];
  caution: string;
};

export type InfluenceNetworkSnapshot = {
  nodes: string[];
  edges: { from: string; to: string; type: string }[];
};

export async function getDataBackendMode(): Promise<"database" | "json"> {
  const prisma = getPrismaClient();
  if (!prisma) return "json";
  try {
    await prisma.$queryRaw`SELECT 1`;
    return "database";
  } catch {
    return "json";
  }
}

export async function getLatestRunSummaryRepository() {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const runs = await prisma.ingestRun.findMany({
        orderBy: { finishedAt: "desc" },
        take: 10,
      });
      const latest = runs.find(isUsableIngestRun);
      // Only use DB record if it has real totals — placeholder runs have empty {}
      if (latest && getRunContributionTotal(latest.totals) > 0) return latest;
    } catch (error) {
      warnFallback("getLatestRunSummaryRepository", error);
      // Fall through to JSON snapshots.
    }
  }
  return readLatestSummary();
}

export async function getLatestStateOutcomesRepository(): Promise<OutcomeRow[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const latestYear = await prisma.stateOutcome.findFirst({
        orderBy: { year: "desc" },
        select: { year: true },
      });
      if (latestYear) {
        return prisma.stateOutcome.findMany({
          where: { year: latestYear.year },
          orderBy: { stateCode: "asc" },
        });
      }
    } catch (error) {
      warnFallback("getLatestStateOutcomesRepository", error);
      // Fall through to JSON snapshots.
    }
  }

  const rows = await readOutcomeStates();
  // JSON snapshot may contain multi-year duplicates; keep latest per state.
  const byState = new Map<string, OutcomeRow>();
  for (const row of rows) {
    if (row.stateCode) byState.set(row.stateCode, row);
  }
  return Array.from(byState.values());
}

function mapCandidateToSenator(candidate: FecCandidate): SenatorEntity {
  return {
    id: candidate.candidateId.toLowerCase(),
    candidateId: candidate.candidateId,
    name: candidate.name,
    party: candidate.party,
    state: candidate.officeState ?? "US",
    office: candidate.office,
    principalCommittees: candidate.principalCommittees,
  };
}

function mapBillToEntity(bill: CongressBill): BillEntity {
  const id = `${bill.congress}-${bill.billType}-${bill.billNumber}`.toLowerCase();
  return {
    id,
    congress: bill.congress,
    billType: bill.billType,
    billNumber: bill.billNumber,
    title: bill.title,
    status: bill.latestActionText ?? "No recent action text",
    sponsor: bill.sponsor ?? "",
    sponsorParty: bill.sponsorParty,
    sponsorState: bill.sponsorState,
    summary: bill.policyArea ?? bill.latestActionText ?? "",
    latestActionDate: bill.latestActionDate,
  };
}

async function getLatestCandidateRepository(): Promise<FecCandidate[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.candidate.findMany({
        orderBy: { name: "asc" },
      });
      if (rows.length) {
        return rows.map((row) => ({
          candidateId: row.candidateId,
          name: row.name,
          office: row.office,
          officeState: row.officeState ?? undefined,
          officeDistrict: row.officeDistrict ?? undefined,
          party: row.party ?? undefined,
          incumbentChallenge: row.incumbentChallenge ?? undefined,
          candidateStatus: row.candidateStatus ?? undefined,
          electionYear: row.electionYear ?? undefined,
          principalCommittees: normalizeCommitteeJson(row.principalCommittees),
        }));
      }
    } catch (error) {
      warnFallback("getLatestCandidateRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  return readFecCandidates();
}

export async function getLatestSenatorEntitiesRepository(): Promise<SenatorEntity[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const dbRows = await prisma.candidate.findMany({
        where: { office: "S" },
        orderBy: { name: "asc" },
      });
      if (dbRows.length) {
        return dbRows.map((row) => ({
          id: row.candidateId.toLowerCase(),
          candidateId: row.candidateId,
          name: row.name,
          party: row.party ?? undefined,
          state: row.officeState ?? "US",
          office: row.office,
          principalCommittees: Array.isArray(row.principalCommittees)
            ? row.principalCommittees.filter(
                (value): value is string => typeof value === "string",
              )
            : [],
        }));
      }
    } catch (error) {
      warnFallback("getLatestSenatorEntitiesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const all = (await readFecCandidates())
    .filter((candidate) => candidate.office === "S")
    .map(mapCandidateToSenator);

  // Deduplicate: keep highest electionYear per name+state
  const deduped = new Map<string, SenatorEntity>();
  for (const s of all) {
    // Use last name + state as dedup key (handles "HOVDE, ERIC" vs "HOVDE, ERIC D")
    const lastName = s.name.split(",")[0]?.trim().toLowerCase().replace(/[^a-z]/g, "") ?? "";
    const key = `${lastName}|${s.state}`;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, s);
    }
    // Keep the one with more principal committees (more likely the active candidate)
    else if (s.principalCommittees.length > existing.principalCommittees.length) {
      deduped.set(key, s);
    }
  }

  return [...deduped.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export async function getLatestBillEntitiesRepository(): Promise<BillEntity[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const dbRows = await prisma.bill.findMany({
        orderBy: [{ latestActionDate: "desc" }, { congress: "desc" }],
      });
      if (dbRows.length) {
        return dbRows.map((row) => ({
          id: row.billId.toLowerCase(),
          congress: row.congress,
          billType: row.billType,
          billNumber: row.billNumber,
          title: row.title,
          status: row.latestActionText ?? "No recent action text",
          sponsor: row.sponsor ?? "Unknown sponsor",
          sponsorParty: row.sponsorParty ?? undefined,
          sponsorState: row.sponsorState ?? undefined,
          summary:
            row.latestActionText ?? "No summary text available from current feed.",
          latestActionDate: row.latestActionDate ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getLatestBillEntitiesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  return (await readCongressBills())
    .map(mapBillToEntity)
    .sort((left, right) =>
      (right.latestActionDate ?? "").localeCompare(left.latestActionDate ?? ""),
    );
}

function formatIssueLabel(input: {
  committeeType?: string | null;
  party?: string | null;
}): string {
  if (input.committeeType) return input.committeeType;
  if (input.party) return `${input.party} aligned`;
  return "General";
}

function slugFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// ---------------------------------------------------------------------------
// Prisma-backed contribution aggregation queries
// ---------------------------------------------------------------------------

async function getLatestRunId(): Promise<string | null> {
  const prisma = getPrismaClient();
  if (!prisma) return null;
  try {
    const runs = await prisma.ingestRun.findMany({
      orderBy: { finishedAt: "desc" },
      take: 10,
    });
    const run = runs.find(isUsableIngestRun) ?? runs[0];
    return run?.runId ?? null;
  } catch (error) {
    warnFallback("getLatestRunId", error);
    return null;
  }
}

function getRunContributionTotal(
  totals: Prisma.JsonValue | null | undefined,
): number {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return 0;
  const value = (totals as Record<string, unknown>).contributions;
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isUsableIngestRun(run: {
  startedAt: Date;
  finishedAt: Date;
  totals: Prisma.JsonValue | null;
}): boolean {
  return (
    run.finishedAt.getTime() > run.startedAt.getTime() &&
    getRunContributionTotal(run.totals) > 0
  );
}

export type ContributionAggregate = {
  total: number;
  donors: number;
  rows: number;
};

export async function getContributionAggregatesByCommittees(
  committeeIds: string[],
): Promise<ContributionAggregate | null> {
  const prisma = getPrismaClient();
  if (!prisma || committeeIds.length === 0) return null;
  try {
    const runId = await getLatestRunId();
    if (!runId) return null;
    const result = await prisma.$queryRaw<
      { total: number; donors: number; rows: bigint }[]
    >(Prisma.sql`
      SELECT
        COALESCE(SUM((payload->>'amount')::numeric), 0) as total,
        COUNT(DISTINCT payload->>'donorName') as donors,
        COUNT(*) as rows
      FROM "RawFecContribution"
      WHERE "runId" = ${runId}
        AND payload->>'committeeId' = ANY(${committeeIds})
    `);
    if (!result[0]) return null;
    return {
      total: Number(result[0].total),
      donors: Number(result[0].donors),
      rows: Number(result[0].rows),
    };
  } catch (error) {
    warnFallback("getContributionAggregatesByCommittees", error);
    return null;
  }
}

export type TopDonorRow = { donor: string; total: number };

export async function getTopDonorsByCommittee(
  committeeId: string,
  limit: number,
): Promise<TopDonorRow[]> {
  const prisma = getPrismaClient();
  if (!prisma) return [];
  try {
    const runId = await getLatestRunId();
    if (!runId) return [];
    return await prisma.$queryRaw<TopDonorRow[]>(Prisma.sql`
      SELECT
        payload->>'donorName' as donor,
        SUM((payload->>'amount')::numeric) as total
      FROM "RawFecContribution"
      WHERE "runId" = ${runId}
        AND payload->>'committeeId' = ${committeeId}
      GROUP BY payload->>'donorName'
      ORDER BY total DESC
      LIMIT ${limit}
    `);
  } catch (error) {
    warnFallback("getTopDonorsByCommittee", error);
    return [];
  }
}

export async function getLatestOrganizationEntitiesRepository(): Promise<
  OrganizationEntity[]
> {
  // Try Prisma-backed aggregation first
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const runId = await getLatestRunId();
      if (runId) {
        const aggregates = await prisma.$queryRaw<
          { cid: string; total: number; donors: bigint; rows: bigint }[]
        >(Prisma.sql`
          SELECT
            payload->>'committeeId' as cid,
            SUM((payload->>'amount')::numeric) as total,
            COUNT(DISTINCT payload->>'donorName') as donors,
            COUNT(*) as rows
          FROM "RawFecContribution"
          WHERE "runId" = ${runId}
          GROUP BY payload->>'committeeId'
          ORDER BY total DESC
          LIMIT 200
        `);

        if (aggregates.length > 0) {
          // Fetch committee metadata for these IDs
          const committeeIds = aggregates.map((a) => a.cid);
          const committees = await prisma.committee.findMany({
            where: { committeeId: { in: committeeIds } },
          });
          const committeeById = new Map(
            committees.map((c) => [c.committeeId, c]),
          );

          // Fetch linked officials
          const candidates = await prisma.candidate.findMany({
            select: { candidateId: true, principalCommittees: true },
          });
          const linkedOfficialsByCommittee = new Map<string, Set<string>>();
          for (const candidate of candidates) {
            const pcs = Array.isArray(candidate.principalCommittees)
              ? candidate.principalCommittees
              : [];
            for (const cid of pcs) {
              if (typeof cid !== "string") continue;
              const linked = linkedOfficialsByCommittee.get(cid) ?? new Set<string>();
              linked.add(candidate.candidateId);
              linkedOfficialsByCommittee.set(cid, linked);
            }
          }

          return aggregates.map((agg) => {
            const committee = committeeById.get(agg.cid);
            const name = committee?.name ?? agg.cid;
            const donorCount = Number(agg.donors);
            const rowCount = Number(agg.rows);
            return {
              id: slugFromText(`${agg.cid}-${name}`),
              committeeId: agg.cid,
              name,
              issue: formatIssueLabel({
                committeeType: committee?.committeeType,
                party: committee?.party,
              }),
              cycleTotal: Number(agg.total),
              donorCount,
              contributionCount: rowCount,
              linkedOfficials: linkedOfficialsByCommittee.get(agg.cid)?.size ?? 0,
              note: `${rowCount.toLocaleString()} contribution rows and ${donorCount.toLocaleString()} unique donors.`,
            } satisfies OrganizationEntity;
          });
        }
      }
    } catch (error) {
      warnFallback("getLatestOrganizationEntitiesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  // JSON fallback — use PAC summaries for financial data
  const [pacSummaries, committees, candidates, contributions] = await Promise.all([
    readPacSummaries(),
    readFecCommittees(),
    readFecCandidates(),
    readFecContributions(),
  ]);
  if (!pacSummaries.length && !committees.length && !candidates.length) return [];

  const committeeById = new Map(
    committees.map((committee) => [committee.committeeId, committee]),
  );
  const linkedOfficialsByCommittee = new Map<string, Set<string>>();

  for (const candidate of candidates) {
    for (const committeeId of candidate.principalCommittees) {
      const linked = linkedOfficialsByCommittee.get(committeeId) ?? new Set<string>();
      linked.add(candidate.candidateId);
      linkedOfficialsByCommittee.set(committeeId, linked);
    }
  }

  // Use PAC summaries (pre-computed by FEC) when available
  if (pacSummaries.length > 0) {
    return pacSummaries
      .filter((pac) => (pac.totalReceipts ?? 0) > 0 || (pac.totalDisbursements ?? 0) > 0)
      .sort((a, b) => (b.totalDisbursements ?? 0) - (a.totalDisbursements ?? 0))
      .map((pac) => {
        const committee = committeeById.get(pac.committeeId);
        const name = pac.name || committee?.name || pac.committeeId;
        return {
          id: slugFromText(`${pac.committeeId}-${name}`),
          committeeId: pac.committeeId,
          name,
          issue: formatIssueLabel({
            committeeType: pac.committeeType ?? committee?.committeeType,
            party: pac.party ?? committee?.party,
          }),
          cycleTotal: pac.totalDisbursements ?? 0,
          donorCount: 0,
          contributionCount: 0,
          linkedOfficials: linkedOfficialsByCommittee.get(pac.committeeId)?.size ?? 0,
          note: `$${((pac.totalReceipts ?? 0) / 1_000_000).toFixed(1)}M receipts, $${((pac.totalDisbursements ?? 0) / 1_000_000).toFixed(1)}M disbursed.`,
        } satisfies OrganizationEntity;
      });
  }

  // Legacy fallback: aggregate from contribution sample
  const aggregateByCommittee = new Map<string, { amount: number; donors: Set<string>; rows: number }>();
  for (const contribution of contributions) {
    const existing = aggregateByCommittee.get(contribution.committeeId) ?? { amount: 0, donors: new Set<string>(), rows: 0 };
    existing.amount += contribution.amount;
    existing.rows += 1;
    existing.donors.add(contribution.donorName);
    aggregateByCommittee.set(contribution.committeeId, existing);
  }

  return [...aggregateByCommittee.entries()]
    .map(([committeeId, aggregate]) => {
      const committee = committeeById.get(committeeId);
      const name = committee?.name ?? committeeId;
      return {
        id: slugFromText(`${committeeId}-${name}`),
        committeeId,
        name,
        issue: formatIssueLabel({ committeeType: committee?.committeeType, party: committee?.party }),
        cycleTotal: aggregate.amount,
        donorCount: aggregate.donors.size,
        contributionCount: aggregate.rows,
        linkedOfficials: linkedOfficialsByCommittee.get(committeeId)?.size ?? 0,
        note: `${aggregate.rows} contribution rows (sample).`,
      } satisfies OrganizationEntity;
    })
    .sort((left, right) => right.cycleTotal - left.cycleTotal)
    .slice(0, 200);
}

export async function getLatestCountryInfluenceEntitiesRepository(): Promise<
  CountryInfluenceEntity[]
> {
  const countryMap = new Map<
    string,
    {
      principalCount: number;
      registrants: Set<string>;
      principals: Set<string>;
    }
  >();

  for (const row of await readFaraForeignPrincipals()) {
    const country = row.country?.trim();
    if (!country) continue;
    const existing = countryMap.get(country) ?? {
      principalCount: 0,
      registrants: new Set<string>(),
      principals: new Set<string>(),
    };
    existing.principalCount += 1;
    existing.registrants.add(row.registrationNumber);
    existing.principals.add(row.principalName);
    countryMap.set(country, existing);
  }

  return [...countryMap.entries()]
    .map(([name, aggregate]) => ({
      id: slugFromText(name),
      name,
      principalCount: aggregate.principalCount,
      registrantCount: aggregate.registrants.size,
      topPrincipals: [...aggregate.principals].slice(0, 5),
      caution:
        "Counts represent sampled registered activity and do not, by themselves, establish illegal campaign conduct.",
    }))
    .sort((left, right) => right.principalCount - left.principalCount);
}

export async function getInfluenceNetworkSnapshotRepository(): Promise<InfluenceNetworkSnapshot> {
  const [organizations, countries, senators, bills] = await Promise.all([
    getLatestOrganizationEntitiesRepository(),
    getLatestCountryInfluenceEntitiesRepository(),
    getLatestSenatorEntitiesRepository(),
    getLatestBillEntitiesRepository(),
  ]);

  const topCountry = countries[0];
  const topOrg = organizations[0];
  const topSenator = senators[0];
  const topBill = bills[0];

  const nodes = [
    topCountry?.name ?? "Country sample unavailable",
    topOrg?.name ?? "Committee sample unavailable",
    topSenator?.name ?? "Senator sample unavailable",
    topBill ? `${topBill.billType.toUpperCase()} ${topBill.billNumber}` : "Bill sample unavailable",
  ];

  const edges = [
    {
      from: topCountry?.name ?? nodes[0],
      to: topOrg?.name ?? nodes[1],
      type: "appears near in sampled influence channels",
    },
    {
      from: topOrg?.name ?? nodes[1],
      to: topSenator?.name ?? nodes[2],
      type: "committee-donor channel",
    },
    {
      from: topSenator?.name ?? nodes[2],
      to: topBill ? `${topBill.billType.toUpperCase()} ${topBill.billNumber}` : nodes[3],
      type: "state/sponsorship proximity",
    },
  ];

  return { nodes, edges };
}

export type SearchEntityType = "member" | "candidate" | "committee" | "bill" | "donor";

export type SearchEntityResult = {
  type: SearchEntityType;
  id: string;
  label: string;
  subtitle?: string;
  href?: string;
};

export type FundingProfileResult = {
  entityType: "member" | "candidate" | "committee";
  entityId: string;
  label: string;
  linkedBioguideId?: string;
  linkedCandidateId?: string;
  committeeIds: string[];
  totalReceipts: number;
  totalIndividualContributions?: number;
  otherCommitteeContributions?: number;
  partyContributions?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  independentExpenditures?: number;
  uniqueDonors: number;
  contributionRows: number;
  topDonors: TopDonorRow[];
};

export type DonorProfileResult = DonorSummary;

export type RankedEntityResult = {
  rank: number;
  type: "member" | "candidate" | "committee";
  id: string;
  label: string;
  totalReceipts: number;
  committeeIds: string[];
};

export type VoteFundingGroupSummary = {
  voteCast: string;
  memberCount: number;
  matchedCandidateCount: number;
  totalReceipts: number;
  totalIndividualContributions?: number;
  otherCommitteeContributions?: number;
  partyContributions?: number;
  independentExpenditures?: number;
  averageReceipts: number;
  topMembers: Array<{
    bioguideId: string;
    candidateId?: string;
    name: string;
    totalReceipts: number;
  }>;
};

export type VoteFundingAnalysisResult = {
  voteId: string;
  billId?: string;
  question?: string;
  result?: string;
  groups: VoteFundingGroupSummary[];
};

export type MemberVotePositionResult = {
  voteId: string;
  chamber: "H" | "S";
  voteCast: string;
  billId?: string;
  question?: string;
  result?: string;
  happenedAt?: string;
};

export type CommitteeRecipientSummary = {
  candidateId: string;
  bioguideId?: string;
  label: string;
  totalSupport: number;
  href?: string;
};

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function donorTypeLabel(donorType: "person" | "organization" | "unknown"): string {
  if (donorType === "person") return "Person donor";
  if (donorType === "organization") return "Organization donor";
  return "Unclassified donor";
}

function normalizeCommitteeJson(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
}

export async function getLatestCongressMembersRepository(): Promise<CongressMember[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.congressMember.findMany({
        orderBy: [{ state: "asc" }, { chamber: "asc" }, { name: "asc" }],
      });
      if (rows.length) {
        return rows.map((row) => ({
          bioguideId: row.bioguideId,
          name: row.name,
          party: row.party ?? undefined,
          partyCode: row.partyCode ?? undefined,
          state: row.state,
          stateName: row.stateName ?? undefined,
          district: row.district ?? undefined,
          chamber: row.chamber as "S" | "H",
          termStartYear: row.termStartYear ?? undefined,
          updateDate: row.updateDate ?? undefined,
          currentMember: row.currentMember ?? undefined,
          officialUrl: row.officialUrl ?? undefined,
          directOrderName: row.directOrderName ?? undefined,
          firstName: row.firstName ?? undefined,
          lastName: row.lastName ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getLatestCongressMembersRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  return readCongressMembers();
}

function sortHouseVotesDesc(rows: HouseRollCallVote[]): HouseRollCallVote[] {
  return [...rows].sort(
    (left, right) =>
      right.congress - left.congress ||
      right.session - left.session ||
      right.rollCallNumber - left.rollCallNumber,
  );
}

function sortSenateVotesDesc(rows: SenateRollCallVote[]): SenateRollCallVote[] {
  return [...rows].sort(
    (left, right) =>
      right.congress - left.congress ||
      right.session - left.session ||
      right.rollCallNumber - left.rollCallNumber,
  );
}

export async function getCandidateMemberCrosswalkRepository(): Promise<
  CandidateMemberCrosswalk[]
> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.candidateMemberCrosswalk.findMany({
        orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
      });
      if (rows.length) {
        return rows.map((row) => ({
          candidateId: row.candidateId,
          bioguideId: row.bioguideId,
          matchType: row.matchType,
          confidence: row.confidence,
          notes: row.notes ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getCandidateMemberCrosswalkRepository", error);
      // Fall through to derived JSON crosswalk.
    }
  }

  return buildCandidateMemberCrosswalk(
    await readFecCandidates(),
    await readCongressMembers(),
    await readFecCommittees(),
  );
}

export async function getLatestHouseVotesRepository(
  limit?: number,
): Promise<HouseRollCallVote[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.houseVote.findMany({
        orderBy: [{ congress: "desc" }, { session: "desc" }, { rollCallNumber: "desc" }],
        ...(limit ? { take: limit } : {}),
      });
      if (rows.length) {
        return rows.map((row) => ({
          voteId: row.voteId,
          identifier: row.identifier ?? undefined,
          congress: row.congress,
          session: row.session,
          rollCallNumber: row.rollCallNumber,
          startDate: row.startDate ?? undefined,
          updateDate: row.updateDate ?? undefined,
          voteType: row.voteType ?? undefined,
          result: row.result ?? undefined,
          legislationType: row.legislationType ?? undefined,
          legislationNumber: row.legislationNumber ?? undefined,
          voteQuestion: row.voteQuestion ?? undefined,
          amendmentType: row.amendmentType ?? undefined,
          amendmentNumber: row.amendmentNumber ?? undefined,
          amendmentAuthor: row.amendmentAuthor ?? undefined,
          legislationUrl: row.legislationUrl ?? undefined,
          billId: row.billId ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getLatestHouseVotesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const rows = await readHouseVotes();
  const sorted = sortHouseVotesDesc(rows);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export async function getHouseVoteMemberVotesRepository(
  voteId?: string,
): Promise<HouseRollCallMemberVote[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.houseVoteMemberVote.findMany({
        where: voteId ? { voteId } : undefined,
      });
      if (rows.length) {
        return rows.map((row) => ({
          voteId: row.voteId,
          bioguideId: row.bioguideId,
          voteCast: row.voteCast,
          voteParty: row.voteParty ?? undefined,
          voteState: row.voteState ?? undefined,
          firstName: row.firstName ?? undefined,
          lastName: row.lastName ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getHouseVoteMemberVotesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const rows = await readHouseVoteMemberVotes();
  return voteId ? rows.filter((row) => row.voteId === voteId) : rows;
}

export async function getLatestSenateVotesRepository(
  limit?: number,
): Promise<SenateRollCallVote[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.senateVote.findMany({
        orderBy: [{ congress: "desc" }, { session: "desc" }, { rollCallNumber: "desc" }],
        ...(limit ? { take: limit } : {}),
      });
      if (rows.length) {
        return rows.map((row) => ({
          voteId: row.voteId,
          congress: row.congress,
          session: row.session,
          rollCallNumber: row.rollCallNumber,
          voteDate: row.voteDate ?? undefined,
          modifyDate: row.modifyDate ?? undefined,
          issue: row.issue ?? undefined,
          question: row.question ?? undefined,
          voteQuestionText: row.voteQuestionText ?? undefined,
          voteDocumentText: row.voteDocumentText ?? undefined,
          voteTitle: row.voteTitle ?? undefined,
          majorityRequirement: row.majorityRequirement ?? undefined,
          result: row.result ?? undefined,
          resultText: row.resultText ?? undefined,
          billId: row.billId ?? undefined,
          documentType: row.documentType ?? undefined,
          documentNumber: row.documentNumber ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getLatestSenateVotesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const rows = await readSenateVotes();
  const sorted = sortSenateVotesDesc(rows);
  return typeof limit === "number" ? sorted.slice(0, limit) : sorted;
}

export async function getHouseVoteCountRepository(): Promise<number> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const count = await prisma.houseVote.count();
      if (count > 0) return count;
    } catch (error) {
      warnFallback("getHouseVoteCountRepository", error);
      // Fall through to JSON snapshots.
    }
  }

  const rows = await readHouseVotes();
  return rows.length;
}

export async function getSenateVoteCountRepository(): Promise<number> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const count = await prisma.senateVote.count();
      if (count > 0) return count;
    } catch (error) {
      warnFallback("getSenateVoteCountRepository", error);
      // Fall through to JSON snapshots.
    }
  }

  const rows = await readSenateVotes();
  return rows.length;
}

export async function getSenateVoteMemberVotesRepository(
  voteId?: string,
): Promise<SenateRollCallMemberVote[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const rows = await prisma.senateVoteMemberVote.findMany({
        where: voteId ? { voteId } : undefined,
      });
      if (rows.length) {
        return rows.map((row) => ({
          voteId: row.voteId,
          bioguideId: row.bioguideId,
          lisMemberId: row.lisMemberId ?? undefined,
          voteCast: row.voteCast,
          voteParty: row.voteParty ?? undefined,
          voteState: row.voteState ?? undefined,
          firstName: row.firstName ?? undefined,
          lastName: row.lastName ?? undefined,
          memberFull: row.memberFull ?? undefined,
        }));
      }
    } catch (error) {
      warnFallback("getSenateVoteMemberVotesRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const rows = await readSenateVoteMemberVotes();
  return voteId ? rows.filter((row) => row.voteId === voteId) : rows;
}

export async function getRecentMemberVotePositionsRepository({
  bioguideId,
  chamber,
  limit = 8,
}: {
  bioguideId: string;
  chamber: "H" | "S";
  limit?: number;
}): Promise<MemberVotePositionResult[]> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      if (chamber === "H") {
        const rows = await prisma.$queryRaw<
          Array<{
            vote_id: string;
            vote_cast: string;
            bill_id: string | null;
            question: string | null;
            result: string | null;
            happened_at: string | null;
          }>
        >(Prisma.sql`
          SELECT
            mv."voteId" as vote_id,
            mv."voteCast" as vote_cast,
            v."billId" as bill_id,
            v."voteQuestion" as question,
            v."result" as result,
            COALESCE(v."startDate", v."updateDate") as happened_at
          FROM "HouseVoteMemberVote" mv
          JOIN "HouseVote" v ON v."voteId" = mv."voteId"
          WHERE mv."bioguideId" = ${bioguideId}
          ORDER BY v."congress" DESC, v."session" DESC, v."rollCallNumber" DESC
          LIMIT ${limit}
        `);
        return rows.map((row) => ({
          voteId: row.vote_id,
          chamber: "H",
          voteCast: row.vote_cast,
          billId: row.bill_id ?? undefined,
          question: row.question ?? undefined,
          result: row.result ?? undefined,
          happenedAt: row.happened_at ?? undefined,
        }));
      }

      const rows = await prisma.$queryRaw<
        Array<{
          vote_id: string;
          vote_cast: string;
          bill_id: string | null;
          question: string | null;
          result: string | null;
          happened_at: string | null;
        }>
      >(Prisma.sql`
        SELECT
          mv."voteId" as vote_id,
          mv."voteCast" as vote_cast,
          v."billId" as bill_id,
          v."question" as question,
          v."result" as result,
          COALESCE(v."voteDate", v."modifyDate") as happened_at
        FROM "SenateVoteMemberVote" mv
        JOIN "SenateVote" v ON v."voteId" = mv."voteId"
        WHERE mv."bioguideId" = ${bioguideId}
        ORDER BY v."congress" DESC, v."session" DESC, v."rollCallNumber" DESC
        LIMIT ${limit}
      `);
      return rows.map((row) => ({
        voteId: row.vote_id,
        chamber: "S",
        voteCast: row.vote_cast,
        billId: row.bill_id ?? undefined,
        question: row.question ?? undefined,
        result: row.result ?? undefined,
        happenedAt: row.happened_at ?? undefined,
      }));
    } catch (error) {
      warnFallback("getRecentMemberVotePositionsRepository", error);
      // Fall through to JSON artifacts.
    }
  }

  const artifacts = await readLatestArtifacts();
  if (!artifacts) return [];

  if (chamber === "H") {
    const voteMap = new Map(
      (artifacts.congress.houseVotes ?? []).map((vote) => [vote.voteId, vote]),
    );
    return (artifacts.congress.houseVoteMemberVotes ?? [])
      .filter((row) => row.bioguideId === bioguideId)
      .map((row) => {
        const vote = voteMap.get(row.voteId);
        return {
          voteId: row.voteId,
          chamber: "H" as const,
          voteCast: row.voteCast,
          billId: vote?.billId,
          question: vote?.voteQuestion,
          result: vote?.result,
          happenedAt: vote?.startDate ?? vote?.updateDate,
          roll: vote?.rollCallNumber ?? 0,
          congress: vote?.congress ?? 0,
          session: vote?.session ?? 0,
        };
      })
      .sort((left, right) => {
        if (left.congress !== right.congress) return right.congress - left.congress;
        if (left.session !== right.session) return right.session - left.session;
        return right.roll - left.roll;
      })
      .slice(0, limit)
      .map((row) => ({
        voteId: row.voteId,
        chamber: row.chamber,
        voteCast: row.voteCast,
        billId: row.billId,
        question: row.question,
        result: row.result,
        happenedAt: row.happenedAt,
      }));
  }

  const voteMap = new Map(
    (artifacts.congress.senateVotes ?? []).map((vote) => [vote.voteId, vote]),
  );
  return (artifacts.congress.senateVoteMemberVotes ?? [])
    .filter((row) => row.bioguideId === bioguideId)
    .map((row) => {
      const vote = voteMap.get(row.voteId);
      return {
        voteId: row.voteId,
        chamber: "S" as const,
        voteCast: row.voteCast,
        billId: vote?.billId,
        question: vote?.question,
        result: vote?.result,
        happenedAt: vote?.voteDate ?? vote?.modifyDate,
        roll: vote?.rollCallNumber ?? 0,
        congress: vote?.congress ?? 0,
        session: vote?.session ?? 0,
      };
    })
    .sort((left, right) => {
      if (left.congress !== right.congress) return right.congress - left.congress;
      if (left.session !== right.session) return right.session - left.session;
      return right.roll - left.roll;
    })
    .slice(0, limit)
    .map((row) => ({
      voteId: row.voteId,
      chamber: row.chamber,
      voteCast: row.voteCast,
      billId: row.billId,
      question: row.question,
      result: row.result,
      happenedAt: row.happenedAt,
    }));
}

export async function getCommitteeRecipientsRepository(
  committeeId: string,
  limit = 10,
): Promise<CommitteeRecipientSummary[]> {
  const prisma = getPrismaClient();
  let aggregateRows: Array<{ candidate_id: string; total: number }> = [];

  if (prisma) {
    try {
      const runId = await getLatestRunId();
      if (runId) {
        aggregateRows = await prisma.$queryRaw<
          Array<{ candidate_id: string; total: number }>
        >(Prisma.sql`
          SELECT
            payload->>'candidateId' as candidate_id,
            SUM((payload->>'amount')::numeric) as total
          FROM "RawFecContribution"
          WHERE "runId" = ${runId}
            AND payload->>'committeeId' = ${committeeId}
            AND COALESCE(payload->>'candidateId', '') <> ''
          GROUP BY payload->>'candidateId'
          ORDER BY total DESC
          LIMIT ${limit}
        `);
      }
    } catch (error) {
      warnFallback("getCommitteeRecipientsRepository", error);
      aggregateRows = [];
    }
  }

  if (!aggregateRows.length) {
    const artifacts = await readLatestArtifacts();
    const totals = new Map<string, number>();
    for (const row of artifacts?.fec.contributions ?? []) {
      if (row.committeeId !== committeeId || !row.candidateId) continue;
      totals.set(row.candidateId, (totals.get(row.candidateId) ?? 0) + row.amount);
    }
    aggregateRows = [...totals.entries()]
      .map(([candidate_id, total]) => ({ candidate_id, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, limit);
  }

  if (!aggregateRows.length) return [];

  const [candidates, crosswalkRows, members] = await Promise.all([
    getLatestCandidateRepository(),
    getCandidateMemberCrosswalkRepository(),
    getLatestCongressMembersRepository(),
  ]);

  const candidateById = new Map(
    candidates.map((candidate) => [candidate.candidateId, candidate]),
  );
  const crosswalkByCandidateId = new Map(
    crosswalkRows.map((row) => [row.candidateId, row.bioguideId]),
  );
  const memberByBioguideId = new Map(
    members.map((member) => [member.bioguideId, member]),
  );

  return aggregateRows.map((row) => {
    const candidate = candidateById.get(row.candidate_id);
    const bioguideId = crosswalkByCandidateId.get(row.candidate_id);
    const member = bioguideId ? memberByBioguideId.get(bioguideId) : undefined;
    const label = member?.name ?? candidate?.name ?? row.candidate_id;
    const href =
      member?.chamber === "S"
        ? `/explore/senators/${member.bioguideId.toLowerCase()}`
        : candidate
          ? `/search?q=${encodeURIComponent(candidate.name)}`
          : undefined;
    return {
      candidateId: row.candidate_id,
      bioguideId,
      label,
      totalSupport: Number(row.total),
      href,
    };
  });
}

async function getCommitteeIdsForCandidateMap(
  candidateIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (!candidateIds.length) return result;

  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const [candidates, links, linkedCommittees, leadershipLinks] = await Promise.all([
        prisma.candidate.findMany({
          where: { candidateId: { in: candidateIds } },
          select: { candidateId: true, principalCommittees: true },
        }),
        prisma.candidateCommitteeLink.findMany({
          where: { candidateId: { in: candidateIds } },
          select: { candidateId: true, committeeId: true },
        }),
        prisma.committee.findMany({
          where: { linkedCandidateId: { in: candidateIds } },
          select: { linkedCandidateId: true, committeeId: true },
        }),
        prisma.leadershipPacLink.findMany({
          where: { candidateId: { in: candidateIds } },
          select: { candidateId: true, committeeId: true },
        }),
      ]);

      for (const candidate of candidates) {
        const existing = result.get(candidate.candidateId) ?? [];
        existing.push(...normalizeCommitteeJson(candidate.principalCommittees));
        result.set(candidate.candidateId, existing);
      }

      for (const link of links) {
        const existing = result.get(link.candidateId) ?? [];
        existing.push(link.committeeId);
        result.set(link.candidateId, existing);
      }

      for (const committee of linkedCommittees) {
        if (!committee.linkedCandidateId) continue;
        const existing = result.get(committee.linkedCandidateId) ?? [];
        existing.push(committee.committeeId);
        result.set(committee.linkedCandidateId, existing);
      }

      for (const link of leadershipLinks) {
        const existing = result.get(link.candidateId) ?? [];
        existing.push(link.committeeId);
        result.set(link.candidateId, existing);
      }

      for (const [candidateId, committeeIds] of result) {
        result.set(candidateId, [...new Set(committeeIds)]);
      }

      if (result.size) return result;
    } catch (error) {
      warnFallback("getCommitteeIdsForCandidateMap", error);
      // Fall through to JSON artifacts.
    }
  }

  const artifacts = await readLatestArtifacts();
  if (!artifacts) return result;

  const linkMap = new Map<string, Set<string>>();
  for (const candidate of artifacts.fec.candidates) {
    const existing = linkMap.get(candidate.candidateId) ?? new Set<string>();
    for (const committeeId of candidate.principalCommittees) {
      existing.add(committeeId);
    }
    linkMap.set(candidate.candidateId, existing);
  }

  for (const link of artifacts.fec.candidateCommitteeLinks ?? []) {
    const existing = linkMap.get(link.candidateId) ?? new Set<string>();
    existing.add(link.committeeId);
    linkMap.set(link.candidateId, existing);
  }

  for (const link of artifacts.fec.leadershipPacLinks ?? []) {
    const existing = linkMap.get(link.candidateId) ?? new Set<string>();
    existing.add(link.committeeId);
    linkMap.set(link.candidateId, existing);
  }

  for (const committee of artifacts.fec.committees) {
    if (!committee.linkedCandidateId) continue;
    const existing = linkMap.get(committee.linkedCandidateId) ?? new Set<string>();
    existing.add(committee.committeeId);
    linkMap.set(committee.linkedCandidateId, existing);
  }

  for (const candidateId of candidateIds) {
    result.set(candidateId, [...(linkMap.get(candidateId) ?? new Set<string>())]);
  }

  return result;
}

async function getCommitteeContributionStats(
  committeeIds: string[],
): Promise<{
  total: number;
  donors: number;
  rows: number;
  byCommittee: Map<string, number>;
}> {
  if (!committeeIds.length) {
    return {
      total: 0,
      donors: 0,
      rows: 0,
      byCommittee: new Map(),
    };
  }

  const committeeSet = new Set(committeeIds);

  // Try Postgres first
  const prisma = getPrismaClient();
  if (prisma) {
    const runId = await getLatestRunId();
    if (runId) {
      try {
        const [overall, grouped] = await Promise.all([
          prisma.$queryRaw<
            { total: number; donors: number; rows: bigint }[]
          >(Prisma.sql`
            SELECT
              COALESCE(SUM((payload->>'amount')::numeric), 0) as total,
              COUNT(DISTINCT payload->>'donorName') as donors,
              COUNT(*) as rows
            FROM "RawFecContribution"
            WHERE "runId" = ${runId}
              AND payload->>'committeeId' = ANY(${committeeIds})
          `),
          prisma.$queryRaw<{ committee_id: string; total: number }[]>(Prisma.sql`
            SELECT
              payload->>'committeeId' as committee_id,
              SUM((payload->>'amount')::numeric) as total
            FROM "RawFecContribution"
            WHERE "runId" = ${runId}
              AND payload->>'committeeId' = ANY(${committeeIds})
            GROUP BY payload->>'committeeId'
          `),
        ]);

        return {
          total: Number(overall[0]?.total ?? 0),
          donors: Number(overall[0]?.donors ?? 0),
          rows: Number(overall[0]?.rows ?? 0),
          byCommittee: new Map(
            grouped.map((row) => [row.committee_id, Number(row.total)]),
          ),
        };
      } catch (error) {
        warnFallback("getCommitteeContributionStats", error);
        // Fall through to JSON
      }
    }
  }

  // JSON fallback — use PAC summaries for committee-level totals
  const pacSummaries = await readPacSummaries();
  if (pacSummaries.length > 0) {
    const byCommittee = new Map<string, number>();
    let total = 0;
    for (const pac of pacSummaries) {
      if (!committeeSet.has(pac.committeeId)) continue;
      const receipts = pac.totalReceipts ?? 0;
      byCommittee.set(pac.committeeId, receipts);
      total += receipts;
    }
    return { total, donors: 0, rows: 0, byCommittee };
  }

  // Legacy fallback: contributions sample
  const artifacts = await readLatestArtifacts();
  const byCommittee = new Map<string, number>();
  let total = 0;
  let rows = 0;
  const donors = new Set<string>();
  for (const row of artifacts?.fec.contributions ?? []) {
    if (!committeeSet.has(row.committeeId)) continue;
    total += row.amount;
    rows += 1;
    donors.add(row.donorName);
    byCommittee.set(row.committeeId, (byCommittee.get(row.committeeId) ?? 0) + row.amount);
  }
  return { total, donors: donors.size, rows, byCommittee };
}

async function getTopDonorsByCommittees(
  committeeIds: string[],
  limit: number,
): Promise<TopDonorRow[]> {
  if (!committeeIds.length) return [];
  const prisma = getPrismaClient();
  if (!prisma) {
    const artifacts = await readLatestArtifacts();
    const donorTotals = new Map<string, number>();
    const committeeSet = new Set(committeeIds);
    for (const row of artifacts?.fec.contributions ?? []) {
      if (!committeeSet.has(row.committeeId)) continue;
      donorTotals.set(row.donorName, (donorTotals.get(row.donorName) ?? 0) + row.amount);
    }
    return [...donorTotals.entries()]
      .map(([donor, total]) => ({ donor, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, limit);
  }

  const runId = await getLatestRunId();
  if (!runId) {
    const artifacts = await readLatestArtifacts();
    const donorTotals = new Map<string, number>();
    const committeeSet = new Set(committeeIds);
    for (const row of artifacts?.fec.contributions ?? []) {
      if (!committeeSet.has(row.committeeId)) continue;
      donorTotals.set(row.donorName, (donorTotals.get(row.donorName) ?? 0) + row.amount);
    }
    return [...donorTotals.entries()]
      .map(([donor, total]) => ({ donor, total }))
      .sort((left, right) => right.total - left.total)
      .slice(0, limit);
  }

  try {
    return await prisma.$queryRaw<TopDonorRow[]>(Prisma.sql`
      SELECT
        payload->>'donorName' as donor,
        SUM((payload->>'amount')::numeric) as total
      FROM "RawFecContribution"
      WHERE "runId" = ${runId}
        AND payload->>'committeeId' = ANY(${committeeIds})
      GROUP BY payload->>'donorName'
      ORDER BY total DESC
      LIMIT ${limit}
    `);
  } catch (error) {
    warnFallback("getTopDonorsByCommittees", error);
    return [];
  }
}

async function getCandidateById(candidateId: string): Promise<FecCandidate | null> {
  const prisma = getPrismaClient();
  if (prisma) {
    try {
      const row = await prisma.candidate.findUnique({
        where: { candidateId },
      });
      if (row) {
        return {
          candidateId: row.candidateId,
          name: row.name,
          office: row.office,
          officeState: row.officeState ?? undefined,
          officeDistrict: row.officeDistrict ?? undefined,
          party: row.party ?? undefined,
          incumbentChallenge: row.incumbentChallenge ?? undefined,
          candidateStatus: row.candidateStatus ?? undefined,
          electionYear: row.electionYear ?? undefined,
          principalCommittees: normalizeCommitteeJson(row.principalCommittees),
        };
      }
    } catch (error) {
      warnFallback("getCandidateById", error);
      // Fall through to JSON artifacts.
    }
  }

  const artifacts = await readLatestArtifacts();
  return (
    artifacts?.fec.candidates.find((row) => row.candidateId === candidateId) ?? null
  );
}

async function getMemberByBioguideId(
  bioguideId: string,
): Promise<CongressMember | null> {
  const rows = await getLatestCongressMembersRepository();
  return rows.find((row) => row.bioguideId === bioguideId) ?? null;
}

export async function searchEntitiesRepository(
  query: string,
  type?: SearchEntityType,
  limit = 12,
): Promise<SearchEntityResult[]> {
  const q = normalizeSearchText(query);
  if (!q) return [];

  const results: SearchEntityResult[] = [];
  if (!type || type === "member") {
    const members = await getLatestCongressMembersRepository();
    results.push(
      ...members
        .filter((member) => {
          const haystack = normalizeSearchText(
            [
              member.name,
              member.directOrderName,
              member.firstName,
              member.lastName,
              member.firstName && member.lastName
                ? `${member.firstName} ${member.lastName}`
                : undefined,
              member.lastName && member.firstName
                ? `${member.lastName} ${member.firstName}`
                : undefined,
              member.state,
              member.bioguideId,
            ]
              .filter(Boolean)
              .join(" "),
          );
          return haystack.includes(q);
        })
        .map((member) => ({
          type: "member" as const,
          id: member.bioguideId,
          label: member.name,
          subtitle: `${member.chamber} · ${member.state}`,
          href:
            member.chamber === "S"
              ? `/explore/senators/${member.bioguideId.toLowerCase()}`
              : undefined,
        })),
    );
  }

  if (!type || type === "candidate") {
    const candidates = await getLatestCandidateRepository();
    results.push(
      ...candidates
        .filter((candidate) =>
          normalizeSearchText(
            `${candidate.name} ${candidate.officeState ?? ""} ${candidate.candidateId}`,
          ).includes(q),
        )
        .map((candidate) => ({
          type: "candidate" as const,
          id: candidate.candidateId,
          label: candidate.name,
          subtitle: `${candidate.office} · ${candidate.officeState ?? "US"}`,
          href:
            candidate.office === "S"
              ? `/explore/senators/${candidate.candidateId.toLowerCase()}`
              : undefined,
        })),
    );
  }

  if (!type || type === "committee") {
    const committees = await getLatestOrganizationEntitiesRepository();
    results.push(
      ...committees
        .filter((committee) =>
          normalizeSearchText(`${committee.name} ${committee.committeeId} ${committee.issue}`).includes(q),
        )
        .map((committee) => ({
          type: "committee" as const,
          id: committee.committeeId,
          label: committee.name,
          subtitle: committee.issue,
          href: `/explore/organizations/${committee.id}`,
        })),
    );
  }

  if (!type || type === "bill") {
    const bills = await getLatestBillEntitiesRepository();
    results.push(
      ...bills
        .filter((bill) =>
          normalizeSearchText(`${bill.title} ${bill.billType} ${bill.billNumber} ${bill.id}`).includes(q),
        )
        .map((bill) => ({
          type: "bill" as const,
          id: bill.id.toUpperCase(),
          label: `${bill.billType} ${bill.billNumber}`,
          subtitle: bill.title,
          href: `/explore/bills/${bill.id}`,
        })),
    );
  }

  if (!type || type === "donor") {
    const donors = await getDonorProfilesRepository(limit);
    results.push(
      ...donors
        .filter((donor) =>
          normalizeSearchText(
            `${donor.donor} ${donor.donorEmployer ?? ""} ${donor.donorOccupation ?? ""} ${donor.id}`,
          ).includes(q),
        )
        .map((donor) => ({
          type: "donor" as const,
          id: donor.id,
          label: donor.donor,
          subtitle:
            donor.donorEmployer ??
            donor.donorOccupation ??
            donor.donorState ??
            donorTypeLabel(donor.donorType),
          href: `/explore/donors/${donor.id}`,
        })),
    );
  }

  return results.slice(0, limit);
}

export async function getFundingProfileRepository(
  entityId: string,
): Promise<FundingProfileResult | null> {
  const normalizedId = entityId.trim().toUpperCase();
  const fundingReadModels = await readFundingReadModels();
  const derivedProfile = fundingReadModels?.profiles.find(
    (profile) =>
      profile.entityId.toUpperCase() === normalizedId ||
      profile.linkedBioguideId?.toUpperCase() === normalizedId ||
      profile.linkedCandidateId?.toUpperCase() === normalizedId,
  );
  if (derivedProfile) return mapFundingProfileSummaryToFundingProfileResult(derivedProfile);

  const [crosswalkRows, candidateFinancials, pacSummaries] = await Promise.all([
    getCandidateMemberCrosswalkRepository(),
    readCandidateFinancials(),
    readPacSummaries(),
  ]);
  const crosswalkByCandidate = mapCrosswalkByCandidate(crosswalkRows);
  const crosswalkByBioguide = mapCrosswalkByBioguide(crosswalkRows);
  const financialsByCandidate = new Map(
    candidateFinancials.map((cf) => [cf.candidateId, cf]),
  );
  const pacSummaryByCommittee = new Map(
    pacSummaries.map((ps) => [ps.committeeId, ps]),
  );

  function buildCandidateProfile(
    entityType: "member" | "candidate",
    entityId: string,
    label: string,
    candidateId: string,
    bioguideId?: string,
  ): FundingProfileResult {
    const financials = financialsByCandidate.get(candidateId);
    return {
      entityType,
      entityId,
      label,
      linkedBioguideId: bioguideId,
      linkedCandidateId: candidateId,
      committeeIds: [],
      totalReceipts: financials?.totalReceipts ?? 0,
      totalIndividualContributions: financials?.totalIndividualContributions,
      otherCommitteeContributions: financials?.otherCommitteeContributions,
      partyContributions: financials?.partyContributions,
      totalDisbursements: financials?.totalDisbursements,
      cashOnHand: financials?.cashOnHand,
      uniqueDonors: 0,
      contributionRows: 0,
      topDonors: [],
    };
  }

  const member = await getMemberByBioguideId(normalizedId);
  if (member) {
    const linkedCandidateId = crosswalkByBioguide.get(member.bioguideId)?.[0]?.candidateId;
    if (!linkedCandidateId) return null;
    // If we have candidate financials, use them directly
    if (financialsByCandidate.has(linkedCandidateId)) {
      return buildCandidateProfile("member", member.bioguideId, member.name, linkedCandidateId, member.bioguideId);
    }
    // Fallback to committee stats
    const committeeMap = await getCommitteeIdsForCandidateMap([linkedCandidateId]);
    const committeeIds = committeeMap.get(linkedCandidateId) ?? [];
    const stats = await getCommitteeContributionStats(committeeIds);
    const topDonors = await getTopDonorsByCommittees(committeeIds, 10);
    return {
      entityType: "member",
      entityId: member.bioguideId,
      label: member.name,
      linkedBioguideId: member.bioguideId,
      linkedCandidateId,
      committeeIds,
      totalReceipts: stats.total,
      uniqueDonors: stats.donors,
      contributionRows: stats.rows,
      topDonors,
    };
  }

  const candidate = await getCandidateById(normalizedId);
  if (candidate) {
    if (financialsByCandidate.has(candidate.candidateId)) {
      return buildCandidateProfile(
        "candidate",
        candidate.candidateId,
        candidate.name,
        candidate.candidateId,
        crosswalkByCandidate.get(candidate.candidateId)?.bioguideId,
      );
    }
    const committeeMap = await getCommitteeIdsForCandidateMap([candidate.candidateId]);
    const committeeIds = committeeMap.get(candidate.candidateId) ?? candidate.principalCommittees;
    const stats = await getCommitteeContributionStats(committeeIds);
    const topDonors = await getTopDonorsByCommittees(committeeIds, 10);
    return {
      entityType: "candidate",
      entityId: candidate.candidateId,
      label: candidate.name,
      linkedCandidateId: candidate.candidateId,
      linkedBioguideId: crosswalkByCandidate.get(candidate.candidateId)?.bioguideId,
      committeeIds,
      totalReceipts: stats.total,
      uniqueDonors: stats.donors,
      contributionRows: stats.rows,
      topDonors,
    };
  }

  // Committee/PAC profile
  const pacSummary = pacSummaryByCommittee.get(normalizedId);
  if (pacSummary) {
    return {
      entityType: "committee",
      entityId: pacSummary.committeeId,
      label: pacSummary.name,
      committeeIds: [pacSummary.committeeId],
      totalReceipts: pacSummary.totalReceipts ?? 0,
      totalDisbursements: pacSummary.totalDisbursements ?? 0,
      independentExpenditures: pacSummary.independentExpenditures ?? 0,
      cashOnHand: pacSummary.cashOnHand ?? 0,
      uniqueDonors: 0,
      contributionRows: 0,
      topDonors: [],
    };
  }

  const committees = await getLatestOrganizationEntitiesRepository();
  const committee = committees.find((row) => row.committeeId === normalizedId);
  if (!committee) return null;
  const stats = await getCommitteeContributionStats([committee.committeeId]);
  const topDonors = await getTopDonorsByCommittees([committee.committeeId], 10);
  return {
    entityType: "committee",
    entityId: committee.committeeId,
    label: committee.name,
    committeeIds: [committee.committeeId],
    totalReceipts: stats.total,
    uniqueDonors: stats.donors,
    contributionRows: stats.rows,
    topDonors,
  };
}

function mapFundingProfileSummaryToFundingProfileResult(
  profile: FundingProfileSummary,
): FundingProfileResult {
  return {
    entityType: profile.entityType,
    entityId: profile.entityId,
    label: profile.label,
    linkedBioguideId: profile.linkedBioguideId,
    linkedCandidateId: profile.linkedCandidateId,
    committeeIds: profile.committeeIds,
    totalReceipts: profile.totalReceipts,
    totalIndividualContributions: profile.totalIndividualContributions,
    otherCommitteeContributions: profile.otherCommitteeContributions,
    partyContributions: profile.partyContributions,
    totalDisbursements: profile.totalDisbursements,
    cashOnHand: profile.cashOnHand,
    independentExpenditures: profile.independentExpenditures,
    uniqueDonors: profile.uniqueDonors,
    contributionRows: profile.contributionRows,
    topDonors: profile.topDonors.map((row) => ({ donor: row.donor, total: row.total })),
  };
}

export async function getDonorProfilesRepository(limit = 200): Promise<DonorProfileResult[]> {
  const fundingReadModels = await readFundingReadModels();
  return (fundingReadModels?.donors ?? []).slice(0, limit);
}

export async function getDonorProfileRepository(
  donorIdOrName: string,
): Promise<DonorProfileResult | null> {
  const fundingReadModels = await readFundingReadModels();
  if (!fundingReadModels) return null;
  const normalized = donorIdOrName.trim().toUpperCase();
  return (
    fundingReadModels.donors.find(
      (donor) => donor.id.toUpperCase() === normalized || donor.donor.trim().toUpperCase() === normalized,
    ) ?? null
  );
}

export async function rankEntitiesRepository({
  type,
  limit = 10,
}: {
  type: "committee" | "candidate" | "member";
  limit?: number;
}): Promise<RankedEntityResult[]> {
  if (type === "committee") {
    // Use PAC summaries for committee ranking
    const pacSummaries = await readPacSummaries();
    if (pacSummaries.length > 0) {
      return pacSummaries
        .filter((pac) => (pac.totalDisbursements ?? 0) > 0)
        .sort((a, b) => (b.totalDisbursements ?? 0) - (a.totalDisbursements ?? 0))
        .slice(0, limit)
        .map((pac, index) => ({
          rank: index + 1,
          type,
          id: pac.committeeId,
          label: pac.name,
          totalReceipts: pac.totalDisbursements ?? 0,
          committeeIds: [pac.committeeId],
        }));
    }
    const organizations = await getLatestOrganizationEntitiesRepository();
    return organizations.slice(0, limit).map((org, index) => ({
      rank: index + 1,
      type,
      id: org.committeeId,
      label: org.name,
      totalReceipts: org.cycleTotal,
      committeeIds: [org.committeeId],
    }));
  }

  // Use candidate financials for candidate/member ranking
  const candidateFinancials = await readCandidateFinancials();

  if (type === "candidate" && candidateFinancials.length > 0) {
    return candidateFinancials
      .filter((cf) => (cf.totalReceipts ?? 0) > 0)
      .sort((a, b) => (b.totalReceipts ?? 0) - (a.totalReceipts ?? 0))
      .slice(0, limit)
      .map((cf, index) => ({
        rank: index + 1,
        type,
        id: cf.candidateId,
        label: cf.name,
        totalReceipts: cf.totalReceipts ?? 0,
        committeeIds: [],
      }));
  }

  if (type === "member") {
    const [members, crosswalkRows] = await Promise.all([
      getLatestCongressMembersRepository(),
      getCandidateMemberCrosswalkRepository(),
    ]);

    if (candidateFinancials.length > 0) {
      const financialsByCandidate = new Map(
        candidateFinancials.map((cf) => [cf.candidateId, cf]),
      );
      return members
        .map((member) => {
          const candidateId = crosswalkRows.find((row) => row.bioguideId === member.bioguideId)?.candidateId;
          const financials = candidateId ? financialsByCandidate.get(candidateId) : undefined;
          return {
            type,
            id: member.bioguideId,
            label: member.name,
            totalReceipts: financials?.totalReceipts ?? 0,
            committeeIds: [] as string[],
          };
        })
        .filter((row) => row.totalReceipts > 0)
        .sort((left, right) => right.totalReceipts - left.totalReceipts)
        .slice(0, limit)
        .map((row, index) => ({ ...row, rank: index + 1 }));
    }

    // Legacy fallback: aggregate from committee stats
    const committeeMap = await getCommitteeIdsForCandidateMap(
      crosswalkRows.map((row) => row.candidateId),
    );
    const uniqueCommitteeIds = [...new Set([...committeeMap.values()].flat())];
    const stats = await getCommitteeContributionStats(uniqueCommitteeIds);

    return members
      .map((member) => {
        const candidateId = crosswalkRows.find((row) => row.bioguideId === member.bioguideId)?.candidateId;
        const committeeIds = candidateId ? committeeMap.get(candidateId) ?? [] : [];
        const totalReceipts = committeeIds.reduce(
          (sum, committeeId) => sum + (stats.byCommittee.get(committeeId) ?? 0),
          0,
        );
        return { type, id: member.bioguideId, label: member.name, totalReceipts, committeeIds };
      })
      .filter((row) => row.committeeIds.length > 0)
      .sort((left, right) => right.totalReceipts - left.totalReceipts)
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));
  }

  return [];
}

type VoteFundingMemberVote = {
  bioguideId: string;
  voteCast: string;
  firstName?: string;
  lastName?: string;
};

async function analyzeVoteFundingRepositoryInternal({
  chamber,
  voteId,
  billId,
}: {
  chamber: "H" | "S";
  voteId?: string;
  billId?: string;
}): Promise<VoteFundingAnalysisResult | null> {
  const derived = await readVoteFundingSummaries();
  const derivedMatches = chamber === "H" ? derived?.house : derived?.senate;
  const derivedMatch = voteId
    ? derivedMatches?.find((row) => row.voteId === voteId)
    : billId
      ? derivedMatches?.find((row) => row.billId === billId)
      : undefined;
  if (derivedMatch) return mapLaunchVoteFundingAnalysisToRepositoryResult(derivedMatch);

  const votes =
    chamber === "H"
      ? await getLatestHouseVotesRepository()
      : await getLatestSenateVotesRepository();
  const targetVote = voteId
    ? votes.find((row) => row.voteId === voteId)
    : billId
      ? votes.find((row) => row.billId === billId)
      : null;
  if (!targetVote) return null;

  const memberVotes =
    chamber === "H"
      ? ((await getHouseVoteMemberVotesRepository(targetVote.voteId)) as VoteFundingMemberVote[])
      : ((await getSenateVoteMemberVotesRepository(targetVote.voteId)) as VoteFundingMemberVote[]);
  const voteQuestion =
    chamber === "H"
      ? (targetVote as HouseRollCallVote).voteQuestion
      : (targetVote as SenateRollCallVote).question;
  if (!memberVotes.length) {
    return {
      voteId: targetVote.voteId,
      billId: targetVote.billId,
      question: voteQuestion,
      result: targetVote.result,
      groups: [],
    };
  }

  const [crosswalkRows, candidateFinancials, members] = await Promise.all([
    getCandidateMemberCrosswalkRepository(),
    readCandidateFinancials(),
    getLatestCongressMembersRepository(),
  ]);
  const crosswalkByBioguide = mapCrosswalkByBioguide(crosswalkRows);
  const financialsByCandidate = new Map(
    candidateFinancials.map((cf) => [cf.candidateId, cf]),
  );
  const memberNameByBioguide = new Map(
    members.map((row) => [row.bioguideId, row.name]),
  );

  // If we don't have candidate financials, fall back to committee stats
  let getFinancialBuckets: (candidateId: string | undefined) => {
    totalReceipts: number;
    totalIndividualContributions?: number;
    otherCommitteeContributions?: number;
    partyContributions?: number;
    independentExpenditures?: number;
  };
  if (candidateFinancials.length > 0) {
    getFinancialBuckets = (candidateId) => {
      const financials = candidateId ? financialsByCandidate.get(candidateId) : undefined;
      return {
        totalReceipts: financials?.totalReceipts ?? 0,
        totalIndividualContributions: financials?.totalIndividualContributions,
        otherCommitteeContributions: financials?.otherCommitteeContributions,
        partyContributions: financials?.partyContributions,
      };
    };
  } else {
    const candidateIds = [
      ...new Set(
        memberVotes.flatMap((row) => crosswalkByBioguide.get(row.bioguideId)?.map((x) => x.candidateId) ?? []),
      ),
    ];
    const committeeMap = await getCommitteeIdsForCandidateMap(candidateIds);
    const committeeIds = [...new Set([...committeeMap.values()].flat())];
    const stats = await getCommitteeContributionStats(committeeIds);
    getFinancialBuckets = (candidateId) => {
      if (!candidateId) return { totalReceipts: 0 };
      const cids = committeeMap.get(candidateId) ?? [];
      return {
        totalReceipts: cids.reduce((sum, cid) => sum + (stats.byCommittee.get(cid) ?? 0), 0),
      };
    };
  }

  const byVoteCast = new Map<
    string,
    Array<{
      bioguideId: string;
      candidateId?: string;
      name: string;
      totalReceipts: number;
      totalIndividualContributions?: number;
      otherCommitteeContributions?: number;
      partyContributions?: number;
      independentExpenditures?: number;
    }>
  >();

  for (const memberVote of memberVotes) {
    const candidateId = crosswalkByBioguide.get(memberVote.bioguideId)?.[0]?.candidateId;
    const financialBuckets = getFinancialBuckets(candidateId);
    const group = byVoteCast.get(memberVote.voteCast) ?? [];
    group.push({
      bioguideId: memberVote.bioguideId,
      candidateId,
      name:
        memberNameByBioguide.get(memberVote.bioguideId) ??
        `${memberVote.firstName ?? ""} ${memberVote.lastName ?? ""}`.trim() ??
        memberVote.bioguideId,
      ...financialBuckets,
    });
    byVoteCast.set(memberVote.voteCast, group);
  }

  const groups = [...byVoteCast.entries()]
    .map(([voteCast, rows]) => ({
      voteCast,
      memberCount: rows.length,
      matchedCandidateCount: rows.filter((row) => row.candidateId).length,
      totalReceipts: rows.reduce((sum, row) => sum + row.totalReceipts, 0),
      totalIndividualContributions: rows.reduce((sum, row) => sum + (row.totalIndividualContributions ?? 0), 0),
      otherCommitteeContributions: rows.reduce((sum, row) => sum + (row.otherCommitteeContributions ?? 0), 0),
      partyContributions: rows.reduce((sum, row) => sum + (row.partyContributions ?? 0), 0),
      independentExpenditures: rows.reduce((sum, row) => sum + (row.independentExpenditures ?? 0), 0),
      averageReceipts:
        rows.length > 0
          ? rows.reduce((sum, row) => sum + row.totalReceipts, 0) / rows.length
          : 0,
      topMembers: [...rows]
        .sort((left, right) => right.totalReceipts - left.totalReceipts)
        .slice(0, 5),
    }))
    .sort((left, right) => right.memberCount - left.memberCount);

  return {
    voteId: targetVote.voteId,
    billId: targetVote.billId,
    question: voteQuestion,
    result: targetVote.result,
    groups,
  };
}

function mapLaunchVoteFundingAnalysisToRepositoryResult(
  analysis: LaunchVoteFundingAnalysis,
): VoteFundingAnalysisResult {
  return {
    voteId: analysis.voteId,
    billId: analysis.billId,
    question: analysis.question,
    result: analysis.result,
    groups: analysis.groups.map((group) => ({
      voteCast: group.voteCast,
      memberCount: group.memberCount,
      matchedCandidateCount: group.matchedCandidateCount,
      totalReceipts: group.totalReceipts,
      totalIndividualContributions: group.totalIndividualContributions,
      otherCommitteeContributions: group.otherCommitteeContributions,
      partyContributions: group.partyContributions,
      independentExpenditures: group.independentExpenditures,
      averageReceipts: group.averageReceipts,
      topMembers: group.topMembers.map((member) => ({
        bioguideId: member.bioguideId,
        candidateId: member.candidateId,
        name: member.name,
        totalReceipts: member.totalReceipts,
      })),
    })),
  };
}

export async function analyzeHouseVoteFundingRepository({
  voteId,
  billId,
}: {
  voteId?: string;
  billId?: string;
}): Promise<VoteFundingAnalysisResult | null> {
  return analyzeVoteFundingRepositoryInternal({ chamber: "H", voteId, billId });
}

export async function analyzeSenateVoteFundingRepository({
  voteId,
  billId,
}: {
  voteId?: string;
  billId?: string;
}): Promise<VoteFundingAnalysisResult | null> {
  return analyzeVoteFundingRepositoryInternal({ chamber: "S", voteId, billId });
}

// ---------------------------------------------------------------------------
// USASpending: contracts & contractors
// ---------------------------------------------------------------------------

export async function getTopContractorsRepository(limit = 50): Promise<ContractorProfile[]> {
  const contractors = await readTopContractors();
  return contractors.slice(0, limit);
}

export async function getContractsByCompanyRepository(
  companyName: string,
  limit = 50,
): Promise<GovernmentContract[]> {
  const contracts = await readContracts();
  const normalized = companyName.toUpperCase().trim();
  return contracts
    .filter((c) => c.recipientName.toUpperCase().includes(normalized))
    .sort((a, b) => b.awardAmount - a.awardAmount)
    .slice(0, limit);
}

export async function getContractorProfileRepository(
  companyName: string,
): Promise<ContractorProfile | null> {
  const contractors = await readTopContractors();
  const normalized = companyName.toUpperCase().trim();
  return (
    contractors.find((c) => c.recipientName.toUpperCase().includes(normalized)) ??
    null
  );
}

// --- LDA Lobbying Disclosure repository functions ---

export async function getLobbyingClientsRepository(limit = 50) {
  const { readLobbyingClients } = await import("@/lib/ingest/storage");
  const clients = await readLobbyingClients();
  return clients
    .sort((a, b) => b.totalSpending - a.totalSpending)
    .slice(0, limit);
}

export async function getLobbyingByClientRepository(clientName: string) {
  const { readLobbyingClients, readLobbyingFilings } = await import("@/lib/ingest/storage");
  const [clients, filings] = await Promise.all([
    readLobbyingClients(),
    readLobbyingFilings(),
  ]);

  const normalized = clientName.toUpperCase().trim();
  const client = clients.find(
    (c) => c.clientName.toUpperCase() === normalized ||
           c.clientName.toUpperCase().includes(normalized),
  );
  if (!client) return null;

  const clientFilings = filings.filter(
    (f) => f.clientName === client.clientName,
  );

  return {
    ...client,
    filings: clientFilings,
  };
}

export async function getLobbyistContributionsForMemberRepository(
  memberName: string,
  limit = 50,
) {
  const { readLobbyistContributions } = await import("@/lib/ingest/storage");
  const contributions = await readLobbyistContributions();
  const normalized = memberName.toUpperCase().trim();

  return contributions
    .filter(
      (c) =>
        c.honoreeName.toUpperCase().includes(normalized) ||
        c.payeeName.toUpperCase().includes(normalized),
    )
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit);
}

export async function getBillsLobbiedRepository(limit = 50) {
  const { readLobbyingFilings } = await import("@/lib/ingest/storage");
  const filings = await readLobbyingFilings();

  // Count how many filings mention each bill
  const billCounts = new Map<string, { count: number; clients: Set<string>; issues: Set<string> }>();
  for (const filing of filings) {
    for (const activity of filing.lobbyingActivities) {
      for (const bill of activity.billNumbers) {
        const entry = billCounts.get(bill) ?? { count: 0, clients: new Set(), issues: new Set() };
        entry.count += 1;
        entry.clients.add(filing.clientName);
        if (activity.issueCode) entry.issues.add(activity.issueCode);
        billCounts.set(bill, entry);
      }
    }
  }

  return [...billCounts.entries()]
    .map(([bill, data]) => ({
      billNumber: bill,
      filingCount: data.count,
      uniqueClients: data.clients.size,
      topClients: [...data.clients].slice(0, 5),
      issues: [...data.issues].slice(0, 5),
    }))
    .sort((a, b) => b.filingCount - a.filingCount)
    .slice(0, limit);
}

// --- SEC EDGAR insider trading repository functions ---

export async function getInsiderTradeSummariesRepository(limit = 50) {
  const { readInsiderTradeSummaries } = await import("@/lib/ingest/storage");
  const summaries = await readInsiderTradeSummaries();
  return summaries
    .sort((a, b) => Math.abs(b.netValue) - Math.abs(a.netValue))
    .slice(0, limit);
}

export async function getInsiderTradesByCompanyRepository(
  ticker: string,
  limit = 50,
) {
  const { readInsiderTrades, readInsiderTradeSummaries } = await import(
    "@/lib/ingest/storage"
  );
  const [trades, summaries] = await Promise.all([
    readInsiderTrades(),
    readInsiderTradeSummaries(),
  ]);

  const normalizedTicker = ticker.toUpperCase().trim();
  const summary = summaries.find(
    (s) =>
      s.ticker.toUpperCase() === normalizedTicker ||
      s.companyName.toUpperCase().includes(normalizedTicker),
  );

  const companyTrades = trades
    .filter(
      (t) =>
        t.ticker.toUpperCase() === normalizedTicker ||
        t.companyName.toUpperCase().includes(normalizedTicker),
    )
    .sort(
      (a, b) =>
        new Date(b.transactionDate).getTime() -
        new Date(a.transactionDate).getTime(),
    )
    .slice(0, limit);

  return { summary: summary ?? null, trades: companyTrades };
}

// --- SEC EDGAR corporate filings (non-Form-4) repository functions ---

export async function getSecCorporateFilings(options?: {
  cik?: string;
  ticker?: string;
  form?: string;
  limit?: number;
}) {
  const { readSecCorporateFilings } = await import("@/lib/ingest/storage");
  const filings = await readSecCorporateFilings();

  const cik = options?.cik?.trim();
  const ticker = options?.ticker?.trim().toUpperCase();
  const form = options?.form?.trim();
  const limit = options?.limit;

  let filtered = filings;
  if (cik) {
    filtered = filtered.filter((f) => f.cik === cik);
  }
  if (ticker) {
    filtered = filtered.filter((f) => f.ticker.toUpperCase() === ticker);
  }
  if (form) {
    filtered = filtered.filter((f) => f.form === form);
  }

  filtered = [...filtered].sort(
    (a, b) =>
      new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime(),
  );

  return typeof limit === "number" ? filtered.slice(0, limit) : filtered;
}
