import {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getCommitteeRecipientsRepository,
  getDonorProfileRepository,
  getDonorProfilesRepository,
  getFundingProfileRepository,
  getLatestBillEntitiesRepository,
  getLatestCongressMembersRepository,
  getLatestCountryInfluenceEntitiesRepository,
  getLatestOrganizationEntitiesRepository,
  getRecentMemberVotePositionsRepository,
  rankEntitiesRepository,
} from "@/lib/data/repository";

export type ShareCardKind = "member" | "committee" | "bill" | "country" | "donor";

export type ShareCardData = {
  kind: ShareCardKind;
  entityId: string;
  title: string;
  eyebrow: string;
  subtitle: string;
  summary: string;
  stats: Array<{ label: string; value: string }>;
  bullets: string[];
  profileHref: string;
  profileLabel: string;
  shareHref: string;
};

export type ShareCardExample = {
  kind: ShareCardKind;
  href: string;
  label: string;
  detail: string;
};

function formatCurrency(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function donorTypeLabel(donorType: "person" | "organization" | "unknown"): string {
  if (donorType === "person") return "Person donor";
  if (donorType === "organization") return "Organization donor";
  return "Unclassified donor";
}

function formatDisplayDate(value: string | undefined): string {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-US");
}

function buildSearchHref(query: string): string {
  return `/search?q=${encodeURIComponent(query)}`;
}

export function buildShareHref(kind: ShareCardKind, id: string): string {
  return `/share/${kind}/${id.toLowerCase()}`;
}

function sumMemberCount(
  analysis:
    | Awaited<ReturnType<typeof analyzeHouseVoteFundingRepository>>
    | Awaited<ReturnType<typeof analyzeSenateVoteFundingRepository>>
    | null,
): number {
  return analysis?.groups.reduce((sum, group) => sum + group.memberCount, 0) ?? 0;
}

function sumReceipts(
  analysis:
    | Awaited<ReturnType<typeof analyzeHouseVoteFundingRepository>>
    | Awaited<ReturnType<typeof analyzeSenateVoteFundingRepository>>
    | null,
): number {
  return analysis?.groups.reduce((sum, group) => sum + group.totalReceipts, 0) ?? 0;
}

export async function getShareCardData(
  kind: string,
  rawId: string,
): Promise<ShareCardData | null> {
  const normalizedId = rawId.trim().toLowerCase();

  if (kind === "member") {
    const members = await getLatestCongressMembersRepository();
    const member = members.find(
      (row) => row.bioguideId.toLowerCase() === normalizedId,
    );
    if (!member) return null;

    const fundingProfile = await getFundingProfileRepository(member.bioguideId);
    if (!fundingProfile) return null;

    const votes = await getRecentMemberVotePositionsRepository({
      bioguideId: member.bioguideId,
      chamber: member.chamber,
      limit: 3,
    });
    const topDonor = fundingProfile.topDonors[0];
    const chamberLabel = member.chamber === "S" ? "Senate" : "House";
    const profileHref =
      member.chamber === "S"
        ? `/explore/senators/${member.bioguideId.toLowerCase()}`
        : buildSearchHref(member.name);

    return {
      kind: "member",
      entityId: member.bioguideId,
      title: member.directOrderName ?? member.name,
      eyebrow: "Member Share Card",
      subtitle: `${member.party ?? "Unknown party"} · ${member.state} · ${chamberLabel}`,
      summary: `${member.directOrderName ?? member.name} is linked to ${formatCurrency(fundingProfile.totalReceipts)} in receipts across ${fundingProfile.committeeIds.length} mapped committees in the current Politired corpus.`,
      stats: [
        { label: "Linked receipts", value: formatCurrency(fundingProfile.totalReceipts) },
        { label: "Unique donors", value: formatCompact(fundingProfile.uniqueDonors) },
        { label: "Committees", value: String(fundingProfile.committeeIds.length) },
        { label: "Tracked votes", value: String(votes.length) },
      ],
      bullets: [
        topDonor
          ? `Largest visible donor: ${topDonor.donor} (${formatCurrency(Number(topDonor.total))})`
          : "No named donor rows are currently visible for this member.",
        votes[0]
          ? `Latest tracked ${chamberLabel.toLowerCase()} vote: ${votes[0].voteCast} on ${votes[0].billId ?? votes[0].question ?? "an unlinked roll call"}`
          : `No recent ${chamberLabel.toLowerCase()} votes are currently linked for this member.`,
        fundingProfile.linkedCandidateId
          ? `Mapped campaign candidate ID: ${fundingProfile.linkedCandidateId}.`
          : "Campaign crosswalk is still pending for this member.",
      ],
      profileHref,
      profileLabel:
        member.chamber === "S" ? "Open member profile" : "Search this member",
      shareHref: buildShareHref("member", member.bioguideId),
    };
  }

  if (kind === "committee") {
    const organizations = await getLatestOrganizationEntitiesRepository();
    const organization = organizations.find(
      (row) =>
        row.id === normalizedId || row.committeeId.toLowerCase() === normalizedId,
    );
    if (!organization) return null;

    const [fundingProfile, recipients] = await Promise.all([
      getFundingProfileRepository(organization.committeeId),
      getCommitteeRecipientsRepository(organization.committeeId, 3),
    ]);
    if (!fundingProfile) return null;

    return {
      kind: "committee",
      entityId: organization.id,
      title: organization.name,
      eyebrow: "Committee Share Card",
      subtitle: `${organization.issue} · ${organization.linkedOfficials} linked officeholders`,
      summary: `${organization.name} shows ${formatCurrency(fundingProfile.totalReceipts)} in receipts with ${recipients.length} visible recipient candidates in the current Politired corpus.`,
      stats: [
        { label: "Receipts", value: formatCurrency(fundingProfile.totalReceipts) },
        { label: "Unique donors", value: formatCompact(fundingProfile.uniqueDonors) },
        { label: "Recipients", value: String(recipients.length) },
        { label: "Linked officials", value: String(organization.linkedOfficials) },
      ],
      bullets: [
        fundingProfile.topDonors[0]
          ? `Largest visible donor: ${fundingProfile.topDonors[0].donor} (${formatCurrency(Number(fundingProfile.topDonors[0].total))})`
          : "No named donor rows are currently visible for this committee.",
        recipients[0]
          ? `Top visible recipient: ${recipients[0].label} (${formatCurrency(recipients[0].totalSupport)})`
          : "No committee-to-candidate support rows are currently visible for this committee.",
        organization.note,
      ],
      profileHref: `/explore/organizations/${organization.id}`,
      profileLabel: "Open committee profile",
      shareHref: buildShareHref("committee", organization.id),
    };
  }

  if (kind === "bill") {
    const bills = await getLatestBillEntitiesRepository();
    const bill = bills.find((row) => row.id === normalizedId);
    if (!bill) return null;

    const [houseAnalysis, senateAnalysis] = await Promise.all([
      analyzeHouseVoteFundingRepository({ billId: bill.id.toUpperCase() }),
      analyzeSenateVoteFundingRepository({ billId: bill.id.toUpperCase() }),
    ]);

    const houseMembers = sumMemberCount(houseAnalysis);
    const senateMembers = sumMemberCount(senateAnalysis);

    return {
      kind: "bill",
      entityId: bill.id,
      title: `${bill.billType.toUpperCase()} ${bill.billNumber}`,
      eyebrow: "Bill Share Card",
      subtitle: bill.title,
      summary: `${bill.billType.toUpperCase()} ${bill.billNumber} can now be checked against House and Senate funding splits when roll-call data exists for the bill.`,
      stats: [
        { label: "Latest action", value: formatDisplayDate(bill.latestActionDate) },
        { label: "Sponsor", value: bill.sponsor },
        { label: "House votes", value: String(houseMembers) },
        { label: "Senate votes", value: String(senateMembers) },
      ],
      bullets: [
        `House-linked receipts in grouped vote analysis: ${formatCurrency(sumReceipts(houseAnalysis))}.`,
        `Senate-linked receipts in grouped vote analysis: ${formatCurrency(sumReceipts(senateAnalysis))}.`,
        bill.status,
      ],
      profileHref: `/explore/bills/${bill.id}`,
      profileLabel: "Open bill profile",
      shareHref: buildShareHref("bill", bill.id),
    };
  }

  if (kind === "country") {
    const countries = await getLatestCountryInfluenceEntitiesRepository();
    const country = countries.find((row) => row.id === normalizedId);
    if (!country) return null;

    return {
      kind: "country",
      entityId: country.id,
      title: country.name,
      eyebrow: "Country Share Card",
      subtitle: "FARA-linked influence profile",
      summary: `${country.name} appears in ${country.principalCount.toLocaleString()} sampled foreign-principal rows across ${country.registrantCount.toLocaleString()} registrants in the current Politired corpus.`,
      stats: [
        { label: "Principal rows", value: formatCompact(country.principalCount) },
        { label: "Registrants", value: formatCompact(country.registrantCount) },
        { label: "Named principals", value: String(country.topPrincipals.length) },
        { label: "Claim level", value: "Disclosure" },
      ],
      bullets: [
        country.topPrincipals[0]
          ? `Named principal example: ${country.topPrincipals[0]}.`
          : "No named principals are currently visible for this country.",
        country.topPrincipals[1]
          ? `Additional tracked principal: ${country.topPrincipals[1]}.`
          : "Additional principal examples are not currently visible.",
        country.caution,
      ],
      profileHref: `/explore/countries/${country.id}`,
      profileLabel: "Open country profile",
      shareHref: buildShareHref("country", country.id),
    };
  }

  if (kind === "donor") {
    const donor = await getDonorProfileRepository(rawId);
    if (!donor) return null;

    return {
      kind: "donor",
      entityId: donor.id,
      title: donor.donor,
      eyebrow: "Donor Share Card",
      subtitle:
        donor.donorEmployer ??
        donor.donorOccupation ??
        donor.donorState ??
        donorTypeLabel(donor.donorType),
      summary: `${donor.donor} appears in ${donor.contributionRows.toLocaleString()} visible contribution rows totaling ${formatCurrency(donor.totalContributed)} across ${donor.recipientCount.toLocaleString()} recipient entities in the current Politired corpus.`,
      stats: [
        { label: "Visible total", value: formatCurrency(donor.totalContributed) },
        { label: "Contribution rows", value: formatCompact(donor.contributionRows) },
        { label: "Recipients", value: formatCompact(donor.recipientCount) },
        { label: "Top flow", value: donor.topRecipients[0] ? formatCurrency(donor.topRecipients[0].total) : "$0" },
      ],
      bullets: [
        donor.topRecipients[0]
          ? `Top visible recipient: ${donor.topRecipients[0].label} (${formatCurrency(donor.topRecipients[0].total)}).`
          : "No recipient entities are currently visible for this donor.",
        `Classification: ${donorTypeLabel(donor.donorType)}.`,
        donor.donorEmployer
          ? `Employer shown in visible rows: ${donor.donorEmployer}.`
          : "Employer metadata is not currently visible for this donor.",
        "Visible donor flows reflect the current contribution sample, not a complete map of all political influence.",
      ],
      profileHref: `/explore/donors/${donor.id}`,
      profileLabel: "Open donor profile",
      shareHref: buildShareHref("donor", donor.id),
    };
  }

  return null;
}

export async function getShareCardExamples(): Promise<ShareCardExample[]> {
  const [topMembers, topCommittees, bills, countries, donors] = await Promise.all([
    rankEntitiesRepository({ type: "member", limit: 2 }),
    rankEntitiesRepository({ type: "committee", limit: 2 }),
    getLatestBillEntitiesRepository(),
    getLatestCountryInfluenceEntitiesRepository(),
    getDonorProfilesRepository(2),
  ]);

  const examples: ShareCardExample[] = [];

  for (const member of topMembers) {
    examples.push({
      kind: "member",
      href: buildShareHref("member", member.id),
      label: member.label,
      detail: `${formatCurrency(member.totalReceipts)} linked receipts`,
    });
  }

  for (const committee of topCommittees) {
    examples.push({
      kind: "committee",
      href: buildShareHref("committee", committee.id),
      label: committee.label,
      detail: `${formatCurrency(committee.totalReceipts)} visible receipts`,
    });
  }

  if (bills[0]) {
    examples.push({
      kind: "bill",
      href: buildShareHref("bill", bills[0].id),
      label: `${bills[0].billType.toUpperCase()} ${bills[0].billNumber}`,
      detail: bills[0].title,
    });
  }

  if (countries[0]) {
    examples.push({
      kind: "country",
      href: buildShareHref("country", countries[0].id),
      label: countries[0].name,
      detail: `${countries[0].principalCount.toLocaleString()} principal rows`,
    });
  }

  for (const donor of donors) {
    examples.push({
      kind: "donor",
      href: buildShareHref("donor", donor.id),
      label: donor.donor,
      detail: `${formatCurrency(donor.totalContributed)} visible donor flow`,
    });
  }

  return examples.slice(0, 8);
}
