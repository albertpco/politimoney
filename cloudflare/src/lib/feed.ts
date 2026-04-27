/**
 * Static feed data layer. Maps repository.ts functions to JSON fetches against
 * /data/latest/* (manifest + index + per-entity detail JSON).
 *
 * Pipe: GitHub Action runs ingest -> feed:export -> stage-pages-beta-feed
 *       -> dist/cloudflare/data/latest/*.json -> Cloudflare Pages.
 */

const FEED_BASE =
  (import.meta.env.VITE_POLITIMONEY_FEED_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_POLITIRED_FEED_BASE_URL as string | undefined) ||
  "/data/latest";

export type DatasetKey =
  | "members"
  | "pacs"
  | "donors"
  | "bills"
  | "votes"
  | "states"
  | "congressTrades";

export type FeedManifest = {
  schemaVersion: number;
  generatedAt: string;
  runId?: string;
  source: { note: string };
  datasets: Record<DatasetKey, { path: string; count: number; description: string }>;
  caveats: string[];
};

export type FeedIndexEntry = {
  id: string;
  label: string;
  href: string;
  datasetPath: string;
  summary?: string;
  amount?: number;
  tags?: string[];
};

const cache = new Map<string, Promise<unknown>>();

export async function fetchJson<T>(relPath: string): Promise<T> {
  const path = `${FEED_BASE}/${relPath.replace(/^\//, "")}`;
  const existing = cache.get(path);
  if (existing) return existing as Promise<T>;

  const promise = (async () => {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
    return res.json();
  })();
  cache.set(path, promise);
  try {
    return (await promise) as T;
  } catch (err) {
    cache.delete(path);
    throw err;
  }
}

export async function loadManifest(): Promise<FeedManifest> {
  return fetchJson<FeedManifest>("manifest.json");
}

export async function loadIndex(dataset: DatasetKey): Promise<FeedIndexEntry[]> {
  const manifest = await loadManifest().catch(() => undefined);
  const path = manifest?.datasets[dataset]?.path ?? `indexes/${dataset}.json`;
  return fetchJson<FeedIndexEntry[]>(path);
}

/* ── Detail records ──────────────────────────────────────────────────── */

export type MemberRecord = {
  bioguideId: string;
  name: string;
  party?: string;
  partyCode?: string;
  state?: string;
  stateName?: string;
  district?: string;
  chamber?: "H" | "S" | string;
  termStartYear?: number;
  updateDate?: string;
  currentMember?: boolean;
  directOrderName?: string;
  firstName?: string;
  lastName?: string;
};

export type FundingProfile = {
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  topDonors?: Array<{
    name: string;
    amount: number;
    type?: "person" | "organization" | "unknown";
    employer?: string;
    occupation?: string;
    cycles?: number[];
  }>;
  cycles?: number[];
  committeeIds?: string[];
  sourceBreakdown?: Array<{ label: string; amount: number; share: number }>;
} | null;

export type MemberVotePosition = {
  voteId: string;
  voteCast?: string;
  voteParty?: string;
  voteState?: string;
  question?: string;
  result?: string;
  startDate?: string;
  rollCallNumber?: number;
  congress?: number;
  billId?: string;
  chamber?: "H" | "S";
};

export type MemberDetail = {
  entityType: "member";
  member: MemberRecord;
  funding: FundingProfile;
  recentVotes: MemberVotePosition[];
  peerRanking?: Array<{ rank: number; bioguideId: string; name: string; total: number }>;
  totalRanked?: number;
  caveats?: string[];
};

export type StateOutcomeRow = {
  stateCode: string;
  stateName: string;
  population?: number;
  childPovertyPct?: number;
  fertilityRatePer1kWomen?: number;
  suicideRatePer100k?: number;
  childMortalityPer1k?: number;
  gdpPerCapita?: number;
  medianHouseholdIncome?: number;
  unemploymentRate?: number;
  taxBurdenPct?: number;
  federalBalancePerCapita?: number;
  educationAttainmentPct?: number;
  uninsuredRatePct?: number;
  governor?: { name: string; party?: string };
  sourceYears?: Record<string, number | string>;
};

export type StateDetail = {
  entityType: "state";
  state: StateOutcomeRow;
  members?: MemberRecord[];
  benchmarks?: Record<string, { p25: number; median: number; p75: number; current?: number }>;
  caveats?: string[];
};

export type VoteRecord = {
  voteId: string;
  congress?: number;
  rollCallNumber?: number | string;
  startDate?: string;
  voteDate?: string;
  voteType?: string;
  result?: string;
  question?: string;
  billId?: string;
  legislationUrl?: string;
  documentType?: string;
  documentNumber?: string;
};

export type VoteMemberCast = {
  bioguideId: string;
  firstName?: string;
  lastName?: string;
  voteCast?: string;
  voteParty?: string;
  voteState?: string;
};

export type VoteFundingGroup = {
  voteCast: string;
  memberCount?: number;
  candidateMatched?: number;
  totalReceipts?: number;
  totalIndividuals?: number;
  totalCommittees?: number;
  topMembers?: Array<{ bioguideId: string; name: string; total: number }>;
  sourceBreakdown?: Array<{ label: string; amount: number; share: number }>;
};

