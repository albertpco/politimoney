export type SourceName = "fec" | "fara" | "congress" | "outcomes" | "usaspending" | "sec" | "lda";

export type CycleDetail = {
  fecCandidates: number;
  fecCommittees: number;
  fecContributions: number;
  fecIndependentExpenditures?: number;
  fecOperatingExpenditures?: number;
  fecIntercommitteeTransactions?: number;
  congressBills: number;
  houseVotes?: number;
  houseVoteMemberVotes?: number;
  senateVotes?: number;
  senateVoteMemberVotes?: number;
  outcomeStates: number;
};

export type IngestRunSummary = {
  runId: string;
  startedAt: string;
  finishedAt: string;
  cycles: number[];
  candidateLimit: number;
  fecCommitteeLimit: number;
  fecContributionLimit: number;
  faraRegistrantLimit: number;
  sources: {
    fec: SourceRunStatus;
    fara: SourceRunStatus;
    congress: SourceRunStatus;
    outcomes: SourceRunStatus;
    usaspending?: SourceRunStatus;
    sec?: SourceRunStatus;
    lda?: SourceRunStatus;
  };
  totals: {
    candidates: number;
    committees: number;
    contributions: number;
    faraRegistrants: number;
    faraForeignPrincipals: number;
    bills: number;
    congressMembers: number;
    houseVotes?: number;
    houseVoteMemberVotes?: number;
    senateVotes?: number;
    senateVoteMemberVotes?: number;
    candidateMemberCrosswalks?: number;
    stateOutcomes: number;
  };
  cycleDetails?: Record<number, CycleDetail>;
  warnings: string[];
};

export type SourceRunStatus = {
  ok: boolean;
  ingestedAt: string;
  records: number;
  warnings: string[];
  error?: string;
};

export type FecCandidate = {
  candidateId: string;
  name: string;
  office: string;
  officeState?: string;
  party?: string;
  incumbentChallenge?: string;
  principalCommittees: string[];
  electionYear?: number;
  officeDistrict?: string;
  candidateStatus?: string;
  principalCampaignCommittee?: string;
};

export type FecCommittee = {
  committeeId: string;
  name: string;
  committeeType?: string;
  party?: string;
  treasurerName?: string;
  designation?: string;
  filingFrequency?: string;
  orgType?: string;
  connectedOrgName?: string;
  linkedCandidateId?: string;
};

export type FecContribution = {
  committeeId: string;
  committeeName?: string;
  donorName: string;
  donorEntityType?: string;
  donorEmployer?: string;
  donorOccupation?: string;
  amount: number;
  contributionDate?: string;
  city?: string;
  state?: string;
  memoText?: string;
  transactionId?: string;
  subId?: string;
  transactionType?: string;
  zipCode?: string;
  candidateId?: string;
  otherCommitteeId?: string;
  memoCode?: string;
};

export type FecCandidateCommitteeLink = {
  candidateId: string;
  candidateElectionYear: number;
  committeeId: string;
  committeeDesignation: string;
  committeeType: string;
  linkageId: string;
};

export type FecCandidateFinancials = {
  candidateId: string;
  name: string;
  party?: string;
  incumbentChallenge?: string;
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  totalIndividualContributions?: number;
  otherCommitteeContributions?: number;
  partyContributions?: number;
};

export type FecPacSummary = {
  committeeId: string;
  name: string;
  committeeType?: string;
  designation?: string;
  party?: string;
  totalReceipts?: number;
  totalDisbursements?: number;
  cashOnHand?: number;
  independentExpenditures?: number;
};

export type FecIndependentExpenditure = {
  committeeId: string;
  committeeName?: string;
  candidateId?: string;
  candidateName?: string;
  amount: number;
  date?: string;
  supportOppose?: string;
  purpose?: string;
  payee?: string;
  state?: string;
  district?: string;
  office?: string;
};

export type FecOperatingExpenditure = {
  committeeId: string;
  amount: number;
  date?: string;
  purpose?: string;
  payee?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  categoryCode?: string;
  transactionId?: string;
};

export type FecCommunicationCost = {
  committeeId: string;
  candidateId?: string;
  amount: number;
  date?: string;
  supportOppose?: string;
  purpose?: string;
};

export type FecElectioneeringComm = {
  committeeId: string;
  candidateId?: string;
  amount: number;
  date?: string;
  description?: string;
};

export type FecLeadershipPacLink = {
  committeeId: string;
  candidateId: string;
  committeeName?: string;
};

export type FecRecentEfiling = {
  committeeId: string;
  committeeName?: string;
  donorName: string;
  donorEmployer?: string;
  donorOccupation?: string;
  amount: number;
  contributionDate?: string;
  city?: string;
  state?: string;
  subId?: string;
  filingId?: number;
  imageNumber?: string;
};

