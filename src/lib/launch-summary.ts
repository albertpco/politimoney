import {
  buildCandidateMemberCrosswalk,
  mapCrosswalkByBioguide,
  mapCrosswalkByCandidate,
} from "@/lib/data/crosswalk";
import type {
  FecCandidateFinancials,
  FecPacSummary,
  HouseRollCallVote,
  HouseRollCallMemberVote,
  IngestArtifacts,
  IngestRunSummary,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";

export type LaunchSummaryItem = {
  id: string;
  label: string;
  amount: number;
};

export type LaunchSummaryArtifact = {
  runId: string;
  generatedAt: string;
  totals: IngestRunSummary["totals"];
  topMembers: LaunchSummaryItem[];
  topCommittees: LaunchSummaryItem[];
  latestHouseVote?: {
    voteId: string;
    billId?: string;
    question?: string;
    result?: string;
  };
  latestSenateVote?: {
    voteId: string;
    billId?: string;
    question?: string;
    result?: string;
  };
  latestHouseAnalysis?: LaunchVoteFundingAnalysis;
  latestSenateAnalysis?: LaunchVoteFundingAnalysis;
};

export type VoteFundingSummaryArtifact = {
  generatedAt: string;
  house: LaunchVoteFundingAnalysis[];
  senate: LaunchVoteFundingAnalysis[];
};

export type FundingProfileSummary = {
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
  topDonors: Array<{
    donor: string;
    total: number;
  }>;
};

export type DonorRecipientSummary = {
  entityType: "member" | "candidate" | "committee";
  entityId: string;
  label: string;
  total: number;
  href: string;
};

export type DonorEntityType = "person" | "organization" | "unknown";

export type DonorSummary = {
  id: string;
  donor: string;
  donorType: DonorEntityType;
  donorEmployer?: string;
  donorOccupation?: string;
  donorState?: string;
  totalContributed: number;
  contributionRows: number;
  recipientCount: number;
  topRecipients: DonorRecipientSummary[];
};

export type FundingReadModelsArtifact = {
  generatedAt: string;
  profiles: FundingProfileSummary[];
  donors: DonorSummary[];
};

export type LaunchVoteFundingAnalysis = {
  voteId: string;
  billId?: string;
  question?: string;
  result?: string;
  groups: Array<{
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
  }>;
};

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

function topCommitteesFromPacSummaries(
  pacSummaries: FecPacSummary[] | undefined,
  limit = 5,
): LaunchSummaryItem[] {
  return (pacSummaries ?? [])
    .filter((pac) => (pac.totalDisbursements ?? 0) > 0)
    .sort((left, right) => (right.totalDisbursements ?? 0) - (left.totalDisbursements ?? 0))
    .slice(0, limit)
    .map((pac) => ({
      id: pac.committeeId,
      label: pac.name,
      amount: pac.totalDisbursements ?? 0,
    }));
}

function topMembersFromFinancials(
  artifacts: IngestArtifacts,
  candidateFinancials: FecCandidateFinancials[] | undefined,
  limit = 5,
): LaunchSummaryItem[] {
  if (!candidateFinancials?.length) return [];

  const crosswalk = buildCandidateMemberCrosswalk(
    artifacts.fec.candidates,
    artifacts.congress.members,
    artifacts.fec.committees,
  );
  const crosswalkByBioguide = mapCrosswalkByBioguide(crosswalk);
  const financialsByCandidate = new Map(
    candidateFinancials.map((financial) => [financial.candidateId, financial]),
  );

  return artifacts.congress.members
    .map((member) => {
      const candidateId = crosswalkByBioguide.get(member.bioguideId)?.[0]?.candidateId;
      const receipts = candidateId
        ? financialsByCandidate.get(candidateId)?.totalReceipts ?? 0
        : 0;
      return {
        id: member.bioguideId,
        label: member.name,
        amount: receipts,
      };
    })
    .filter((member) => member.amount > 0)
    .sort((left, right) => right.amount - left.amount)
    .slice(0, limit);
}

function slugFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

const DONOR_TITLE_TOKENS = new Set([
  "MR",
  "MRS",
  "MS",
  "MISS",
  "DR",
  "REV",
  "HON",
  "JR",
  "SR",
  "II",
  "III",
  "IV",
  "MD",
  "PHD",
  "ESQ",
]);

const ORGANIZATION_HINT_TOKENS = new Set([
  "INC",
  "LLC",
  "LLP",
  "LP",
  "LTD",
  "CORP",
  "CORPORATION",
  "CO",
  "COMPANY",
  "PAC",
  "FUND",
  "COMMITTEE",
  "ASSOCIATION",
  "UNION",
  "PARTNERS",
  "PARTNERSHIP",
  "HOLDINGS",
  "GROUP",
  "CAPITAL",
  "BANK",
  "ASSOC",
  "ASSOCIATES",
  "FOUNDATION",
  "INSTITUTE",
  "COUNCIL",
  "NETWORK",
  "ACTION",
  "ALLIANCE",
  "FORWARD",
  "FUTURE",
  "STRATEGIES",
  "FRIENDS",
  "CONGRESS",
  "GOVERNMENT",
  "NATION",
  "ACCOUNT",
  "NONFEDERAL",
  "COMMERCE",
  "EXCHANGE",
  "BLUE",
  "VENTURES",
  "ENTERPRISES",
  "LABS",
  "SYSTEMS",
  "TECHNOLOGIES",
  "INDUSTRIES",
  "UNITEMIZED",
]);

function normalizeDonorToken(value: string): string {
  return value.replace(/[^A-Z0-9]/g, "");
}

function titleCaseWord(word: string): string {
  if (!word) return word;
  if (word === word.toUpperCase() && word.length <= 3) return word;
  return word[0] + word.slice(1).toLowerCase();
}

function formatDisplayFromCanonical(value: string): string {
  if (!value) return value;
  if (value.includes(",")) {
    const [last, first] = value.split(",", 2);
    return `${first.trim().split(/\s+/).map(titleCaseWord).join(" ")} ${last
      .trim()
      .split(/\s+/)
      .map(titleCaseWord)
      .join(" ")}`.trim();
  }
  return value
    .split(/\s+/)
    .map(titleCaseWord)
    .join(" ");
}

function hasMeaningfulDonorMetadata(value?: string): boolean {
  if (!value) return false;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return false;
  return !["N/A", "NA", "NONE", "UNKNOWN"].includes(normalized);
}

function canonicalizeDonorName(raw: string): { key: string; display: string } {
  const upper = raw.trim().toUpperCase();
  const bare = upper.replace(/[.'"]/g, "").replace(/&/g, " AND ");
  const commaParts = bare.split(",").map((part) => part.trim()).filter(Boolean);
  const rawTokens = bare.split(/[\s,/-]+/).map(normalizeDonorToken).filter(Boolean);
  const looksLikeOrganization = rawTokens.some((token) => ORGANIZATION_HINT_TOKENS.has(token));

  if (!looksLikeOrganization && commaParts.length >= 2) {
    const lastTokens = commaParts[0].split(/\s+/).map(normalizeDonorToken).filter(Boolean);
    const firstTokens = commaParts
      .slice(1)
      .join(" ")
      .split(/\s+/)
      .map(normalizeDonorToken)
      .filter((token) => token && !DONOR_TITLE_TOKENS.has(token) && token.length > 1);
    const last = lastTokens.join(" ");
    const first = firstTokens[0] ?? "";
    const canonical = [last, first].filter(Boolean).join(", ");
    if (canonical) {
      return {
        key: canonical,
        display: formatDisplayFromCanonical(canonical),
      };
    }
  }

  const normalized = rawTokens.filter((token) => !DONOR_TITLE_TOKENS.has(token)).join(" ");
  return {
    key: normalized,
    display: formatDisplayFromCanonical(normalized),
  };
}

function classifyDonorEntityType({
  rawName,
  donorEmployer,
  donorOccupation,
}: {
  rawName: string;
  donorEmployer?: string;
  donorOccupation?: string;
}): DonorEntityType {
  const upper = rawName.trim().toUpperCase();
  const bare = upper.replace(/[.'"]/g, "").replace(/&/g, " AND ");
  const commaParts = bare.split(",").map((part) => part.trim()).filter(Boolean);
  const rawTokens = bare.split(/[\s,/-]+/).map(normalizeDonorToken).filter(Boolean);
  const hasOrganizationHint = rawTokens.some((token) => ORGANIZATION_HINT_TOKENS.has(token));
  if (hasOrganizationHint) return "organization";

  const alphaTokens = rawTokens.filter((token) => /^[A-Z]+$/.test(token));
  const hasCommaPersonPattern = commaParts.length >= 2 && alphaTokens.length >= 2;
  if (hasCommaPersonPattern) return "person";

  const hasOccupation = hasMeaningfulDonorMetadata(donorOccupation);
  const hasEmployer = hasMeaningfulDonorMetadata(donorEmployer);
  const startsWithFriendsOf = bare.startsWith("FRIENDS OF ");
  const hasForCongressPattern = /\bFOR\s+(CONGRESS|SENATE|HOUSE|AMERICA|US)\b/.test(bare);
  const singleTokenBrand = alphaTokens.length === 1 && alphaTokens[0].length >= 5 && !hasEmployer && !hasOccupation;
  if (startsWithFriendsOf || hasForCongressPattern || singleTokenBrand) {
    return "organization";
  }

  const looksLikeNaturalName =
    alphaTokens.length >= 2 &&
    alphaTokens.length <= 4 &&
    alphaTokens.every((token) => token.length > 1) &&
    !alphaTokens.includes("AND");

  if (looksLikeNaturalName && (hasOccupation || hasEmployer)) {
    return "person";
  }

  if (hasEmployer && alphaTokens.length >= 1) {
    return "organization";
  }

  return "unknown";
}

function buildCommitteeIdsForCandidateMap(artifacts: IngestArtifacts): Map<string, string[]> {
  const result = new Map<string, Set<string>>();

  for (const candidate of artifacts.fec.candidates) {
    const existing = result.get(candidate.candidateId) ?? new Set<string>();
    for (const committeeId of candidate.principalCommittees) {
      existing.add(committeeId);
    }
    result.set(candidate.candidateId, existing);
  }

  for (const link of artifacts.fec.candidateCommitteeLinks ?? []) {
    const existing = result.get(link.candidateId) ?? new Set<string>();
    existing.add(link.committeeId);
    result.set(link.candidateId, existing);
  }

  for (const link of artifacts.fec.leadershipPacLinks ?? []) {
    const existing = result.get(link.candidateId) ?? new Set<string>();
    existing.add(link.committeeId);
    result.set(link.candidateId, existing);
  }

  return new Map(
    [...result.entries()].map(([candidateId, committeeIds]) => [
      candidateId,
      [...committeeIds],
    ]),
  );
}

function buildFundingReadModels(artifacts: IngestArtifacts): FundingReadModelsArtifact {
  const contributions = artifacts.fec.contributions;
  const crosswalk = buildCandidateMemberCrosswalk(
    artifacts.fec.candidates,
    artifacts.congress.members,
    artifacts.fec.committees,
  );
  const crosswalkByBioguide = mapCrosswalkByBioguide(crosswalk);
  const crosswalkByCandidate = mapCrosswalkByCandidate(crosswalk);
  const committeeIdsByCandidate = buildCommitteeIdsForCandidateMap(artifacts);
  const candidateFinancialsByCandidate = new Map(
    (artifacts.fec.candidateFinancials ?? []).map((financial) => [
      financial.candidateId,
      financial,
    ]),
  );
  const pacSummariesByCommittee = new Map(
    (artifacts.fec.pacSummaries ?? []).map((summary) => [summary.committeeId, summary]),
  );
  const committeeById = new Map(
    artifacts.fec.committees.map((committee) => [committee.committeeId, committee]),
  );
  const memberByBioguide = new Map(
    artifacts.congress.members.map((member) => [member.bioguideId, member]),
  );

  const candidateIdByCommittee = new Map<string, string>();
  for (const [candidateId, committeeIds] of committeeIdsByCandidate) {
    for (const committeeId of committeeIds) {
      if (!candidateIdByCommittee.has(committeeId)) {
        candidateIdByCommittee.set(committeeId, candidateId);
      }
    }
  }

  const donorTotalsByCommittee = new Map<string, Map<string, number>>();
  const donorSetsByCommittee = new Map<string, Set<string>>();
  const contributionRowsByCommittee = new Map<string, number>();
  const donorMap = new Map<
    string,
    {
      donor: string;
      donorType: DonorEntityType;
      donorEmployer?: string;
      donorOccupation?: string;
      donorState?: string;
      totalContributed: number;
      contributionRows: number;
      recipientTotals: Map<string, number>;
      displayPriority: number;
    }
  >();

  for (const contribution of contributions) {
    const committeeDonors = donorTotalsByCommittee.get(contribution.committeeId) ?? new Map<string, number>();
    committeeDonors.set(
      contribution.donorName,
      (committeeDonors.get(contribution.donorName) ?? 0) + contribution.amount,
    );
    donorTotalsByCommittee.set(contribution.committeeId, committeeDonors);

    const donorSet = donorSetsByCommittee.get(contribution.committeeId) ?? new Set<string>();
    donorSet.add(contribution.donorName);
    donorSetsByCommittee.set(contribution.committeeId, donorSet);

    contributionRowsByCommittee.set(
      contribution.committeeId,
      (contributionRowsByCommittee.get(contribution.committeeId) ?? 0) + 1,
    );

    const canonicalDonor = canonicalizeDonorName(contribution.donorName);
    const donorKey = canonicalDonor.key;
    const donorEntry = donorMap.get(donorKey) ?? {
      donor: canonicalDonor.display,
      donorType: classifyDonorEntityType({
        rawName: contribution.donorName,
        donorEmployer: contribution.donorEmployer,
        donorOccupation: contribution.donorOccupation,
      }),
      donorEmployer: contribution.donorEmployer,
      donorOccupation: contribution.donorOccupation,
      donorState: contribution.state,
      totalContributed: 0,
      contributionRows: 0,
      recipientTotals: new Map<string, number>(),
      displayPriority: 0,
    };
    const priority =
      (contribution.donorEmployer ? 1 : 0) +
      (contribution.donorOccupation ? 1 : 0) +
      Math.min(contribution.donorName.trim().length, 60) / 100;
    if (priority > donorEntry.displayPriority) {
      donorEntry.donor = canonicalDonor.display;
      donorEntry.displayPriority = priority;
    }
    const classifiedType = classifyDonorEntityType({
      rawName: contribution.donorName,
      donorEmployer: contribution.donorEmployer,
      donorOccupation: contribution.donorOccupation,
    });
    if (
      donorEntry.donorType === "unknown" ||
      (donorEntry.donorType === "person" && classifiedType === "organization")
    ) {
      donorEntry.donorType = classifiedType;
    }
    if (!donorEntry.donorEmployer && contribution.donorEmployer) donorEntry.donorEmployer = contribution.donorEmployer;
    if (!donorEntry.donorOccupation && contribution.donorOccupation) donorEntry.donorOccupation = contribution.donorOccupation;
    if (!donorEntry.donorState && contribution.state) donorEntry.donorState = contribution.state;
    donorEntry.totalContributed += contribution.amount;
    donorEntry.contributionRows += 1;
    donorEntry.recipientTotals.set(
      contribution.committeeId,
      (donorEntry.recipientTotals.get(contribution.committeeId) ?? 0) + contribution.amount,
    );
    donorMap.set(donorKey, donorEntry);
  }

  const topDonorsForCommitteeIds = (committeeIds: string[]) => {
    const totals = new Map<string, number>();
    let rows = 0;
    const donorSet = new Set<string>();
    for (const committeeId of committeeIds) {
      rows += contributionRowsByCommittee.get(committeeId) ?? 0;
      for (const donor of donorSetsByCommittee.get(committeeId) ?? []) donorSet.add(donor);
      for (const [donor, total] of donorTotalsByCommittee.get(committeeId) ?? []) {
        totals.set(donor, (totals.get(donor) ?? 0) + total);
      }
    }
    return {
      uniqueDonors: donorSet.size,
      contributionRows: rows,
      topDonors: [...totals.entries()]
        .map(([donor, total]) => ({ donor, total }))
        .sort((left, right) => right.total - left.total)
        .slice(0, 10),
    };
  };

  const profiles: FundingProfileSummary[] = [];

  for (const member of artifacts.congress.members) {
    const candidateId = crosswalkByBioguide.get(member.bioguideId)?.[0]?.candidateId;
    if (!candidateId) continue;
    const committeeIds = committeeIdsByCandidate.get(candidateId) ?? [];
    const donorStats = topDonorsForCommitteeIds(committeeIds);
    const financials = candidateFinancialsByCandidate.get(candidateId);
    profiles.push({
      entityType: "member",
      entityId: member.bioguideId,
      label: member.name,
      linkedBioguideId: member.bioguideId,
      linkedCandidateId: candidateId,
      committeeIds,
      totalReceipts: financials?.totalReceipts ?? 0,
      totalIndividualContributions: financials?.totalIndividualContributions,
      otherCommitteeContributions: financials?.otherCommitteeContributions,
      partyContributions: financials?.partyContributions,
      totalDisbursements: financials?.totalDisbursements,
      cashOnHand: financials?.cashOnHand,
      uniqueDonors: donorStats.uniqueDonors,
      contributionRows: donorStats.contributionRows,
      topDonors: donorStats.topDonors,
    });
  }

  for (const candidate of artifacts.fec.candidates) {
    const committeeIds = committeeIdsByCandidate.get(candidate.candidateId) ?? candidate.principalCommittees;
    const donorStats = topDonorsForCommitteeIds(committeeIds);
    const financials = candidateFinancialsByCandidate.get(candidate.candidateId);
    profiles.push({
      entityType: "candidate",
      entityId: candidate.candidateId,
      label: candidate.name,
      linkedBioguideId: crosswalkByCandidate.get(candidate.candidateId)?.bioguideId,
      linkedCandidateId: candidate.candidateId,
      committeeIds,
      totalReceipts: financials?.totalReceipts ?? 0,
      totalIndividualContributions: financials?.totalIndividualContributions,
      otherCommitteeContributions: financials?.otherCommitteeContributions,
      partyContributions: financials?.partyContributions,
      totalDisbursements: financials?.totalDisbursements,
      cashOnHand: financials?.cashOnHand,
      uniqueDonors: donorStats.uniqueDonors,
      contributionRows: donorStats.contributionRows,
      topDonors: donorStats.topDonors,
    });
  }

  for (const committee of artifacts.fec.committees) {
    const donorStats = topDonorsForCommitteeIds([committee.committeeId]);
    const pacSummary = pacSummariesByCommittee.get(committee.committeeId);
    profiles.push({
      entityType: "committee",
      entityId: committee.committeeId,
      label: committee.name,
      committeeIds: [committee.committeeId],
      totalReceipts: pacSummary?.totalReceipts ?? 0,
      totalDisbursements: pacSummary?.totalDisbursements,
      cashOnHand: pacSummary?.cashOnHand,
      independentExpenditures: pacSummary?.independentExpenditures,
      uniqueDonors: donorStats.uniqueDonors,
      contributionRows: donorStats.contributionRows,
      topDonors: donorStats.topDonors,
    });
  }

  const donorRecipientLabel = (committeeId: string): DonorRecipientSummary => {
    const candidateId = candidateIdByCommittee.get(committeeId);
    if (candidateId) {
      const bioguideId = crosswalkByCandidate.get(candidateId)?.bioguideId;
      const member = bioguideId ? memberByBioguide.get(bioguideId) : undefined;
      if (member) {
        return {
          entityType: "member",
          entityId: member.bioguideId,
          label: member.name,
          total: 0,
          href: `/explore/members/${member.bioguideId.toLowerCase()}`,
        };
      }
      const candidate = artifacts.fec.candidates.find((row) => row.candidateId === candidateId);
      if (candidate) {
        return {
          entityType: "candidate",
          entityId: candidate.candidateId,
          label: candidate.name,
          total: 0,
          href: `/explore/senators/${candidate.candidateId.toLowerCase()}`,
        };
      }
    }

    const committeeName = committeeById.get(committeeId)?.name ?? committeeId;
    return {
      entityType: "committee",
      entityId: committeeId,
      label: committeeName,
      total: 0,
      href: `/explore/organizations/${slugFromText(`${committeeId}-${committeeName}`)}`,
    };
  };

  const donors = [...donorMap.values()]
    .map((donor) => ({
      id: slugFromText(donor.donor),
      donor: donor.donor,
      donorType: donor.donorType,
      donorEmployer: donor.donorEmployer,
      donorOccupation: donor.donorOccupation,
      donorState: donor.donorState,
      totalContributed: donor.totalContributed,
      contributionRows: donor.contributionRows,
      recipientCount: donor.recipientTotals.size,
      topRecipients: [...donor.recipientTotals.entries()]
        .map(([committeeId, total]) => {
          const base = donorRecipientLabel(committeeId);
          return { ...base, total };
        })
        .sort((left, right) => right.total - left.total)
        .slice(0, 10),
    }))
    .sort((left, right) => right.totalContributed - left.totalContributed);

  return {
    generatedAt: new Date().toISOString(),
    profiles,
    donors,
  };
}

function buildVoteFundingAnalysisMaps(artifacts: IngestArtifacts) {
  const crosswalk = buildCandidateMemberCrosswalk(
    artifacts.fec.candidates,
    artifacts.congress.members,
    artifacts.fec.committees,
  );
  const crosswalkByBioguide = mapCrosswalkByBioguide(crosswalk);
  const financialsByCandidate = new Map(
    (artifacts.fec.candidateFinancials ?? []).map((financial) => [
      financial.candidateId,
      financial,
    ]),
  );
  const memberNameByBioguide = new Map(
    artifacts.congress.members.map((member) => [member.bioguideId, member.name]),
  );
  return { crosswalkByBioguide, financialsByCandidate, memberNameByBioguide };
}

function buildVoteFundingAnalysis(
  vote:
    | {
        voteId: string;
        billId?: string;
        result?: string;
        question?: string;
      }
    | undefined,
  memberVotes: Array<HouseRollCallMemberVote | SenateRollCallMemberVote>,
  lookups: ReturnType<typeof buildVoteFundingAnalysisMaps>,
): LaunchVoteFundingAnalysis | undefined {
  if (!vote) return undefined;

  const grouped = new Map<
    string,
    Array<{
      bioguideId: string;
      candidateId?: string;
      name: string;
      totalReceipts: number;
    }>
  >();

  for (const memberVote of memberVotes.filter((entry) => entry.voteId === vote.voteId)) {
    const candidateId = lookups.crosswalkByBioguide.get(memberVote.bioguideId)?.[0]?.candidateId;
    const financials = candidateId ? lookups.financialsByCandidate.get(candidateId) : undefined;
    const totalReceipts = financials?.totalReceipts ?? 0;
    const rows = grouped.get(memberVote.voteCast) ?? [];
    rows.push({
      bioguideId: memberVote.bioguideId,
      candidateId,
      name:
        lookups.memberNameByBioguide.get(memberVote.bioguideId) ??
        `${memberVote.firstName ?? ""} ${memberVote.lastName ?? ""}`.trim() ??
        memberVote.bioguideId,
      totalReceipts,
    });
    grouped.set(memberVote.voteCast, rows);
  }

  return {
    voteId: vote.voteId,
    billId: vote.billId,
    question: vote.question,
    result: vote.result,
    groups: [...grouped.entries()]
      .map(([voteCast, rows]) => ({
        voteCast,
        memberCount: rows.length,
        matchedCandidateCount: rows.filter((row) => row.candidateId).length,
        totalReceipts: rows.reduce((sum, row) => sum + row.totalReceipts, 0),
        totalIndividualContributions: rows.reduce((sum, row) => {
          const financials = row.candidateId ? lookups.financialsByCandidate.get(row.candidateId) : undefined;
          return sum + (financials?.totalIndividualContributions ?? 0);
        }, 0),
        otherCommitteeContributions: rows.reduce((sum, row) => {
          const financials = row.candidateId ? lookups.financialsByCandidate.get(row.candidateId) : undefined;
          return sum + (financials?.otherCommitteeContributions ?? 0);
        }, 0),
        partyContributions: rows.reduce((sum, row) => {
          const financials = row.candidateId ? lookups.financialsByCandidate.get(row.candidateId) : undefined;
          return sum + (financials?.partyContributions ?? 0);
        }, 0),
        averageReceipts:
          rows.length > 0
            ? rows.reduce((sum, row) => sum + row.totalReceipts, 0) / rows.length
            : 0,
        topMembers: [...rows]
          .sort((left, right) => right.totalReceipts - left.totalReceipts)
          .slice(0, 5),
      }))
      .sort((left, right) => right.memberCount - left.memberCount),
  };
}

export function buildVoteFundingSummaryArtifact(
  artifacts: IngestArtifacts,
): VoteFundingSummaryArtifact {
  const lookups = buildVoteFundingAnalysisMaps(artifacts);

  const house = sortHouseVotesDesc(artifacts.congress.houseVotes)
    .map((vote) =>
      buildVoteFundingAnalysis(
        {
          voteId: vote.voteId,
          billId: vote.billId,
          question: vote.voteQuestion,
          result: vote.result,
        },
        artifacts.congress.houseVoteMemberVotes,
        lookups,
      ),
    )
    .filter((vote): vote is LaunchVoteFundingAnalysis => Boolean(vote));

  const senate = sortSenateVotesDesc(artifacts.congress.senateVotes ?? [])
    .map((vote) =>
      buildVoteFundingAnalysis(
        {
          voteId: vote.voteId,
          billId: vote.billId,
          question: vote.question,
          result: vote.result,
        },
        artifacts.congress.senateVoteMemberVotes ?? [],
        lookups,
      ),
    )
    .filter((vote): vote is LaunchVoteFundingAnalysis => Boolean(vote));

  return {
    generatedAt: new Date().toISOString(),
    house,
    senate,
  };
}

export function buildLaunchSummaryArtifact(
  summary: IngestRunSummary,
  artifacts: IngestArtifacts,
): LaunchSummaryArtifact {
  const latestHouseVote = sortHouseVotesDesc(artifacts.congress.houseVotes)[0];
  const latestSenateVote = sortSenateVotesDesc(artifacts.congress.senateVotes ?? [])[0];
  const lookups = buildVoteFundingAnalysisMaps(artifacts);

  return {
    runId: summary.runId,
    generatedAt: new Date().toISOString(),
    totals: summary.totals,
    topMembers: topMembersFromFinancials(artifacts, artifacts.fec.candidateFinancials),
    topCommittees: topCommitteesFromPacSummaries(artifacts.fec.pacSummaries),
    latestHouseVote: latestHouseVote
      ? {
          voteId: latestHouseVote.voteId,
          billId: latestHouseVote.billId,
          question: latestHouseVote.voteQuestion,
          result: latestHouseVote.result,
        }
      : undefined,
    latestSenateVote: latestSenateVote
      ? {
          voteId: latestSenateVote.voteId,
          billId: latestSenateVote.billId,
          question: latestSenateVote.question,
          result: latestSenateVote.result,
        }
      : undefined,
    latestHouseAnalysis: buildVoteFundingAnalysis(
      latestHouseVote
        ? {
            voteId: latestHouseVote.voteId,
            billId: latestHouseVote.billId,
            question: latestHouseVote.voteQuestion,
            result: latestHouseVote.result,
          }
        : undefined,
      artifacts.congress.houseVoteMemberVotes,
      lookups,
    ),
    latestSenateAnalysis: buildVoteFundingAnalysis(
      latestSenateVote
        ? {
            voteId: latestSenateVote.voteId,
            billId: latestSenateVote.billId,
            question: latestSenateVote.question,
            result: latestSenateVote.result,
          }
        : undefined,
      artifacts.congress.senateVoteMemberVotes ?? [],
      lookups,
    ),
  };
}

export { buildFundingReadModels, slugFromText };
