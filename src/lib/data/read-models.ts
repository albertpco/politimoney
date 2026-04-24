import type { DataProvenance } from "@/lib/data/provenance";

export type CanonicalEntityType = "member" | "committee" | "bill" | "vote" | "state";

export type EntityLink = {
  entityType: CanonicalEntityType;
  entityId: string;
  label: string;
  href?: string;
  note?: string;
};

export type NamedAmount = {
  label: string;
  amount: number;
  href?: string;
  note?: string;
};

export type MoneySummary = {
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  totalContributions?: number;
  totalIndividualContributions?: number;
  otherCommitteeContributions?: number;
  partyContributions?: number;
  independentExpenditures?: number;
  contributionRows?: number;
  uniqueDonors?: number;
};

export type MemberVoteSummary = {
  voteId: string;
  voteCast: string;
  chamber: "H" | "S";
  congress: number;
  rollCallNumber: number;
  result?: string;
  date?: string;
  href?: string;
};

export type VoteFundingGroup = {
  voteCast: string;
  memberCount: number;
  matchedCandidateCount: number;
  totalReceipts: number;
  averageReceipts: number;
  topMembers: Array<{
    bioguideId: string;
    candidateId?: string;
    name: string;
    totalReceipts: number;
    href?: string;
  }>;
};

export type TrendPoint = {
  label: string;
  value: number;
  unit?: string;
  href?: string;
};

export type StateMetric = {
  key: string;
  label: string;
  value?: number;
  formattedValue?: string;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  quality?: string;
  trend?: TrendPoint[];
};

export type BenchmarkValue = {
  label: string;
  value: number;
  note?: string;
};

export type MemberProfileReadModel = {
  entityType: "member";
  memberId: string;
  candidateIds: string[];
  bioguideId?: string;
  name: string;
  party?: string;
  partyCode?: string;
  state: string;
  stateName?: string;
  chamber: "H" | "S";
  district?: string;
  summary?: string;
  funding: MoneySummary;
  topDonors: NamedAmount[];
  committees: EntityLink[];
  recentVotes: MemberVoteSummary[];
  relatedBills: EntityLink[];
  provenance: DataProvenance;
  caveats: string[];
  relatedEntities: EntityLink[];
};

export type CommitteeProfileReadModel = {
  entityType: "committee";
  committeeId: string;
  name: string;
  committeeType?: string;
  designation?: string;
  party?: string;
  connectedOrgName?: string;
  linkedCandidateId?: string;
  summary?: string;
  financialSummary: MoneySummary;
  topDonors: NamedAmount[];
  topRecipients: NamedAmount[];
  linkedCandidates: EntityLink[];
  independentExpenditures: NamedAmount[];
  provenance: DataProvenance;
  caveats: string[];
  relatedEntities: EntityLink[];
};

export type BillVoteLink = {
  voteId: string;
  chamber: "H" | "S";
  congress: number;
  session?: number;
  rollCallNumber: number;
  question?: string;
  result?: string;
  date?: string;
  href?: string;
};

export type BillProfileReadModel = {
  entityType: "bill";
  billId: string;
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  sponsor?: string;
  sponsorParty?: string;
  sponsorState?: string;
  latestActionDate?: string;
  latestActionText?: string;
  policyArea?: string;
  summary?: string;
  linkedVotes: BillVoteLink[];
  linkedMembers: EntityLink[];
  moneyContext?: MoneySummary;
  provenance: DataProvenance;
  caveats: string[];
  relatedEntities: EntityLink[];
};

export type VoteProfileReadModel = {
  entityType: "vote";
  voteId: string;
  chamber: "H" | "S";
  congress: number;
  session: number;
  rollCallNumber: number;
  question?: string;
  result?: string;
  billId?: string;
  billTitle?: string;
  voteDate?: string;
  memberVotes: Array<{
    bioguideId: string;
    memberName?: string;
    party?: string;
    state?: string;
    voteCast: string;
    href?: string;
  }>;
  fundingGroups: VoteFundingGroup[];
  matchedCandidateCount?: number;
  totalReceipts?: number;
  linkedBill?: EntityLink;
  relatedMembers: EntityLink[];
  provenance: DataProvenance;
  caveats: string[];
  relatedEntities: EntityLink[];
};

export type StateProfileReadModel = {
  entityType: "state";
  stateCode: string;
  stateName: string;
  latestYear?: number;
  headlineMetrics: StateMetric[];
  trendSeries: Array<{
    key: string;
    label: string;
    points: TrendPoint[];
  }>;
  benchmarkValues: BenchmarkValue[];
  relatedFederalContext: EntityLink[];
  provenance: DataProvenance;
  caveats: string[];
  relatedEntities: EntityLink[];
};

export type CanonicalReadModel =
  | MemberProfileReadModel
  | CommitteeProfileReadModel
  | BillProfileReadModel
  | VoteProfileReadModel
  | StateProfileReadModel;

