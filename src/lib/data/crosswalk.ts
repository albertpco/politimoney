import type {
  CandidateMemberCrosswalk,
  CongressMember,
  FecCandidate,
  FecCommittee,
} from "@/lib/ingest/types";

type ParsedName = {
  first: string;
  firstInitial: string;
  last: string;
};

const NAME_SUFFIXES = new Set([
  "jr",
  "sr",
  "ii",
  "iii",
  "iv",
  "v",
]);

function normalizeWord(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSuffixes(tokens: string[]): string[] {
  return tokens.filter((token) => token && !NAME_SUFFIXES.has(token));
}

function parseCandidateName(value: string): ParsedName {
  const normalized = normalizeWord(value);
  const [rawLast = "", rawRest = ""] = normalized.split(",", 2);
  const lastTokens = stripSuffixes(rawLast.split(/\s+/));
  const firstTokens = stripSuffixes(rawRest.split(/\s+/));
  return {
    first: firstTokens[0] ?? "",
    firstInitial: (firstTokens[0] ?? "")[0] ?? "",
    last: lastTokens.join(" "),
  };
}

function parseMemberName(value: string): ParsedName {
  const normalized = normalizeWord(value);
  if (normalized.includes(",")) {
    return parseCandidateName(normalized);
  }

  const tokens = stripSuffixes(normalized.split(/\s+/));
  const first = tokens[0] ?? "";
  const last = tokens.length > 1 ? tokens[tokens.length - 1] : "";
  return {
    first,
    firstInitial: first[0] ?? "",
    last,
  };
}

function normalizeDistrict(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? String(parsed) : trimmed.replace(/^0+/, "") || "0";
}

function memberMatchesOffice(candidate: FecCandidate, member: CongressMember): boolean {
  if (candidate.office !== member.chamber) return false;
  if ((candidate.officeState ?? "").toUpperCase() !== member.state.toUpperCase()) return false;

  if (candidate.office === "H") {
    const candidateDistrict = normalizeDistrict(candidate.officeDistrict);
    const memberDistrict = normalizeDistrict(member.district);
    if (candidateDistrict && memberDistrict && candidateDistrict !== memberDistrict) {
      return false;
    }
  }

  return true;
}

function candidateIdOffice(value: string | undefined): "S" | "H" | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized) return undefined;
  if (normalized.startsWith("S")) return "S";
  if (normalized.startsWith("H")) return "H";
  return undefined;
}

function candidateIdState(value: string | undefined): string | undefined {
  const normalized = value?.trim().toUpperCase();
  if (!normalized || normalized.length < 4) return undefined;
  return normalized.slice(2, 4);
}

function scoreNameMatch(candidate: ParsedName, member: ParsedName): number {
  if (!candidate.last || !member.last) return 0;
  if (candidate.last !== member.last) return 0;

  if (candidate.first && member.first && candidate.first === member.first) {
    return 1;
  }

  if (
    candidate.firstInitial &&
    member.firstInitial &&
    candidate.firstInitial === member.firstInitial
  ) {
    return 0.88;
  }

  return 0;
}

function classifyMatch(
  candidate: FecCandidate,
  member: CongressMember,
  nameScore: number,
): { matchType: string; confidence: number } | null {
  if (nameScore <= 0) return null;

  const candidateDistrict = normalizeDistrict(candidate.officeDistrict);
  const memberDistrict = normalizeDistrict(member.district);
  const districtExact =
    candidate.office === "H" &&
    candidateDistrict !== undefined &&
    memberDistrict !== undefined &&
    candidateDistrict === memberDistrict;

  if (nameScore >= 1 && (candidate.office === "S" || districtExact)) {
    return {
      matchType: districtExact ? "exact_name_state_district" : "exact_name_state",
      confidence: districtExact ? 0.99 : 0.96,
    };
  }

  if (nameScore >= 0.88 && (candidate.office === "S" || districtExact)) {
    return {
      matchType: districtExact ? "initial_name_state_district" : "initial_name_state",
      confidence: districtExact ? 0.91 : 0.86,
    };
  }

  return null;
}

export function buildCandidateMemberCrosswalk(
  candidates: FecCandidate[],
  members: CongressMember[],
  committees: FecCommittee[] = [],
): CandidateMemberCrosswalk[] {
  const results: CandidateMemberCrosswalk[] = [];
  const existingCandidateIds = new Set<string>();

  for (const candidate of candidates) {
    if (candidate.office !== "S" && candidate.office !== "H") continue;
    if (!candidate.officeState) continue;

    const candidateName = parseCandidateName(candidate.name);
    const matches = members
      .filter((member) => memberMatchesOffice(candidate, member))
      .map((member) => {
        const memberName = parseMemberName(member.name);
        const nameScore = scoreNameMatch(candidateName, memberName);
        const classified = classifyMatch(candidate, member, nameScore);
        return classified
          ? {
              member,
              matchType: classified.matchType,
              confidence: classified.confidence,
            }
          : null;
      })
      .filter(
        (
          value,
        ): value is {
          member: CongressMember;
          matchType: string;
          confidence: number;
        } => value !== null,
      )
      .sort((left, right) => right.confidence - left.confidence);

    if (!matches.length) continue;
    if (matches.length > 1 && matches[0].confidence === matches[1].confidence) continue;

    results.push({
      candidateId: candidate.candidateId,
      bioguideId: matches[0].member.bioguideId,
      matchType: matches[0].matchType,
      confidence: matches[0].confidence,
      notes: `${candidate.name} -> ${matches[0].member.name}`,
    });
    existingCandidateIds.add(candidate.candidateId);
  }

  for (const committee of committees) {
    const candidateId = committee.linkedCandidateId?.trim();
    if (!candidateId || existingCandidateIds.has(candidateId)) continue;

    const chamber = candidateIdOffice(candidateId);
    const state = candidateIdState(candidateId);
    if (!chamber || !state) continue;

    const normalizedCommitteeName = normalizeWord(committee.name);
    const matches = members
      .filter(
        (member) =>
          member.chamber === chamber &&
          member.state.toUpperCase() === state &&
          (() => {
            const memberName = parseMemberName(member.name);
            if (!memberName.last || !normalizedCommitteeName.includes(memberName.last)) {
              return false;
            }
            return memberName.first
              ? normalizedCommitteeName.includes(memberName.first)
              : false;
          })(),
      )
      .sort((left, right) => left.name.localeCompare(right.name));

    if (matches.length !== 1) continue;

    results.push({
      candidateId,
      bioguideId: matches[0].bioguideId,
      matchType: "committee_linked_candidate_name_state",
      confidence: 0.78,
      notes: `${committee.name} -> ${matches[0].name}`,
    });
    existingCandidateIds.add(candidateId);
  }

  return results;
}

export function mapCrosswalkByCandidate(
  rows: CandidateMemberCrosswalk[],
): Map<string, CandidateMemberCrosswalk> {
  return new Map(rows.map((row) => [row.candidateId, row]));
}

export function mapCrosswalkByBioguide(
  rows: CandidateMemberCrosswalk[],
): Map<string, CandidateMemberCrosswalk[]> {
  const result = new Map<string, CandidateMemberCrosswalk[]>();
  for (const row of rows) {
    const existing = result.get(row.bioguideId) ?? [];
    existing.push(row);
    result.set(row.bioguideId, existing);
  }
  return result;
}
