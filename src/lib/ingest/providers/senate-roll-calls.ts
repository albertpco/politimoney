import { fetchText } from "@/lib/ingest/http";
import type {
  CongressMember,
  CongressMembership,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";

type SenateVoteSummaryRow = {
  voteNumber: number;
  issue?: string;
  question?: string;
  result?: string;
  title?: string;
};

type SenatorLookupRow = {
  bioguideId: string;
  congress: number;
  state: string;
  partyCode?: string;
  name: string;
  directOrderName?: string;
  firstName?: string;
  lastName?: string;
};

function yearToCongress(year: number): number {
  return Math.floor((year - 1789) / 2) + 1;
}

function stripTags(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " "));
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || undefined;
}

function normalizeNameToken(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function extractBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  const matches: string[] = [];
  for (const match of xml.matchAll(pattern)) {
    matches.push(match[1]);
  }
  return matches;
}

function extractFirstTag(xml: string, tag: string): string | undefined {
  const block = extractBlocks(xml, tag)[0];
  return normalizeWhitespace(block ? stripTags(block) : undefined);
}

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildSenateVoteId(
  congress: number,
  session: number,
  rollCallNumber: number,
): string {
  return `S-${congress}-${session}-${rollCallNumber}`;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchSenateXml(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchText(url, {
        headers: {
          "User-Agent": "Politired/0.1 Senate Roll Call Ingest",
          Referer: "https://www.senate.gov/",
        },
      });
    } catch (error) {
      lastError = error;
      await sleep(250 * (attempt + 1));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown Senate XML fetch error");
}

function buildBillIdFromDocument(
  congress: number,
  documentType: string | undefined,
  documentNumber: string | undefined,
): string | undefined {
  if (!documentType || !documentNumber) return undefined;
  const normalizedType = documentType.toUpperCase().replace(/[^A-Z]/g, "");
  const normalizedNumber = documentNumber.replace(/[^0-9]/g, "");
  if (!normalizedNumber) return undefined;
  if (!["HR", "HJRES", "HCONRES", "HRES", "S", "SJRES", "SCONRES", "SRES"].includes(normalizedType)) {
    return undefined;
  }
  return `${congress}-${normalizedType}-${normalizedNumber}`;
}

function parseSummaryVotes(xml: string): SenateVoteSummaryRow[] {
  return extractBlocks(xml, "vote")
    .map((block) => ({
      voteNumber: parseInteger(extractFirstTag(block, "vote_number")) ?? 0,
      issue: extractFirstTag(block, "issue"),
      question: extractFirstTag(block, "question"),
      result: extractFirstTag(block, "result"),
      title: extractFirstTag(block, "title"),
    }))
    .filter((row) => row.voteNumber > 0);
}

function firstNameCompatible(left: string | undefined, right: string | undefined): boolean {
  const normalizedLeft = normalizeNameToken(left);
  const normalizedRight = normalizeNameToken(right);
  if (!normalizedLeft || !normalizedRight) return true;
  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft) ||
    normalizedLeft[0] === normalizedRight[0]
  );
}

function buildSenatorLookup(
  members: CongressMember[],
  memberships: CongressMembership[] | undefined,
): Map<string, SenatorLookupRow[]> {
  const membersByBioguideId = new Map(
    members.map((member) => [member.bioguideId, member]),
  );
  const lookup = new Map<string, SenatorLookupRow[]>();

  for (const membership of memberships ?? []) {
    if (membership.chamber !== "S") continue;
    const member = membersByBioguideId.get(membership.bioguideId);
    if (!member) continue;
    const key = `${membership.congress}|${membership.state}`;
    const rows = lookup.get(key) ?? [];
    rows.push({
      bioguideId: member.bioguideId,
      congress: membership.congress,
      state: membership.state,
      partyCode: membership.partyCode ?? member.partyCode,
      name: member.name,
      directOrderName: member.directOrderName,
      firstName: member.firstName,
      lastName: member.lastName,
    });
    lookup.set(key, rows);
  }

  return lookup;
}

function matchSenatorBioguideId(input: {
  congress: number;
  state: string | undefined;
  firstName?: string;
  lastName?: string;
  party?: string;
  memberFull?: string;
}, lookup: Map<string, SenatorLookupRow[]>): string | undefined {
  if (!input.state) return undefined;
  const candidates = lookup.get(`${input.congress}|${input.state}`) ?? [];
  if (!candidates.length) return undefined;

  const normalizedLastName = normalizeNameToken(input.lastName);
  const byLastName = normalizedLastName
    ? candidates.filter(
        (candidate) => normalizeNameToken(candidate.lastName) === normalizedLastName,
      )
    : [];
  const partyMatched = byLastName.filter(
    (candidate) => !input.party || !candidate.partyCode || candidate.partyCode === input.party,
  );
  const byName = partyMatched.filter((candidate) =>
    firstNameCompatible(input.firstName, candidate.firstName),
  );
  if (byName.length === 1) return byName[0].bioguideId;
  if (partyMatched.length === 1) return partyMatched[0].bioguideId;
  if (byLastName.length === 1) return byLastName[0].bioguideId;

  const normalizedMemberFull = normalizeNameToken(
    input.memberFull?.replace(/\s*\([^)]+\)\s*$/, ""),
  );
  if (normalizedMemberFull) {
    const byFullName = candidates.filter((candidate) => {
      const direct = normalizeNameToken(candidate.directOrderName);
      const inverted = normalizeNameToken(candidate.name.replace(",", " "));
      return direct === normalizedMemberFull || inverted === normalizedMemberFull;
    });
    if (byFullName.length === 1) return byFullName[0].bioguideId;
  }

  return undefined;
}

