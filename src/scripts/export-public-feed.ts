import { mkdir, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  readCandidateFinancials,
  readCongressBills,
  readCongressMembers,
  readCongressTrades,
  readCandidateCommitteeLinks,
  readFecCandidates,
  readFecCommittees,
  readFundingReadModels,
  readHouseVoteMemberVotes,
  readHouseVotes,
  readLatestSummary,
  readOutcomeStates,
  readPacSummaries,
  readSenateVoteMemberVotes,
  readSenateVotes,
  readVoteFundingSummaries,
} from "@/lib/ingest/storage";
import type { HouseRollCallMemberVote, SenateRollCallMemberVote } from "@/lib/ingest/types";
import { buildCandidateMemberCrosswalk } from "@/lib/data/crosswalk";

type FeedEntry = {
  id: string;
  label: string;
  href: string;
  datasetPath: string;
  summary?: string;
  amount?: number;
  tags?: string[];
};

type FeedManifest = {
  schemaVersion: 1;
  generatedAt: string;
  runId?: string;
  source: {
    kind: "public-record-read-models";
    note: string;
  };
  datasets: Record<
    string,
    {
      path: string;
      count: number;
      description: string;
    }
  >;
  caveats: string[];
};

const OUT_DIR = path.resolve(
  process.env.POLITIMONEY_FEED_OUT_DIR ??
    process.env.POLITIRED_FEED_OUT_DIR ??
    path.join(process.cwd(), "dist", "public-feed", "latest"),
);

function safeSegment(value: string | number): string {
  return encodeURIComponent(String(value).trim().toLowerCase());
}

function stableShortId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function writeJson(relativePath: string, payload: unknown) {
  const filePath = path.join(OUT_DIR, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function memberName(member: { name?: string; firstName?: string; lastName?: string; bioguideId: string }) {
  return member.name ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ?? member.bioguideId;
}

function mergeDefined<T extends Record<string, unknown>>(target: T, source: T): T {
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value !== null) {
      target[key as keyof T] = value as T[keyof T];
    }
  }
  return target;
}

