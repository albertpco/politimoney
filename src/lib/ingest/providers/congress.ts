import { fetchJson } from "@/lib/ingest/http";
import { ingestSenateRollCallVotes } from "@/lib/ingest/providers/senate-roll-calls";
import type {
  CongressBill,
  CongressMember,
  CongressMembership,
  HouseRollCallMemberVote,
  HouseRollCallVote,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";
import { STATE_NAME_TO_CODE } from "@/lib/state-metadata";

type Pagination = {
  count?: number;
  next?: string;
};

type CongressBillRow = {
  congress?: number;
  number?: string;
  type?: string;
  title?: string;
  latestAction?: {
    actionDate?: string;
    text?: string;
  };
  policyArea?: {
    name?: string;
  };
  sponsors?: {
    item?: {
      fullName?: string;
      party?: string;
      state?: string;
    };
  };
};

type CongressApiResponse = {
  bills?: CongressBillRow[];
  pagination?: Pagination;
};

type CongressMemberTermRow = {
  congress?: number | string;
  chamber?: string;
  memberType?: string;
  partyCode?: string;
  partyName?: string;
  stateCode?: string;
  stateName?: string;
  district?: number | string;
  startYear?: number | string;
  endYear?: number | string;
};

type CongressMemberRow = {
  bioguideId?: string;
  name?: string;
  partyName?: string;
  partyCode?: string;
  state?: string;
  district?: number | string;
  updateDate?: string;
  currentMember?: boolean;
  officialUrl?: string;
  directOrderName?: string;
  firstName?: string;
  lastName?: string;
  terms?: {
    item?: CongressMemberTermRow[] | CongressMemberTermRow;
  };
};

type CongressMemberApiResponse = {
  members?: CongressMemberRow[];
  pagination?: Pagination;
};

type HouseVoteListRow = {
  startDate?: string;
  updateDate?: string;
  identifier?: number | string;
  congress?: number;
  sessionNumber?: number | string;
  rollCallNumber?: number | string;
  voteType?: string;
  result?: string;
  legislationType?: string;
  legislationNumber?: number | string;
  amendmentType?: string;
  amendmentNumber?: number | string;
  amendmentAuthor?: string;
  legislationUrl?: string;
  url?: string;
};

type HouseVoteListResponse = {
  houseRollCallVotes?: HouseVoteListRow[];
  pagination?: Pagination;
};

type HouseVoteMembersRow = {
  bioguideID?: string;
  bioguideId?: string;
  voteCast?: string;
  firstName?: string;
  lastName?: string;
  voteParty?: string;
  voteState?: string;
};

type HouseVoteMembersEnvelope = {
  startDate?: string;
  updateDate?: string;
  identifier?: number | string;
  congress?: number;
  sessionNumber?: number | string;
  rollCallNumber?: number | string;
  voteType?: string;
  result?: string;
  legislationType?: string;
  legislationNumber?: number | string;
  voteQuestion?: string;
  amendmentType?: string;
  amendmentNumber?: number | string;
  amendmentAuthor?: string;
  legislationUrl?: string;
  results?: HouseVoteMembersRow[] | {
    item?: HouseVoteMembersRow[] | HouseVoteMembersRow;
  };
};

type HouseVoteMembersResponse = {
  houseRollCallVoteMemberVotes?: HouseVoteMembersEnvelope;
  pagination?: Pagination;
};

const TERRITORY_NAME_TO_CODE = new Map<string, string>([
  ["District of Columbia", "DC"],
  ["American Samoa", "AS"],
  ["Guam", "GU"],
  ["Puerto Rico", "PR"],
  ["Northern Mariana Islands", "MP"],
  ["Virgin Islands", "VI"],
  ["U.S. Virgin Islands", "VI"],
]);

export type CongressIngestResult = {
  bills: CongressBill[];
  members: CongressMember[];
  memberships: CongressMembership[];
  houseVotes: HouseRollCallVote[];
  houseVoteMemberVotes: HouseRollCallMemberVote[];
  senateVotes: SenateRollCallVote[];
  senateVoteMemberVotes: SenateRollCallMemberVote[];
  warnings: string[];
};

function yearToCongress(year: number): number {
  return Math.floor((year - 1789) / 2) + 1;
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function parseTermYear(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseInteger(value: number | string | undefined): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function normalizeChamber(value: string | undefined): "S" | "H" | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  if (normalized.includes("senate")) return "S";
  if (normalized.includes("house")) return "H";
  return undefined;
}

function getLatestTerm(
  terms: CongressMemberRow["terms"],
): CongressMemberTermRow | undefined {
  const raw = terms?.item;
  const items = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (!items.length) return undefined;
  return [...items].sort((left, right) => {
    const leftYear = parseTermYear(left.startYear) ?? 0;
    const rightYear = parseTermYear(right.startYear) ?? 0;
    return rightYear - leftYear;
  })[0];
}

function normalizeCongressStateToCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return (
    STATE_NAME_TO_CODE.get(trimmed) ??
    TERRITORY_NAME_TO_CODE.get(trimmed) ??
    (trimmed.length <= 3 ? trimmed.toUpperCase() : undefined)
  );
}

function partyNameToCode(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized.startsWith("dem")) return "D";
  if (normalized.startsWith("rep")) return "R";
  if (normalized === "independent democrat") return "ID";
  if (normalized.startsWith("ind")) return "I";
  if (normalized.startsWith("lib")) return "L";
  return undefined;
}