async function fetchSessionSummary(
  congress: number,
  session: number,
): Promise<SenateVoteSummaryRow[]> {
  const url = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  const xml = await fetchSenateXml(url);
  return parseSummaryVotes(xml);
}

export async function ingestSenateRollCallVotes({
  cycle,
  members,
  memberships,
  voteLimit = 5000,
}: {
  cycle: number;
  members: CongressMember[];
  memberships?: CongressMembership[];
  voteLimit?: number;
}): Promise<{
  senateVotes: SenateRollCallVote[];
  senateVoteMemberVotes: SenateRollCallMemberVote[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const congress = yearToCongress(cycle);
  const sessions: Array<1 | 2> = [1, 2];
  const senatorLookup = buildSenatorLookup(members, memberships);
  const senateVotes: SenateRollCallVote[] = [];
  const senateVoteMemberVotes: SenateRollCallMemberVote[] = [];
  const unmatchedMembers = new Set<string>();

  for (const session of sessions) {
    let summaryRows: SenateVoteSummaryRow[] = [];
    try {
      summaryRows = await fetchSessionSummary(congress, session);
    } catch (error) {
      warnings.push(
        `Senate vote summary fetch failed for ${congress}/${session}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      continue;
    }

    const rows = summaryRows.slice(0, voteLimit);
    for (const row of rows) {
      const paddedRoll = String(row.voteNumber).padStart(5, "0");
      const detailUrl =
        `https://www.senate.gov/legislative/LIS/roll_call_votes/` +
        `vote${congress}${session}/vote_${congress}_${session}_${paddedRoll}.xml`;

      let xml: string;
      try {
        xml = await fetchSenateXml(detailUrl);
      } catch (error) {
        warnings.push(
          `Senate vote detail fetch failed for ${congress}/${session}/${row.voteNumber}: ${
            error instanceof Error ? error.message : "unknown error"
          }`,
        );
        continue;
      }
      await sleep(80);

      const documentBlocks = extractBlocks(xml, "document");
      const firstDocument = documentBlocks[0] ?? "";
      const documentType = extractFirstTag(firstDocument, "document_type");
      const documentNumber = extractFirstTag(firstDocument, "document_number");
      const voteId = buildSenateVoteId(congress, session, row.voteNumber);

      senateVotes.push({
        voteId,
        congress,
        session,
        rollCallNumber: row.voteNumber,
        voteDate: extractFirstTag(xml, "vote_date"),
        modifyDate: extractFirstTag(xml, "modify_date"),
        issue: row.issue ?? extractFirstTag(xml, "issue"),
        question: extractFirstTag(xml, "question") ?? row.question,
        voteQuestionText: extractFirstTag(xml, "vote_question_text"),
        voteDocumentText: extractFirstTag(xml, "vote_document_text"),
        voteTitle: extractFirstTag(xml, "vote_title") ?? row.title,
        majorityRequirement: extractFirstTag(xml, "majority_requirement"),
        result: extractFirstTag(xml, "vote_result") ?? row.result,
        resultText: extractFirstTag(xml, "vote_result_text"),
        billId: buildBillIdFromDocument(congress, documentType, documentNumber),
        documentType,
        documentNumber,
      });

      const membersBlock = extractBlocks(xml, "members")[0] ?? "";
      for (const memberBlock of extractBlocks(membersBlock, "member")) {
        const voteState = extractFirstTag(memberBlock, "state");
        const firstName = extractFirstTag(memberBlock, "first_name");
        const lastName = extractFirstTag(memberBlock, "last_name");
        const voteParty = extractFirstTag(memberBlock, "party");
        const memberFull = extractFirstTag(memberBlock, "member_full");
        const bioguideId = matchSenatorBioguideId(
          {
            congress,
            state: voteState,
            firstName,
            lastName,
            party: voteParty,
            memberFull,
          },
          senatorLookup,
        );

        if (!bioguideId) {
          unmatchedMembers.add(
            `${congress}/${session}/${row.voteNumber}:${memberFull ?? `${lastName}, ${firstName}`} (${voteParty}-${voteState})`,
          );
          continue;
        }

        const voteCast = extractFirstTag(memberBlock, "vote_cast");
        if (!voteCast) continue;
        senateVoteMemberVotes.push({
          voteId,
          bioguideId,
          lisMemberId: extractFirstTag(memberBlock, "lis_member_id"),
          voteCast,
          voteParty,
          voteState,
          firstName,
          lastName,
          memberFull,
        });
      }
    }
  }

  if (unmatchedMembers.size) {
    warnings.push(
      `Unmatched Senate vote members (${unmatchedMembers.size}): ${[...unmatchedMembers]
        .slice(0, 10)
        .join("; ")}`,
    );
  }

  senateVotes.sort((left, right) => {
    if (left.congress !== right.congress) return right.congress - left.congress;
    if (left.session !== right.session) return right.session - left.session;
    return right.rollCallNumber - left.rollCallNumber;
  });

  return {
    senateVotes,
    senateVoteMemberVotes,
    warnings,
  };
}