async function main() {
  const [
    summary,
    funding,
    voteFunding,
    members,
    bills,
    houseVotes,
    senateVotes,
    houseMemberVotes,
    senateMemberVotes,
    states,
    congressTrades,
    candidates,
    committees,
    candidateFinancials,
    candidateCommitteeLinks,
    pacSummaries,
  ] = await Promise.all([
    readLatestSummary(),
    readFundingReadModels(),
    readVoteFundingSummaries(),
    readCongressMembers(),
    readCongressBills(),
    readHouseVotes(),
    readSenateVotes(),
    readHouseVoteMemberVotes(),
    readSenateVoteMemberVotes(),
    readOutcomeStates(),
    readCongressTrades(),
    readFecCandidates(),
    readFecCommittees(),
    readCandidateFinancials(),
    readCandidateCommitteeLinks(),
    readPacSummaries(),
  ]);

  // Build candidate→bioguide crosswalk so member detail JSON can carry a
  // synthesized funding profile when no explicit member-typed read model exists.
  // House crosswalk needs `officeDistrict`; older ingests left it blank, so
  // fill it here from the candidate ID (e.g. `H2CA31125` → district 31).
  const candidatesWithDistrict = candidates.map((c) => {
    if (c.officeDistrict || c.office !== "H") return c;
    if (c.candidateId.length < 6) return c;
    const raw = c.candidateId.slice(4, 6);
    if (!/^[0-9]{2}$/.test(raw)) return c;
    const trimmed = raw.replace(/^0+/, "") || "0";
    return { ...c, officeDistrict: trimmed };
  });
  const crosswalkRows = buildCandidateMemberCrosswalk(candidatesWithDistrict, members, committees);
  const candidateByBioguide = new Map<string, string>();
  for (const row of crosswalkRows) {
    const key = row.bioguideId.toUpperCase();
    if (!candidateByBioguide.has(key)) candidateByBioguide.set(key, row.candidateId);
  }

  function relaxedNameKey(name: string): string {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
  }
  function candidateOfficeFromId(candidateId: string): string {
    return candidateId.slice(0, 1).toUpperCase();
  }
  function candidateStateFromId(candidateId: string): string {
    return candidateId.slice(2, 4).toUpperCase();
  }
  function candidateNameParts(name: string): { first: string; last: string } | null {
    const [last = "", rest = ""] = name.split(",", 2);
    const first = rest.trim().split(/\s+/)[0] ?? "";
    if (!last || !first) return null;
    return { first, last };
  }
  function nameTokens(name: string): string[] {
    const normalized = name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z]+/g, " ")
      .trim();
    return normalized ? normalized.split(/\s+/) : [];
  }
  function equivalentFirstNames(first: string): string[] {
    const value = relaxedNameKey(first);
    const groups = [
      ["andrew", "andy"],
      ["donald", "don"],
      ["james", "jim"],
      ["michael", "mike"],
      ["nicholas", "nick"],
      ["william", "bill"],
    ];
    const group = groups.find((names) => names.includes(value));
    return group ?? [value];
  }
  function memberOffice(chamber?: string): string {
    const value = (chamber ?? "").toLowerCase();
    if (value === "h" || value === "house") return "H";
    if (value === "s" || value === "senate") return "S";
    return chamber ?? "";
  }
  // A candidate may file multiple summary rows (per cycle / amendments). Keep
  // the row with the highest totalReceipts so downstream code sees a single
  // representative figure rather than a cycle-zero amendment.
  const financialsByCandidate = new Map<string, (typeof candidateFinancials)[number]>();
  for (const cf of candidateFinancials) {
    const existing = financialsByCandidate.get(cf.candidateId);
    if (!existing || (cf.totalReceipts ?? 0) > (existing.totalReceipts ?? 0)) {
      financialsByCandidate.set(cf.candidateId, cf);
    }
  }
  // Build last+first key per (state, chamber) bucket from candidates.
  const candidateKeyIndex = new Map<string, string>();
  const candidateLastNameIndex = new Map<string, string | null>();
  const candidateSearchRows: {
    office: string;
    state: string;
    candidateId: string;
    tokens: Set<string>;
    receipts: number;
  }[] = [];
  function addLastNameCandidate(key: string, candidateId: string) {
    if (!candidateLastNameIndex.has(key)) {
      candidateLastNameIndex.set(key, candidateId);
      return;
    }
    const existing = candidateLastNameIndex.get(key);
    if (!existing || existing === candidateId) return;
    candidateLastNameIndex.set(key, null);
  }
  for (const c of candidates) {
    if ((c.office !== "H" && c.office !== "S") || !c.officeState) continue;
    const parts = candidateNameParts(c.name);
    if (!parts) continue;
    const key = `${c.office}|${c.officeState.toUpperCase()}|${relaxedNameKey(parts.last)}|${relaxedNameKey(parts.first)}`;
    if (!candidateKeyIndex.has(key)) candidateKeyIndex.set(key, c.candidateId);
    addLastNameCandidate(`${c.office}|${c.officeState.toUpperCase()}|${relaxedNameKey(parts.last)}`, c.candidateId);
    candidateSearchRows.push({
      office: c.office,
      state: c.officeState.toUpperCase(),
      candidateId: c.candidateId,
      tokens: new Set(nameTokens(c.name)),
      receipts: financialsByCandidate.get(c.candidateId)?.totalReceipts ?? 0,
    });
  }
  for (const cf of candidateFinancials) {
    const office = candidateOfficeFromId(cf.candidateId);
    const state = candidateStateFromId(cf.candidateId);
    if ((office !== "H" && office !== "S") || !state) continue;
    const parts = candidateNameParts(cf.name);
    if (!parts) continue;
    const key = `${office}|${state}|${relaxedNameKey(parts.last)}|${relaxedNameKey(parts.first)}`;
    const existing = candidateKeyIndex.get(key);
    const existingFinancials = existing ? financialsByCandidate.get(existing) : null;
    if (!existing || (cf.totalReceipts ?? 0) > (existingFinancials?.totalReceipts ?? 0)) {
      candidateKeyIndex.set(key, cf.candidateId);
    }
    addLastNameCandidate(`${office}|${state}|${relaxedNameKey(parts.last)}`, cf.candidateId);
    candidateSearchRows.push({
      office,
      state,
      candidateId: cf.candidateId,
      tokens: new Set(nameTokens(cf.name)),
      receipts: cf.totalReceipts ?? 0,
    });
  }
  function fuzzyCandidateId(office: string, state: string, firstName: string, lastName: string) {
    const firstNames = new Set(equivalentFirstNames(firstName));
    const lastTokens = nameTokens(lastName);
    if (lastTokens.length === 0) return null;
    const matches = candidateSearchRows.filter((row) => {
      if (row.office !== office || row.state !== state) return false;
      const hasLast = lastTokens.every((token) => row.tokens.has(token));
      const hasFirst = [...firstNames].some((token) => row.tokens.has(token));
      return hasLast && hasFirst;
    });
    if (matches.length === 0) return null;
    matches.sort((a, b) => b.receipts - a.receipts);
    return matches[0]?.candidateId ?? null;
  }
  for (const member of members) {
    if (candidateByBioguide.has(member.bioguideId.toUpperCase())) continue;
    if (!member.chamber || !member.state) continue;
    const memberName = member.name;
    const [last = "", rest = ""] = memberName.includes(",")
      ? memberName.split(",", 2)
      : ["", ""];
    let first = "";
    let lastName = last;
    if (memberName.includes(",")) {
      first = rest.trim().split(/\s+/)[0] ?? "";
    } else {
      const tokens = memberName.trim().split(/\s+/);
      first = tokens[0] ?? "";
      lastName = tokens[tokens.length - 1] ?? "";
    }
    if (!lastName || !first) continue;
    const office = memberOffice(member.chamber);
    const state = member.state.toUpperCase();
    const key = `${office}|${state}|${relaxedNameKey(lastName)}|${relaxedNameKey(first)}`;
    const candidateId =
      candidateKeyIndex.get(key) ??
      candidateLastNameIndex.get(
        `${office}|${state}|${relaxedNameKey(lastName)}`,
      ) ??
      fuzzyCandidateId(office, state, first, lastName);
    if (candidateId) candidateByBioguide.set(member.bioguideId.toUpperCase(), candidateId);
  }
  const candidateProfileById = new Map(
    (funding?.profiles ?? [])
      .filter((p) => p.entityType === "candidate")
      .map((p) => [p.entityId.toUpperCase(), p]),
  );
  const committeeProfiles = (funding?.profiles ?? []).filter(
    (profile) => profile.entityType === "committee",
  );
  const committeeProfileById = new Map(
    committeeProfiles.map((profile) => [profile.entityId.toUpperCase(), profile]),
  );
  const pacSummaryById = new Map(
    pacSummaries.map((summary) => [summary.committeeId.toUpperCase(), summary]),
  );
  const committeeIdsByCandidate = new Map<string, Set<string>>();
  function addCandidateCommittee(candidateId: string, committeeId?: string) {
    if (!committeeId) return;
    const key = candidateId.toUpperCase();
    const existing = committeeIdsByCandidate.get(key) ?? new Set<string>();
    existing.add(committeeId.toUpperCase());
    committeeIdsByCandidate.set(key, existing);
  }
  for (const c of candidates) {
    for (const committeeId of c.principalCommittees ?? []) {
      addCandidateCommittee(c.candidateId, committeeId);
    }
  }
  for (const link of candidateCommitteeLinks) {
    if (link.committeeDesignation === "P" || link.committeeDesignation === "A") {
      addCandidateCommittee(link.candidateId, link.committeeId);
    }
  }

  function committeeFundingFallback(candidateId: string, profileCommitteeIds?: string[]) {
    const committeeIds = [
      ...new Set([
        ...(profileCommitteeIds ?? []),
        ...[...(committeeIdsByCandidate.get(candidateId.toUpperCase()) ?? [])],
      ].map((id) => id.toUpperCase())),
    ];
    if (committeeIds.length === 0) return null;
    const totals = {
      committeeIds,
      totalReceipts: 0,
      totalDisbursements: 0,
      cashOnHand: 0,
      independentExpenditures: 0,
    };
    for (const committeeId of committeeIds) {
      const profile = committeeProfileById.get(committeeId);
      const summary = pacSummaryById.get(committeeId);
      totals.totalReceipts += Number(profile?.totalReceipts ?? summary?.totalReceipts ?? 0);
      totals.totalDisbursements += Number(profile?.totalDisbursements ?? summary?.totalDisbursements ?? 0);
      totals.cashOnHand += Number(profile?.cashOnHand ?? summary?.cashOnHand ?? 0);
      totals.independentExpenditures += Number(profile?.independentExpenditures ?? summary?.independentExpenditures ?? 0);
    }
    return totals.totalReceipts > 0 ? totals : null;
  }

  function memberFundingProfile(bioguideId: string, label: string): unknown | null {
    const candidateId = candidateByBioguide.get(bioguideId.toUpperCase());
    if (!candidateId) return null;
    const candidateProfile = candidateProfileById.get(candidateId.toUpperCase());
    const financials = financialsByCandidate.get(candidateId);
    const committeeFallback = committeeFundingFallback(candidateId, candidateProfile?.committeeIds);
    if (!candidateProfile && !financials && !committeeFallback) return null;

    const totalReceipts =
      (candidateProfile?.totalReceipts ?? 0) > 0
        ? (candidateProfile?.totalReceipts as number)
        : (financials?.totalReceipts ?? 0) > 0
          ? (financials?.totalReceipts as number)
          : (committeeFallback?.totalReceipts ?? 0);
    const totalIndividualContributions =
      financials?.totalIndividualContributions ?? candidateProfile?.totalIndividualContributions ?? 0;
    const otherCommitteeContributions =
      financials?.otherCommitteeContributions ?? candidateProfile?.otherCommitteeContributions ?? 0;
    const partyContributions =
      financials?.partyContributions ?? candidateProfile?.partyContributions ?? 0;
    const independentExpenditures = candidateProfile?.independentExpenditures ?? 0;

    const sources = [
      { label: "Individual contributions", amount: totalIndividualContributions },
      { label: "Other committee contributions", amount: otherCommitteeContributions },
      { label: "Party contributions", amount: partyContributions },
      { label: "Independent expenditures", amount: independentExpenditures },
    ];
    const sourceTotal = sources.reduce((sum, s) => sum + (s.amount ?? 0), 0);
    const sourceBreakdown = sources
      .filter((s) => (s.amount ?? 0) > 0)
      .map((s) => ({
        label: s.label,
        amount: s.amount,
        share: sourceTotal > 0 ? (s.amount ?? 0) / sourceTotal : 0,
      }));

    return {
      entityType: "member",
      entityId: bioguideId,
      label,
      linkedBioguideId: bioguideId,
      linkedCandidateId: candidateId,
      committeeIds: candidateProfile?.committeeIds ?? committeeFallback?.committeeIds ?? [],
      totalReceipts,
      totalIndividualContributions,
      otherCommitteeContributions,
      partyContributions,
      independentExpenditures,
      totalDisbursements: financials?.totalDisbursements ?? committeeFallback?.totalDisbursements,
      cashOnHand: financials?.cashOnHand ?? committeeFallback?.cashOnHand,
      uniqueDonors: candidateProfile?.uniqueDonors ?? 0,
      contributionRows: candidateProfile?.contributionRows ?? 0,
      topDonors: (candidateProfile?.topDonors ?? []).map((d: { donor?: string; total?: number }) => ({
        name: d.donor ?? "",
        amount: Number(d.total ?? 0),
      })),
      sourceBreakdown,
    };
  }

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const profileByMember = new Map(
    (funding?.profiles ?? [])
      .filter((profile) => profile.entityType === "member")
      .map((profile) => [profile.entityId.toLowerCase(), profile]),
  );
  const committeeById = new Map(
    committees.map((committee) => [committee.committeeId.toUpperCase(), committee]),
  );

  const memberIndex: FeedEntry[] = members.map((member) => {
    const id = safeSegment(member.bioguideId);
    const profile = profileByMember.get(member.bioguideId.toLowerCase());
    const synthesized = profile ? null : memberFundingProfile(member.bioguideId, memberName(member));
    return {
      id: member.bioguideId,
      label: memberName(member),
      href: `/members/${id}`,
      datasetPath: `members/${id}.json`,
      summary: `${member.partyCode ?? member.party ?? "Unknown"}-${member.state}`,
      amount: profile?.totalReceipts ?? (synthesized as { totalReceipts?: number } | null)?.totalReceipts,
      tags: [member.chamber, member.state, member.partyCode ?? member.party ?? ""].filter(Boolean),
    };
  });

  const houseVoteById = new Map(houseVotes.map((vote) => [vote.voteId, vote]));
  const senateVoteById = new Map(senateVotes.map((vote) => [vote.voteId, vote]));

  function enrichMemberVote(
    memberVote: HouseRollCallMemberVote | SenateRollCallMemberVote,
    chamber: "H" | "S",
  ) {
    if (chamber === "H") {
      const vote = houseVoteById.get(memberVote.voteId);
      return {
        voteId: memberVote.voteId,
        chamber,
        voteCast: memberVote.voteCast,
        voteParty: memberVote.voteParty,
        voteState: memberVote.voteState,
        question: vote?.voteQuestion,
        result: vote?.result,
        startDate: vote?.startDate,
        rollCallNumber: vote?.rollCallNumber,
        congress: vote?.congress,
        billId: vote?.billId,
      };
    }
    const vote = senateVoteById.get(memberVote.voteId);
    return {
      voteId: memberVote.voteId,
      chamber,
      voteCast: memberVote.voteCast,
      voteParty: memberVote.voteParty,
      voteState: memberVote.voteState,
      question: vote?.question ?? vote?.voteQuestionText ?? vote?.voteTitle,
      result: vote?.resultText ?? vote?.result,
      startDate: vote?.voteDate,
      rollCallNumber: vote?.rollCallNumber,
      congress: vote?.congress,
      billId: vote?.billId,
    };
  }

  for (const member of members) {
    const id = safeSegment(member.bioguideId);
    const explicitProfile = profileByMember.get(member.bioguideId.toLowerCase());
    const fundingProfile =
      explicitProfile ?? memberFundingProfile(member.bioguideId, memberName(member));
    const bioguide = member.bioguideId.toLowerCase();
    const memberRecentVotes = [
      ...houseMemberVotes
        .filter((vote) => vote.bioguideId.toLowerCase() === bioguide)
        .map((vote) => enrichMemberVote(vote, "H")),
      ...senateMemberVotes
        .filter((vote) => vote.bioguideId.toLowerCase() === bioguide)
        .map((vote) => enrichMemberVote(vote, "S")),
    ]
      .sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? ""))
      .slice(0, 100);
    await writeJson(`members/${id}.json`, {
      entityType: "member",
      member,
      funding: fundingProfile ?? null,
      recentVotes: memberRecentVotes,
      caveats: [
        "Funding records are campaign and committee filings, not proof of motive.",
        "Vote records and funding records are colocated for inspection, not proof of cause and effect.",
      ],
    });
  }

  const pacIds = [
    ...new Set([
      ...pacSummaries.map((summary) => summary.committeeId.toUpperCase()),
      ...committees.map((committee) => committee.committeeId.toUpperCase()),
      ...committeeProfiles.map((profile) => profile.entityId.toUpperCase()),
    ]),
  ];
  const pacProfiles = pacIds.map((committeeId) => {
    const profile = committeeProfileById.get(committeeId);
    const summary = pacSummaryById.get(committeeId);
    const committee = committeeById.get(committeeId);
    return {
      ...(profile ?? {}),
      entityType: "committee",
      entityId: committeeId,
      label: profile?.label ?? summary?.name ?? committee?.name ?? committeeId,
      committeeIds: profile?.committeeIds ?? [committeeId],
      committeeType: summary?.committeeType ?? committee?.committeeType,
      designation: summary?.designation ?? committee?.designation,
      party: summary?.party ?? committee?.party,
      totalReceipts: profile?.totalReceipts ?? summary?.totalReceipts ?? 0,
      totalDisbursements: profile?.totalDisbursements ?? summary?.totalDisbursements ?? 0,
      cashOnHand: profile?.cashOnHand ?? summary?.cashOnHand ?? 0,
      independentExpenditures: profile?.independentExpenditures ?? summary?.independentExpenditures ?? 0,
    };
  });

  const pacIndex: FeedEntry[] = pacProfiles.map((profile) => {
    const id = safeSegment(profile.entityId);
    return {
      id: profile.entityId,
      label: profile.label,
      href: `/pacs/${id}`,
      datasetPath: `pacs/${id}.json`,
      amount: profile.totalReceipts,
      tags: ["committee"],
    };
  });

  for (const profile of pacProfiles) {
    const id = safeSegment(profile.entityId);
    await writeJson(`pacs/${id}.json`, {
      entityType: "committee",
      profile,
      caveats: [
        "Committee totals reflect public FEC filings loaded into this feed.",
        "Independent expenditures, transfers, and direct receipts should be interpreted separately.",
      ],
    });
  }

  const donorIndex: FeedEntry[] = (funding?.donors ?? []).map((donor) => {
    const id = safeSegment(donor.id);
    return {
      id: donor.id,
      label: donor.donor,
      href: `/donors/${id}`,
      datasetPath: `donors/${id}.json`,
      amount: donor.totalContributed,
      tags: [donor.donorType, donor.donorState ?? ""].filter(Boolean),
    };
  });

  for (const donor of funding?.donors ?? []) {
    await writeJson(`donors/${safeSegment(donor.id)}.json`, {
      entityType: "donor",
      donor,
      caveats: [
        "Donor names can collide; use employer, occupation, state, recipient, and source records before drawing conclusions.",
        "Contribution records do not establish policy influence or quid pro quo arrangements.",
      ],
    });
  }

  const billKey = (bill: (typeof bills)[number]) =>
    `${bill.congress}-${bill.billType}-${bill.billNumber}`;

  const billIndex: FeedEntry[] = bills.map((bill) => {
    const key = billKey(bill);
    const id = safeSegment(key);
    return {
      id: key,
      label: bill.title,
      href: `/bills/${id}`,
      datasetPath: `bills/${id}.json`,
      summary: `${bill.billType?.toUpperCase?.() ?? "Bill"} ${bill.billNumber ?? ""}`.trim(),
      tags: [String(bill.congress), bill.billType ?? ""].filter(Boolean),
    };
  });

  for (const bill of bills) {
    const key = billKey(bill);
    await writeJson(`bills/${safeSegment(key)}.json`, {
      entityType: "bill",
      bill,
      linkedVotes: [...houseVotes, ...senateVotes].filter((vote) => vote.billId === key),
      caveats: ["Bill metadata comes from congressional public records and may lag official updates."],
    });
  }

  const houseFundingByVote = new Map((voteFunding?.house ?? []).map((vote) => [vote.voteId, vote]));
  const senateFundingByVote = new Map((voteFunding?.senate ?? []).map((vote) => [vote.voteId, vote]));
  const voteIndex: FeedEntry[] = [
    ...houseVotes.map((vote) => ({
      id: vote.voteId,
      label: vote.voteQuestion ?? `House roll call ${vote.rollCallNumber}`,
      href: `/votes/house/${safeSegment(vote.voteId)}`,
      datasetPath: `votes/house/${safeSegment(vote.voteId)}.json`,
      summary: vote.result,
      tags: ["house", String(vote.congress), String(vote.rollCallNumber)],
    })),
    ...senateVotes.map((vote) => ({
      id: vote.voteId,
      label: vote.question ?? `Senate roll call ${vote.rollCallNumber}`,
      href: `/votes/senate/${safeSegment(vote.voteId)}`,
      datasetPath: `votes/senate/${safeSegment(vote.voteId)}.json`,
      summary: vote.resultText ?? vote.result,
      tags: ["senate", String(vote.congress), String(vote.rollCallNumber)],
    })),
  ];

  for (const vote of houseVotes) {
    await writeJson(`votes/house/${safeSegment(vote.voteId)}.json`, {
      entityType: "vote",
      chamber: "H",
      vote,
      memberVotes: houseMemberVotes.filter((memberVote) => memberVote.voteId === vote.voteId),
      funding: houseFundingByVote.get(vote.voteId) ?? null,
      caveats: ["Funding groups show public money records around vote positions, not proof of cause and effect."],
    });
  }

  for (const vote of senateVotes) {
    await writeJson(`votes/senate/${safeSegment(vote.voteId)}.json`, {
      entityType: "vote",
      chamber: "S",
      vote,
      memberVotes: senateMemberVotes.filter((memberVote) => memberVote.voteId === vote.voteId),
      funding: senateFundingByVote.get(vote.voteId) ?? null,
      caveats: ["Funding groups show public money records around vote positions, not proof of cause and effect."],
    });
  }

  const stateByCode = new Map<string, (typeof states)[number]>();
  for (const state of states) {
    const existing = stateByCode.get(state.stateCode);
    stateByCode.set(
      state.stateCode,
      existing ? mergeDefined({ ...existing }, state) : state,
    );
  }
  const uniqueStates = [...stateByCode.values()].sort((left, right) =>
    left.stateName.localeCompare(right.stateName),
  );

  const stateIndex: FeedEntry[] = uniqueStates.map((state) => {
    const id = safeSegment(state.stateCode);
    return {
      id: state.stateCode,
      label: state.stateName,
      href: `/states/${id}`,
      datasetPath: `states/${id}.json`,
      summary: "State outcome metrics",
      tags: ["state-outcomes"],
    };
  });

  for (const state of uniqueStates) {
    await writeJson(`states/${safeSegment(state.stateCode)}.json`, {
      entityType: "state",
      state,
      caveats: ["Outcome metrics are contextual benchmarks and should not be treated as proof that one policy or factor caused an outcome."],
    });
  }

  await writeJson("indexes/members.json", memberIndex);
  await writeJson("indexes/pacs.json", pacIndex);
  await writeJson("indexes/donors.json", donorIndex);
  await writeJson("indexes/bills.json", billIndex);
  await writeJson("indexes/votes.json", voteIndex);
  await writeJson("indexes/states.json", stateIndex);

  const congressTradeIndex: FeedEntry[] = congressTrades.map((trade, index) => {
    const id = `${safeSegment(trade.docId)}-${index + 1}-${stableShortId(JSON.stringify(trade))}`;
    return {
      id,
      label: `${trade.memberName}: ${trade.transactionLabel} ${trade.ticker ?? trade.assetName}`,
      href: `/congress-trades/${id}`,
      datasetPath: `congress-trades/${id}.json`,
      summary: `${trade.transactionDate} · ${trade.amountRange}`,
      tags: [trade.chamber, trade.state, trade.transactionType, trade.ticker ?? ""].filter(Boolean),
    };
  });

  for (const [index, trade] of congressTrades.entries()) {
    const id = `${safeSegment(trade.docId)}-${index + 1}-${stableShortId(JSON.stringify(trade))}`;
    await writeJson(`congress-trades/${id}.json`, {
      entityType: "congress-trade",
      trade,
      caveats: [
        "Congressional trade records are self-reported STOCK Act disclosures parsed from original PDFs.",
        "Amount values are reported ranges, not exact transaction values.",
        "These records do not establish illegality, motive, or material nonpublic information.",
      ],
    });
  }
  await writeJson("indexes/congress-trades.json", congressTradeIndex);

  const manifest: FeedManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: summary?.runId,
    source: {
      kind: "public-record-read-models",
      note: "Portable public feed for static hosting, R2, Workers, MCP clients, and local LLM workflows.",
    },
    datasets: {
      members: {
        path: "indexes/members.json",
        count: memberIndex.length,
        description: "Member index with links to per-member funding and vote records.",
      },
      pacs: {
        path: "indexes/pacs.json",
        count: pacIndex.length,
        description: "Committee/PAC index with links to per-committee funding profiles.",
      },
      donors: {
        path: "indexes/donors.json",
        count: donorIndex.length,
        description: "Donor index derived from loaded FEC contribution records.",
      },
      bills: {
        path: "indexes/bills.json",
        count: billIndex.length,
        description: "Congressional bill index with linked vote references.",
      },
      votes: {
        path: "indexes/votes.json",
        count: voteIndex.length,
        description: "House and Senate vote index with per-vote member positions and funding groups.",
      },
      states: {
        path: "indexes/states.json",
        count: stateIndex.length,
        description: "State outcome metric index.",
      },
      congressTrades: {
        path: "indexes/congress-trades.json",
        count: congressTradeIndex.length,
        description: "Parsed congressional STOCK Act transaction rows with source PDF links.",
      },
    },
    caveats: [
      "This feed intentionally excludes raw bulk contribution files by default to keep public hosting cheap and route reads small.",
      "Users can regenerate larger local datasets from public APIs and bulk files with their own free API keys.",
      "Records show public filings and official actions; they do not, by themselves, prove motive, loyalty, or cause and effect.",
    ],
  };

  await writeJson("manifest.json", manifest);
  console.log(`Exported public feed to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