function parseMemberNameParts(input: {
  name?: string;
  firstName?: string;
  lastName?: string;
  directOrderName?: string;
}): Pick<CongressMember, "directOrderName" | "firstName" | "lastName"> {
  if (input.firstName || input.lastName || input.directOrderName) {
    return {
      directOrderName: input.directOrderName,
      firstName: input.firstName,
      lastName: input.lastName,
    };
  }

  const rawName = input.name?.trim();
  if (!rawName) {
    return {};
  }
  if (rawName.includes(",")) {
    const [last, rest = ""] = rawName.split(",", 2);
    const firstName = rest.trim().split(/\s+/)[0] || undefined;
    return {
      directOrderName: `${rest.trim()} ${last.trim()}`.trim(),
      firstName,
      lastName: last.trim() || undefined,
    };
  }

  const parts = rawName.split(/\s+/);
  return {
    directOrderName: rawName,
    firstName: parts[0] || undefined,
    lastName: parts.length > 1 ? parts[parts.length - 1] : undefined,
  };
}

function buildBillId(
  congress: number,
  legislationType: string | undefined,
  legislationNumber: string | undefined,
): string | undefined {
  if (!legislationType || !legislationNumber) return undefined;
  const normalizedType = legislationType.toUpperCase().trim();
  if (!["HR", "HJRES", "HCONRES", "HRES", "S", "SJRES", "SCONRES", "SRES"].includes(normalizedType)) {
    return undefined;
  }
  return `${congress}-${normalizedType}-${legislationNumber}`;
}

function buildVoteId(
  congress: number,
  session: number,
  rollCallNumber: number,
  identifier?: number | string,
): string {
  if (identifier !== undefined && identifier !== null) {
    return String(identifier).trim();
  }
  return `${congress}-${session}-${rollCallNumber}`;
}

async function fetchPagedRows<T>({
  buildUrl,
  extractRows,
  limit,
}: {
  buildUrl: (offset: number, pageSize: number) => string;
  extractRows: (payload: T) => unknown[];
  limit: number;
}): Promise<unknown[]> {
  const rows: unknown[] = [];
  let offset = 0;
  const pageSize = 250;
  let nextExists = true;

  while (rows.length < limit && nextExists) {
    const payload = await fetchJson<T>(buildUrl(offset, pageSize));
    const pageRows = extractRows(payload);
    if (!pageRows.length) break;

    rows.push(...pageRows);
    nextExists = Boolean((payload as { pagination?: Pagination }).pagination?.next);
    offset += pageSize;
  }

  return rows.slice(0, limit);
}

async function processInChunks<T>(
  rows: T[],
  chunkSize: number,
  worker: (row: T) => Promise<void>,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    await Promise.all(chunk.map((row) => worker(row)));
  }
}