export type FaraRegistrant = {
  registrationNumber: string;
  name: string;
  city?: string;
  state?: string;
  registrationDate?: string;
};

export type FaraForeignPrincipal = {
  registrationNumber: string;
  principalName: string;
  country?: string;
  foreignPrincipalAddress?: string;
};

export type CongressBill = {
  congress: number;
  billType: string;
  billNumber: string;
  title: string;
  latestActionDate?: string;
  latestActionText?: string;
  policyArea?: string;
  sponsor?: string;
  sponsorParty?: string;
  sponsorState?: string;
};

export type CongressMember = {
  bioguideId: string;
  name: string;
  party?: string;
  partyCode?: string;
  state: string;
  stateName?: string;
  district?: string;
  chamber: "S" | "H";
  termStartYear?: number;
  updateDate?: string;
  currentMember?: boolean;
  officialUrl?: string;
  directOrderName?: string;
  firstName?: string;
  lastName?: string;
};

export type CongressMembership = {
  bioguideId: string;
  congress: number;
  chamber: "S" | "H";
  state: string;
  stateName?: string;
  district?: string;
  party?: string;
  partyCode?: string;
  memberType?: string;
  startYear?: number;
  endYear?: number;
};

export type HouseRollCallVote = {
  voteId: string;
  identifier?: string;
  congress: number;
  session: number;
  rollCallNumber: number;
  startDate?: string;
  updateDate?: string;
  voteType?: string;
  result?: string;
  legislationType?: string;
  legislationNumber?: string;
  voteQuestion?: string;
  amendmentType?: string;
  amendmentNumber?: string;
  amendmentAuthor?: string;
  legislationUrl?: string;
  billId?: string;
};

export type HouseRollCallMemberVote = {
  voteId: string;
  bioguideId: string;
  voteCast: string;
  voteParty?: string;
  voteState?: string;
  firstName?: string;
  lastName?: string;
};

export type SenateRollCallVote = {
  voteId: string;
  congress: number;
  session: number;
  rollCallNumber: number;
  voteDate?: string;
  modifyDate?: string;
  issue?: string;
  question?: string;
  voteQuestionText?: string;
  voteDocumentText?: string;
  voteTitle?: string;
  majorityRequirement?: string;
  result?: string;
  resultText?: string;
  billId?: string;
  documentType?: string;
  documentNumber?: string;
};

export type SenateRollCallMemberVote = {
  voteId: string;
  bioguideId: string;
  lisMemberId?: string;
  voteCast: string;
  voteParty?: string;
  voteState?: string;
  firstName?: string;
  lastName?: string;
  memberFull?: string;
};

export type CandidateMemberCrosswalk = {
  candidateId: string;
  bioguideId: string;
  matchType: string;
  confidence: number;
  notes?: string;
};

export type StateOutcome = {
  stateCode: string;
  stateName: string;
  population?: number;
  childPovertyPct?: number;
  fertilityRatePer1kWomen?: number;
  suicideRatePer100k?: number;
  childMortalityPer1k?: number;
  /** Nominal GDP in millions USD (BEA annual). */
  gdpUsdMillions?: number;
  /** Derived: gdpUsdMillions × 1e6 / population. */
  gdpPerCapitaUsd?: number;
  /** Real GDP year-over-year growth, percent. */
  gdpGrowthPct?: number;
  /** Median household income, USD (Census ACS S1903). */
  medianHouseholdIncomeUsd?: number;
  /** Median age in years (Census ACS S0101). */
  medianAgeYears?: number;
  /** Percent of pop. age 25+ with bachelor's degree or higher (Census S1501). */
  bachelorsOrHigherPct?: number;
  /** Annual unemployment rate, percent (BLS LAUS). */
  unemploymentRatePct?: number;
  /** State+local taxes paid as % of state net product (Tax Foundation). */
  stateLocalTaxBurdenPct?: number;
  /** Net federal $ per resident: positive = state receives more than pays. */
  federalBalancePerCapitaUsd?: number;
  sourceYears: {
    census?: number;
    cdcSuicide?: number;
    cdcChildMortalityPeriodId?: number;
    beaGdp?: number;
    censusEconomy?: number;
    blsUnemployment?: number;
    taxFoundation?: number;
    federalBalance?: number;
  };
};

// --- LDA (Senate Lobbying Disclosure) types ---

export type LobbyingActivity = {
  issueCode: string;
  description: string;
  billNumbers: string[];
  governmentEntities: string[];
};

export type LobbyingFiling = {
  registrantName: string;
  clientName: string;
  income: number;
  expenses: number;
  filingYear: number;
  filingPeriod: string;
  lobbyingActivities: LobbyingActivity[];
};

export type LobbyistContribution = {
  contributorName: string;
  payeeName: string;
  honoreeName: string;
  amount: number;
  date: string;
  contributionType: string;
};

