import {
  readCandidateFinancials,
  readCongressMembers,
} from "@/lib/ingest/storage";
import { getCandidateMemberCrosswalkRepository } from "@/lib/data/repository";

export type PeerRankRow = {
  rank: number;
  bioguideId: string;
  name: string;
  state?: string;
  chamber: "H" | "S";
  party?: string;
  totalReceipts: number;
};

export type PeerRankingResult = {
  chamber: "H" | "S";
  totalRanked: number;
  you: PeerRankRow | null;
  /** A window centered on `you` (top-3 + neighbors + bottom-1), capped at ~9 rows. */
  window: PeerRankRow[];
};

/**
 * Rank members of a chamber by FEC-linked total receipts (current cycle).
 * Members with no candidate match or zero receipts sink to the bottom.
 * Returns the ranked row for `bioguideId` and a small window of peers.
 */
export async function getMemberFundingRanking(
  bioguideId: string,
): Promise<PeerRankingResult | null> {
  const target = bioguideId.toUpperCase();
  const [members, crosswalk, financials] = await Promise.all([
    readCongressMembers(),
    getCandidateMemberCrosswalkRepository(),
    readCandidateFinancials(),
  ]);

  const me = members.find((m) => m.bioguideId.toUpperCase() === target);
  if (!me) return null;

  const candidateByBioguide = new Map<string, string>();
  for (const row of crosswalk) {
    if (!row.bioguideId || !row.candidateId) continue;
    candidateByBioguide.set(row.bioguideId.toUpperCase(), row.candidateId);
  }
  const receiptsByCandidate = new Map<string, number>();
  for (const f of financials) {
    receiptsByCandidate.set(
      f.candidateId,
      (receiptsByCandidate.get(f.candidateId) ?? 0) + (f.totalReceipts ?? 0),
    );
  }

  const chamber = me.chamber;
  const ranked = members
    .filter((m) => m.chamber === chamber)
    .map<PeerRankRow>((m) => {
      const cand = candidateByBioguide.get(m.bioguideId.toUpperCase());
      const totalReceipts = cand ? receiptsByCandidate.get(cand) ?? 0 : 0;
      return {
        rank: 0,
        bioguideId: m.bioguideId,
        name: m.name,
        state: m.state,
        chamber: m.chamber,
        party: m.party,
        totalReceipts,
      };
    })
    .sort((a, b) => b.totalReceipts - a.totalReceipts)
    .map((row, i) => ({ ...row, rank: i + 1 }));

  const youIdx = ranked.findIndex((r) => r.bioguideId.toUpperCase() === target);
  const you = youIdx >= 0 ? ranked[youIdx] : null;

  const window: PeerRankRow[] = [];
  // Top 3
  for (const r of ranked.slice(0, 3)) window.push(r);

  if (you && youIdx > 4) {
    // 1 above + you + 1 below
    if (youIdx - 1 > 2) window.push(ranked[youIdx - 1]);
    window.push(you);
    if (youIdx + 1 < ranked.length) window.push(ranked[youIdx + 1]);
  } else if (you) {
    // close to top — fill in 4..6 around you
    for (const r of ranked.slice(3, Math.max(youIdx + 2, 5))) {
      if (!window.find((w) => w.bioguideId === r.bioguideId)) window.push(r);
    }
  }
  // Bottom — last entry with non-zero receipts (or just last)
  const last = ranked[ranked.length - 1];
  if (last && !window.find((w) => w.bioguideId === last.bioguideId)) {
    window.push(last);
  }

  return {
    chamber,
    totalRanked: ranked.length,
    you,
    window,
  };
}