export async function ingestCongressBills({
  apiKey,
  cycle,
  limit = 250,
}: {
  apiKey: string | null;
  cycle: number;
  limit?: number;
}): Promise<{
  bills: CongressBill[];
  warnings: string[];
}> {
  const result = await ingestCongressData({
    apiKey,
    cycle,
    limit,
    memberLimit: 0,
    includeHouseVotes: false,
    includeSenateVotes: false,
  });
  return {
    bills: result.bills,
    warnings: result.warnings,
  };
}

async function ingestCongressBillsInternal({
  apiKey,
  cycle,
  limit,
}: {
  apiKey: string;
  cycle: number;
  limit: number;
}): Promise<{ bills: CongressBill[]; warnings: string[] }> {
  const warnings: string[] = [];
  const congress = yearToCongress(cycle);

  const rows = (await fetchPagedRows<CongressApiResponse>({
    buildUrl: (offset, pageSize) => {
      const url = new URL(`https://api.congress.gov/v3/bill/${congress}`);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(offset));
      return url.toString();
    },
    extractRows: (payload) => payload.bills ?? [],
    limit,
  })) as CongressBillRow[];

  const bills = rows
    .filter((row) => row.type && row.number)
    .map((row) => ({
      congress: row.congress ?? congress,
      billType: row.type!.toUpperCase(),
      billNumber: row.number!,
      title: row.title ?? `${row.type} ${row.number}`,
      latestActionDate: row.latestAction?.actionDate,
      latestActionText: row.latestAction?.text,
      policyArea: row.policyArea?.name,
      sponsor: row.sponsors?.item?.fullName,
      sponsorParty: row.sponsors?.item?.party,
      sponsorState: row.sponsors?.item?.state,
    }));

  if (!bills.length) {
    warnings.push("No Congress bills returned for selected congress.");
  }

  return { bills, warnings };
}