export type LobbyingClientProfile = {
  clientName: string;
  totalSpending: number;
  filingCount: number;
  topIssues: string[];
  linkedFecCommittees: string[];
  linkedBillNumbers: string[];
  linkedContractorName?: string;
};

// --- USASpending types ---

export type GovernmentContract = {
  awardId: string;
  recipientName: string;
  recipientDuns?: string;
  awardAmount: number;
  totalObligatedAmount?: number;
  awardDate?: string;
  startDate?: string;
  endDate?: string;
  awardingAgency?: string;
  awardingSubAgency?: string;
  contractDescription?: string;
  naicsCode?: string;
  naicsDescription?: string;
  placeOfPerformanceState?: string;
  placeOfPerformanceCity?: string;
  contractType?: string;
};

export type ContractorProfile = {
  recipientName: string;
  recipientDuns?: string;
  totalObligatedAmount: number;
  contractCount: number;
  topAgencies: { agency: string; amount: number }[];
  topNaics: { code: string; description: string; amount: number }[];
  fecCommitteeId?: string;
  fecCommitteeName?: string;
  fecConnectedOrgName?: string;
};

// --- Congress STOCK Act trade disclosure types ---

export type CongressTradeDisclosure = {
  memberName: string;
  chamber: "H" | "S";
  state: string;
  district?: string;
  filingDate: string;
  filingType: string;
  docId: string;
  documentUrl: string;
  bioguideId?: string;
  year: number;
};

export type CongressTrade = {
  memberName: string;
  chamber: "H" | "S";
  state: string;
  district?: string;
  bioguideId?: string;
  ticker?: string;
  assetName: string;
  assetType?: string;
  owner?: string;
  transactionType: "purchase" | "sale" | "exchange" | "other";
  transactionLabel: string;
  amountRange: string;
  transactionDate: string;
  notificationDate?: string;
  filingDate: string;
  filingYear: number;
  docId: string;
  documentUrl: string;
  filingStatus?: string;
  capitalGainsOver200?: boolean;
  source: "house-ptr-pdf" | "senate-efd";
};

// --- SEC EDGAR insider trading (Form 4) types ---

export type InsiderTrade = {
  cik: string;
  ticker: string;
  companyName: string;
  insiderName: string;
  insiderTitle?: string;
  isDirector: boolean;
  isOfficer: boolean;
  transactionType: "P" | "S" | "M" | "A";
  shares: number;
  pricePerShare: number;
  totalValue: number;
  transactionDate: string;
  filingDate: string;
};

export type InsiderTradeSummary = {
  ticker: string;
  companyName: string;
  cik: string;
  totalBuys: number;
  totalSells: number;
  buyValue: number;
  sellValue: number;
  netValue: number;
  tradeCount: number;
  recentTrades: InsiderTrade[];
  fecCommitteeId?: string;
  fecCommitteeName?: string;
  contractorName?: string;
};

// --- SEC EDGAR corporate filings (non-Form-4) types ---

export type SecCorporateFilingType =
  | "SC 13D"
  | "SC 13D/A"
  | "8-K"
  | "NT 10-K"
  | "NT 10-Q"
  | "S-3"
  | "S-3/A"
  | "424B5";

export type SecCorporateFiling = {
  cik: string;
  ticker: string;
  companyName: string;
  form: SecCorporateFilingType;
  filingDate: string;
  accessionNumber: string;
  primaryDocumentUrl: string;
  items?: string[];
  filerName?: string;
  filerCik?: string;
};

export type IngestArtifacts = {
  fec: {
    candidates: FecCandidate[];
    committees: FecCommittee[];
    contributions: FecContribution[];
    candidateCommitteeLinks?: FecCandidateCommitteeLink[];
    candidateFinancials?: FecCandidateFinancials[];
    pacSummaries?: FecPacSummary[];
    independentExpenditures?: FecIndependentExpenditure[];
    operatingExpenditures?: FecOperatingExpenditure[];
    communicationCosts?: FecCommunicationCost[];
    electioneeringComms?: FecElectioneeringComm[];
    leadershipPacLinks?: FecLeadershipPacLink[];
  };
  fara: {
    registrants: FaraRegistrant[];
    foreignPrincipals: FaraForeignPrincipal[];
  };
  congress: {
    bills: CongressBill[];
    members: CongressMember[];
    memberships?: CongressMembership[];
    houseVotes: HouseRollCallVote[];
    houseVoteMemberVotes: HouseRollCallMemberVote[];
    senateVotes?: SenateRollCallVote[];
    senateVoteMemberVotes?: SenateRollCallMemberVote[];
    tradeDisclosures?: CongressTradeDisclosure[];
    trades?: CongressTrade[];
  };
  outcomes: {
    states: StateOutcome[];
  };
};