export type VoteDetail = {
  entityType: "vote";
  chamber: "H" | "S";
  vote: VoteRecord;
  memberVotes: VoteMemberCast[];
  funding?: { groups: VoteFundingGroup[] } | null;
  caveats?: string[];
};

export type LaunchSummary = {
  runId?: string;
  generatedAt?: string;
  totals?: {
    candidates?: number;
    committees?: number;
    bills?: number;
    members?: number;
    votes?: number;
    states?: number;
  };
  topMembers?: Array<{ bioguideId: string; name: string; total: number; party?: string; state?: string }>;
  topCommittees?: Array<{ committeeId: string; name: string; total: number }>;
  latestHouseVote?: VoteRecord;
  latestSenateVote?: VoteRecord;
  stateOutcomes?: StateOutcomeRow[];
};

export async function loadMember(bioguideId: string): Promise<MemberDetail> {
  const id = bioguideId.toLowerCase();
  return fetchJson<MemberDetail>(`members/${id}.json`);
}

export async function loadState(stateCode: string): Promise<StateDetail> {
  return fetchJson<StateDetail>(`states/${stateCode.toLowerCase()}.json`);
}

export async function loadHouseVote(voteId: string): Promise<VoteDetail> {
  return fetchJson<VoteDetail>(`votes/house/${voteId.toLowerCase()}.json`);
}

export async function loadSenateVote(voteId: string): Promise<VoteDetail> {
  return fetchJson<VoteDetail>(`votes/senate/${voteId.toLowerCase()}.json`);
}

/* ── Pacs / Donors / Bills / Congress trades ───────────────────────── */

export type PacProfile = {
  entityType?: string;
  entityId?: string;
  label?: string;
  committeeIds?: string[];
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  totalIndividualContributions?: number;
  otherCommitteeContributions?: number;
  partyContributions?: number;
  independentExpenditures?: number;
  uniqueDonors?: number;
  contributionRows?: number;
  topDonors?: Array<{
    donor?: string;
    name?: string;
    total?: number | string;
    amount?: number | string;
    employer?: string;
    occupation?: string;
  }>;
  recipients?: Array<{
    label: string;
    totalSupport?: number;
    total?: number;
    href?: string;
    entityType?: string;
    entityId?: string;
  }>;
  issue?: string;
};

export type PacDetail = {
  entityType: "committee";
  profile: PacProfile;
  caveats?: string[];
};

export type DonorRecord = {
  id: string;
  donor: string;
  donorType: "person" | "organization" | "unknown";
  donorEmployer?: string | null;
  donorOccupation?: string | null;
  donorState?: string | null;
  totalContributed: number;
  contributionRows: number;
  recipientCount: number;
  topRecipients: Array<{
    entityType: string;
    entityId: string;
    label: string;
    total: number;
    href?: string;
  }>;
};

export type DonorDetail = {
  entityType: "donor";
  donor: DonorRecord;
  caveats?: string[];
};

export type BillRecord = {
  id?: string;
  congress: number;
  billType: string;
  billNumber: string;
  title?: string;
  summary?: string;
  sponsor?: string;
  sponsorParty?: string;
  sponsorState?: string;
  status?: string;
  latestActionDate?: string;
  latestActionText?: string;
};

export type BillLinkedVote = {
  voteId: string;
  chamber: "H" | "S" | string;
  rollCallNumber?: number | string;
  question?: string;
  result?: string;
  startDate?: string;
};

export type BillDetail = {
  entityType: "bill";
  bill: BillRecord;
  linkedVotes?: BillLinkedVote[];
  caveats?: string[];
};

export type CongressTradeRecord = {
  memberName?: string;
  chamber?: "H" | "S" | string;
  state?: string;
  district?: string;
  bioguideId?: string;
  ticker?: string;
  assetName?: string;
  assetType?: string;
  transactionType?: string;
  transactionLabel?: string;
  amountRange?: string;
  transactionDate?: string;
  notificationDate?: string;
  filingDate?: string;
  filingYear?: number;
  docId?: string;
  documentUrl?: string;
  source?: string;
};

export type CongressTradeDetail = {
  entityType: "congress-trade";
  trade: CongressTradeRecord;
  caveats?: string[];
};

export async function loadPac(committeeId: string): Promise<PacDetail> {
  return fetchJson<PacDetail>(`pacs/${committeeId.toLowerCase()}.json`);
}

export async function loadDonor(id: string): Promise<DonorDetail> {
  return fetchJson<DonorDetail>(`donors/${id.toLowerCase()}.json`);
}

export async function loadBill(id: string): Promise<BillDetail> {
  return fetchJson<BillDetail>(`bills/${id.toLowerCase()}.json`);
}

export async function loadCongressTrade(id: string): Promise<CongressTradeDetail> {
  return fetchJson<CongressTradeDetail>(`congress-trades/${id.toLowerCase()}.json`);
}

export async function loadLaunchSummary(): Promise<LaunchSummary | null> {
  try {
    return await fetchJson<LaunchSummary>("launch-summary.json");
  } catch {
    return null;
  }
}

export { FEED_BASE };