async function ingestCongressMembersInternal({
  apiKey,
  congresses,
  limit,
}: {
  apiKey: string;
  congresses?: number[];
  limit: number;
}): Promise<{ members: CongressMember[]; memberships: CongressMembership[]; warnings: string[] }> {
  const warnings: string[] = [];
  if (limit <= 0) return { members: [], memberships: [], warnings };

  const targetCongresses = uniqueNumbers((congresses ?? []).filter((value) => value > 0));
  const latestCongress = targetCongresses[targetCongresses.length - 1];
  const byBioguideId = new Map<string, CongressMember>();
  const memberships = new Map<string, CongressMembership>();
  const currentRows = (await fetchPagedRows<CongressMemberApiResponse>({
    buildUrl: (offset, pageSize) => {
      const url = new URL("https://api.congress.gov/v3/member");
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("format", "json");
      url.searchParams.set("currentMember", "true");
      url.searchParams.set("limit", String(pageSize));
      url.searchParams.set("offset", String(offset));
      return url.toString();
    },
    extractRows: (payload) => payload.members ?? [],
    limit,
  })) as CongressMemberRow[];
  const currentMemberIds = new Set(
    currentRows.map((row) => row.bioguideId).filter((value): value is string => Boolean(value)),
  );

  const memberRowsByCongress = new Map<number, CongressMemberRow[]>();
  if (targetCongresses.length) {
    for (const congress of targetCongresses) {
      const rows = (await fetchPagedRows<CongressMemberApiResponse>({
        buildUrl: (offset, pageSize) => {
          const url = new URL(`https://api.congress.gov/v3/member/congress/${congress}`);
          url.searchParams.set("api_key", apiKey);
          url.searchParams.set("format", "json");
          url.searchParams.set("currentMember", "false");
          url.searchParams.set("limit", String(pageSize));
          url.searchParams.set("offset", String(offset));
          return url.toString();
        },
        extractRows: (payload) => payload.members ?? [],
        limit,
      })) as CongressMemberRow[];
      memberRowsByCongress.set(congress, rows);
    }
  } else {
    memberRowsByCongress.set(latestCongress ?? 0, currentRows);
  }

  for (const [congress, rows] of memberRowsByCongress.entries()) {
    for (const row of rows) {
      if (!row.bioguideId || !row.name || !row.state) continue;
      const latestTerm = getLatestTerm(row.terms);
      const chamber = normalizeChamber(latestTerm?.chamber);
      const stateCode =
        normalizeCongressStateToCode(latestTerm?.stateCode) ??
        normalizeCongressStateToCode(row.state);
      if (!chamber || !stateCode) continue;

      const memberNameParts = parseMemberNameParts({
        name: row.name,
        firstName: row.firstName,
        lastName: row.lastName,
        directOrderName: row.directOrderName,
      });
      const existing = byBioguideId.get(row.bioguideId);
      const nextMember: CongressMember = {
        bioguideId: row.bioguideId,
        name: row.name,
        party: row.partyName,
        partyCode: row.partyCode ?? partyNameToCode(row.partyName),
        state: stateCode,
        stateName: latestTerm?.stateName ?? row.state,
        district:
          row.district === undefined || row.district === null
            ? undefined
            : String(row.district),
        chamber,
        termStartYear: parseTermYear(latestTerm?.startYear),
        updateDate: row.updateDate,
        currentMember:
          typeof row.currentMember === "boolean"
            ? row.currentMember
            : currentMemberIds.has(row.bioguideId),
        officialUrl: row.officialUrl,
        directOrderName: memberNameParts.directOrderName,
        firstName: memberNameParts.firstName,
        lastName: memberNameParts.lastName,
      };

      if (!existing || latestCongress === undefined || congress >= latestCongress) {
        byBioguideId.set(row.bioguideId, nextMember);
      }

      const membershipDistrict =
        row.district === undefined || row.district === null
          ? undefined
          : String(row.district);
      const membershipKey = [
        row.bioguideId,
        congress,
        chamber,
        stateCode,
        membershipDistrict ?? "",
      ].join("|");
      memberships.set(membershipKey, {
        bioguideId: row.bioguideId,
        congress,
        chamber,
        state: stateCode,
        stateName: latestTerm?.stateName ?? row.state,
        district: membershipDistrict,
        party: row.partyName,
        partyCode: row.partyCode ?? partyNameToCode(row.partyName),
        memberType: latestTerm?.memberType,
        startYear: parseTermYear(latestTerm?.startYear),
        endYear: parseTermYear(latestTerm?.endYear),
      });
    }
  }

  for (const row of currentRows) {
    if (!row.bioguideId || !row.name || !row.state) continue;
    const latestTerm = getLatestTerm(row.terms);
    const chamber = normalizeChamber(latestTerm?.chamber);
    const stateCode = normalizeCongressStateToCode(row.state);
    if (!chamber || !stateCode) continue;
    const memberNameParts = parseMemberNameParts({
      name: row.name,
      firstName: row.firstName,
      lastName: row.lastName,
      directOrderName: row.directOrderName,
    });
    byBioguideId.set(row.bioguideId, {
      bioguideId: row.bioguideId,
      name: row.name,
      party: row.partyName,
      partyCode: row.partyCode ?? partyNameToCode(row.partyName),
      state: stateCode,
      stateName: row.state,
      district:
        row.district === undefined || row.district === null
          ? undefined
          : String(row.district),
      chamber,
      termStartYear: parseTermYear(latestTerm?.startYear),
      updateDate: row.updateDate,
      currentMember: true,
      officialUrl: row.officialUrl,
      directOrderName: memberNameParts.directOrderName,
      firstName: memberNameParts.firstName,
      lastName: memberNameParts.lastName,
    });
  }

  const members = [...byBioguideId.values()].sort((left, right) => {
    if (left.state !== right.state) return left.state.localeCompare(right.state);
    if (left.chamber !== right.chamber) return left.chamber.localeCompare(right.chamber);
    return left.name.localeCompare(right.name);
  });

  if (!members.length) {
    warnings.push("No current Congress members returned from Congress API.");
  }

  return {
    members,
    memberships: [...memberships.values()],
    warnings,
  };
}

