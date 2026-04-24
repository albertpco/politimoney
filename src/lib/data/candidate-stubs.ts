import type {
  CandidateMemberCrosswalk,
  CongressMember,
  FecCandidate,
  FecCommittee,
} from "@/lib/ingest/types";

function inferOfficeFromCandidateId(candidateId: string): string {
  const office = candidateId[0]?.toUpperCase();
  return office === "S" || office === "H" || office === "P" ? office : "H";
}

function inferStateFromCandidateId(candidateId: string): string | undefined {
  return candidateId.length >= 4 ? candidateId.slice(2, 4).toUpperCase() : undefined;
}

export function buildMissingCandidateStubs(
  crosswalkRows: CandidateMemberCrosswalk[],
  candidates: FecCandidate[],
  committees: FecCommittee[],
  members: CongressMember[],
): FecCandidate[] {
  const existingCandidateIds = new Set(
    candidates.map((candidate) => candidate.candidateId),
  );
  const committeeIdsByCandidate = new Map<string, string[]>();
  const memberByBioguideId = new Map(
    members.map((member) => [member.bioguideId, member]),
  );
  const crosswalkByCandidateId = new Map<string, CandidateMemberCrosswalk>();

  for (const row of crosswalkRows) {
    if (!crosswalkByCandidateId.has(row.candidateId)) {
      crosswalkByCandidateId.set(row.candidateId, row);
    }
  }

  for (const committee of committees) {
    if (!committee.linkedCandidateId) continue;
    const existing = committeeIdsByCandidate.get(committee.linkedCandidateId) ?? [];
    existing.push(committee.committeeId);
    committeeIdsByCandidate.set(committee.linkedCandidateId, existing);
  }

  const missingCandidateIds = [...new Set(crosswalkRows.map((row) => row.candidateId))].filter(
    (candidateId) => !existingCandidateIds.has(candidateId),
  );

  return missingCandidateIds.map((candidateId) => {
    const match = crosswalkByCandidateId.get(candidateId);
    const member = match ? memberByBioguideId.get(match.bioguideId) : undefined;
    return {
      candidateId,
      name: member?.name ?? candidateId,
      office: member?.chamber ?? inferOfficeFromCandidateId(candidateId),
      officeState: member?.state ?? inferStateFromCandidateId(candidateId),
      officeDistrict: member?.chamber === "H" ? member.district : undefined,
      party: member?.party,
      incumbentChallenge: undefined,
      candidateStatus: member?.currentMember ? "C" : undefined,
      electionYear: undefined,
      principalCommittees: [...new Set(committeeIdsByCandidate.get(candidateId) ?? [])],
    };
  });
}