async function ingestHouseRollCallVotesInternal({
  apiKey,
  cycle,
  voteLimit = 5000,
}: {
  apiKey: string;
  cycle: number;
  voteLimit?: number;
}): Promise<{
  houseVotes: HouseRollCallVote[];
  houseVoteMemberVotes: HouseRollCallMemberVote[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const congress = yearToCongress(cycle);
  const sessions: Array<1 | 2> = [1, 2];
  if (congress < 118) {
    warnings.push(
      `House roll call vote API currently covers 118th and 119th Congresses; skipping ${congress}.`,
    );
    return { houseVotes: [], houseVoteMemberVotes: [], warnings };
  }

  const listRows: HouseVoteListRow[] = [];
  for (const session of sessions) {
    const sessionRows = (await fetchPagedRows<HouseVoteListResponse>({
      buildUrl: (offset, pageSize) => {
        const url = new URL(`https://api.congress.gov/v3/house-vote/${congress}/${session}`);
        url.searchParams.set("api_key", apiKey);
        url.searchParams.set("format", "json");
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));
        return url.toString();
      },
      extractRows: (payload) => payload.houseRollCallVotes ?? [],
      limit: voteLimit,
    })) as HouseVoteListRow[];
    listRows.push(...sessionRows);
  }

  if (!listRows.length) {
    warnings.push(`No House roll call votes returned for congress ${congress}.`);
    return { houseVotes: [], houseVoteMemberVotes: [], warnings };
  }

  const voteMap = new Map<string, HouseRollCallVote>();
  const memberVotes: HouseRollCallMemberVote[] = [];

  await processInChunks(listRows, 8, async (row) => {
    const rollCallNumber = parseInteger(row.rollCallNumber);
    const sessionNumber = parseInteger(row.sessionNumber);
    if (!rollCallNumber) return;
    if (!sessionNumber) return;

    const url = new URL(
      `https://api.congress.gov/v3/house-vote/${congress}/${sessionNumber}/${rollCallNumber}/members`,
    );
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "250");
    url.searchParams.set("offset", "0");

    let payload: HouseVoteMembersResponse;
    try {
      payload = await fetchJson<HouseVoteMembersResponse>(url.toString());
    } catch (error) {
      warnings.push(
        `House vote member fetch failed for ${congress}/${sessionNumber}/${rollCallNumber}: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
      return;
    }

    const envelope = payload.houseRollCallVoteMemberVotes;
    if (!envelope) return;

    const voteId = buildVoteId(
      congress,
      sessionNumber,
      rollCallNumber,
      envelope.identifier ?? row.identifier,
    );
    const legislationType = envelope.legislationType ?? row.legislationType;
    const legislationNumber = String(
      parseInteger(envelope.legislationNumber) ??
        parseInteger(row.legislationNumber) ??
        "",
    ).trim();

    voteMap.set(voteId, {
      voteId,
      identifier:
        envelope.identifier !== undefined
          ? String(envelope.identifier)
          : row.identifier !== undefined
            ? String(row.identifier)
            : undefined,
      congress,
      session: sessionNumber,
      rollCallNumber,
      startDate: envelope.startDate ?? row.startDate,
      updateDate: envelope.updateDate ?? row.updateDate,
      voteType: envelope.voteType ?? row.voteType,
      result: envelope.result ?? row.result,
      legislationType,
      legislationNumber: legislationNumber || undefined,
      voteQuestion: envelope.voteQuestion,
      amendmentType: envelope.amendmentType ?? row.amendmentType,
      amendmentNumber:
        String(
          parseInteger(envelope.amendmentNumber) ??
            parseInteger(row.amendmentNumber) ??
            "",
        ).trim() || undefined,
      amendmentAuthor: envelope.amendmentAuthor ?? row.amendmentAuthor,
      legislationUrl: envelope.legislationUrl ?? row.legislationUrl,
      billId: buildBillId(congress, legislationType, legislationNumber || undefined),
    });

    const rawResults = Array.isArray(envelope.results)
      ? envelope.results
      : envelope.results?.item;
    const results = Array.isArray(rawResults) ? rawResults : rawResults ? [rawResults] : [];
    for (const result of results) {
      const bioguideId = result.bioguideId ?? result.bioguideID;
      if (!bioguideId || !result.voteCast) continue;
      memberVotes.push({
        voteId,
        bioguideId,
        voteCast: result.voteCast,
        voteParty: result.voteParty,
        voteState: result.voteState,
        firstName: result.firstName,
        lastName: result.lastName,
      });
    }
  });

  return {
    houseVotes: [...voteMap.values()].sort((left, right) => {
      if (left.congress !== right.congress) return right.congress - left.congress;
      if (left.session !== right.session) return right.session - left.session;
      return right.rollCallNumber - left.rollCallNumber;
    }),
    houseVoteMemberVotes: memberVotes,
    warnings,
  };
}

export async function ingestCongressMembers({
  apiKey,
  congresses,
  limit = 600,
}: {
  apiKey: string | null;
  congresses?: number[];
  limit?: number;
}): Promise<{ members: CongressMember[]; memberships: CongressMembership[]; warnings: string[] }> {
  if (!apiKey) {
    return {
      members: [],
      memberships: [],
      warnings: ["CONGRESS_API_KEY missing. Skipping member ingestion."],
    };
  }
  return ingestCongressMembersInternal({ apiKey, congresses, limit });
}

export async function ingestHouseRollCallVotes({
  apiKey,
  cycle,
  voteLimit = 5000,
}: {
  apiKey: string | null;
  cycle: number;
  voteLimit?: number;
}): Promise<{
  houseVotes: HouseRollCallVote[];
  houseVoteMemberVotes: HouseRollCallMemberVote[];
  warnings: string[];
}> {
  if (!apiKey) {
    return {
      houseVotes: [],
      houseVoteMemberVotes: [],
      warnings: ["CONGRESS_API_KEY missing. Skipping House roll call vote ingestion."],
    };
  }
  return ingestHouseRollCallVotesInternal({ apiKey, cycle, voteLimit });
}

export async function ingestCongressData({
  apiKey,
  cycle,
  limit = 250,
  memberLimit = 600,
  includeHouseVotes = true,
  includeSenateVotes = true,
}: {
  apiKey: string | null;
  cycle: number;
  limit?: number;
  memberLimit?: number;
  includeHouseVotes?: boolean;
  includeSenateVotes?: boolean;
}): Promise<CongressIngestResult> {
  const warnings: string[] = [];
  if (!apiKey) {
    warnings.push("CONGRESS_API_KEY missing. Skipping Congress ingestion.");
    return {
      bills: [],
      members: [],
      memberships: [],
      houseVotes: [],
      houseVoteMemberVotes: [],
      senateVotes: [],
      senateVoteMemberVotes: [],
      warnings,
    };
  }

  const [billResult, memberResult, houseVoteResult] = await Promise.all([
    ingestCongressBillsInternal({ apiKey, cycle, limit }),
    ingestCongressMembersInternal({ apiKey, congresses: [yearToCongress(cycle)], limit: memberLimit }),
    includeHouseVotes
      ? ingestHouseRollCallVotesInternal({ apiKey, cycle })
      : Promise.resolve({ houseVotes: [], houseVoteMemberVotes: [], warnings: [] }),
  ]);
  const senateVoteResult = includeSenateVotes
    ? await ingestSenateRollCallVotes({
        cycle,
        members: memberResult.members,
        memberships: memberResult.memberships,
      })
    : { senateVotes: [], senateVoteMemberVotes: [], warnings: [] };

  return {
    bills: billResult.bills,
    members: memberResult.members,
    memberships: memberResult.memberships,
    houseVotes: houseVoteResult.houseVotes,
    houseVoteMemberVotes: houseVoteResult.houseVoteMemberVotes,
    senateVotes: senateVoteResult.senateVotes,
    senateVoteMemberVotes: senateVoteResult.senateVoteMemberVotes,
    warnings: [
      ...billResult.warnings,
      ...memberResult.warnings,
      ...houseVoteResult.warnings,
      ...senateVoteResult.warnings,
      ...warnings,
    ],
  };
}

export { ingestSenateRollCallVotes };
