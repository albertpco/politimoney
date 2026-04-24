import type {
  FecCandidate,
  FecCandidateCommitteeLink,
  FecCandidateFinancials,
  FecCommittee,
  FecCommunicationCost,
  FecContribution,
  FecElectioneeringComm,
  FecIndependentExpenditure,
  FecLeadershipPacLink,
  FecOperatingExpenditure,
  FecPacSummary,
} from "@/lib/ingest/types";
import type { ParsedRow } from "./parser";

function parseFloat(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseInt(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function str(value: string | undefined): string | undefined {
  if (!value || value.trim() === "") return undefined;
  return value.trim();
}

function mapOffice(code: string | undefined): string {
  if (!code) return "Unknown";
  const upper = code.toUpperCase().trim();
  if (upper === "S") return "S";
  if (upper === "H") return "H";
  if (upper === "P") return "P";
  return upper;
}

// FEC date format: MMDDYYYY → YYYY-MM-DD
function mapDate(value: string | undefined): string | undefined {
  if (!value || value.length < 8) return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 8) {
    return `${trimmed.slice(4, 8)}-${trimmed.slice(0, 2)}-${trimmed.slice(2, 4)}`;
  }
  // Some dates may already be in other formats
  return trimmed;
}

export function mapCandidateRow(row: ParsedRow): FecCandidate | null {
  const candidateId = str(row.CAND_ID);
  if (!candidateId) return null;
  return {
    candidateId,
    name: row.CAND_NAME?.trim() ?? candidateId,
    office: mapOffice(row.CAND_OFFICE),
    officeState: str(row.CAND_OFFICE_ST),
    party: str(row.CAND_PTY_AFFILIATION),
    incumbentChallenge: str(row.CAND_ICI),
    principalCommittees: row.CAND_PCC ? [row.CAND_PCC.trim()] : [],
    electionYear: parseInt(row.CAND_ELECTION_YR),
    officeDistrict: str(row.CAND_OFFICE_DISTRICT),
    candidateStatus: str(row.CAND_STATUS),
    principalCampaignCommittee: str(row.CAND_PCC),
  };
}

export function mapCommitteeRow(row: ParsedRow): FecCommittee | null {
  const committeeId = str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    name: row.CMTE_NM?.trim() ?? committeeId,
    committeeType: str(row.CMTE_TP),
    party: str(row.CMTE_PTY_AFFILIATION),
    treasurerName: str(row.TRES_NM),
    designation: str(row.CMTE_DSGN),
    filingFrequency: str(row.CMTE_FILING_FREQ),
    orgType: str(row.ORG_TP),
    connectedOrgName: str(row.CONNECTED_ORG_NM),
    linkedCandidateId: str(row.CAND_ID),
  };
}

export function mapContributionRow(row: ParsedRow): FecContribution | null {
  const committeeId = str(row.CMTE_ID);
  const donorName = str(row.NAME);
  if (!committeeId || !donorName) return null;
  return {
    committeeId,
    donorName,
    donorEntityType: str(row.ENTITY_TP),
    donorEmployer: str(row.EMPLOYER),
    donorOccupation: str(row.OCCUPATION),
    amount: parseFloat(row.TRANSACTION_AMT) ?? 0,
    contributionDate: mapDate(row.TRANSACTION_DT),
    city: str(row.CITY),
    state: str(row.STATE),
    memoText: str(row.MEMO_TEXT),
    transactionId: str(row.TRAN_ID),
    subId: str(row.SUB_ID),
    transactionType: str(row.TRANSACTION_TP),
    zipCode: str(row.ZIP_CODE),
    candidateId: str(row.CAND_ID),
    otherCommitteeId: str(row.OTHER_ID),
    memoCode: str(row.MEMO_CD),
  };
}

export function mapCandidateCommitteeLinkRow(row: ParsedRow): FecCandidateCommitteeLink | null {
  const candidateId = str(row.CAND_ID);
  const committeeId = str(row.CMTE_ID);
  if (!candidateId || !committeeId) return null;
  return {
    candidateId,
    candidateElectionYear: parseInt(row.CAND_ELECTION_YR) ?? 0,
    committeeId,
    committeeDesignation: str(row.CMTE_DSGN) ?? "",
    committeeType: str(row.CMTE_TP) ?? "",
    linkageId: str(row.LINKAGE_ID) ?? `${candidateId}-${committeeId}`,
  };
}

export function mapCandidateFinancialsRow(row: ParsedRow): FecCandidateFinancials | null {
  const candidateId = str(row.CAND_ID);
  if (!candidateId) return null;
  return {
    candidateId,
    name: row.CAND_NAME?.trim() ?? candidateId,
    party: str(row.CAND_PTY_AFFILIATION),
    incumbentChallenge: str(row.CAND_ICI),
    totalReceipts: parseFloat(row.TTL_RECEIPTS),
    totalDisbursements: parseFloat(row.TTL_DISB),
    cashOnHand: parseFloat(row.COH_COP),
    totalIndividualContributions: parseFloat(row.TTL_INDIV_CONTRIB),
    otherCommitteeContributions: parseFloat(row.OTHER_POL_CMTE_CONTRIB),
    partyContributions: parseFloat(row.POL_PTY_CONTRIB),
  };
}

export function mapPacSummaryRow(row: ParsedRow): FecPacSummary | null {
  const committeeId = str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    name: row.CMTE_NM?.trim() ?? committeeId,
    committeeType: str(row.CMTE_TP),
    designation: str(row.CMTE_DSGN),
    party: str(row.CMTE_PTY_AFFILIATION),
    totalReceipts: parseFloat(row.TTL_RECEIPTS),
    totalDisbursements: parseFloat(row.TTL_DISB),
    cashOnHand: parseFloat(row.COH_COP),
    independentExpenditures: parseFloat(row.IND_EXP),
  };
}

export function mapIndependentExpenditureRow(row: ParsedRow): FecIndependentExpenditure | null {
  // CSV headers: spe_id, spe_nam, cand_id, cand_name, exp_amo, exp_date, sup_opp, pur, pay, can_office_state, can_office_dis, can_office
  const committeeId = str(row.spe_id) ?? str(row.committee_id) ?? str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    committeeName: str(row.spe_nam) ?? str(row.committee_name),
    candidateId: str(row.cand_id) ?? str(row.candidate_id),
    candidateName: str(row.cand_name) ?? str(row.candidate_name),
    amount: parseFloat(row.exp_amo) ?? parseFloat(row.expenditure_amount) ?? 0,
    date: str(row.exp_date) ?? str(row.expenditure_date),
    supportOppose: str(row.sup_opp) ?? str(row.support_oppose_indicator),
    purpose: str(row.pur) ?? str(row.expenditure_description),
    payee: str(row.pay) ?? str(row.payee_name),
    state: str(row.can_office_state) ?? str(row.candidate_state),
    district: str(row.can_office_dis) ?? str(row.candidate_district),
    office: str(row.can_office) ?? str(row.candidate_office),
  };
}

export function mapOperatingExpenditureRow(row: ParsedRow): FecOperatingExpenditure | null {
  const committeeId = str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    amount: parseFloat(row.TRANSACTION_AMT) ?? 0,
    date: mapDate(row.TRANSACTION_DT),
    purpose: str(row.PURPOSE),
    payee: str(row.PAYEE) ?? str(row.NAME),
    city: str(row.CITY),
    state: str(row.STATE),
    zipCode: str(row.ZIP_CODE),
    categoryCode: str(row.CATEGORY),
    transactionId: str(row.TRAN_ID),
  };
}

export function mapCommunicationCostRow(row: ParsedRow): FecCommunicationCost | null {
  const committeeId = str(row.committee_id) ?? str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    candidateId: str(row.candidate_id) ?? str(row.CAND_ID),
    amount: parseFloat(row.communication_cost) ?? parseFloat(row.TRANSACTION_AMT) ?? 0,
    date: str(row.communication_date) ?? mapDate(row.TRANSACTION_DT),
    supportOppose: str(row.support_oppose_indicator),
    purpose: str(row.communication_type),
  };
}

export function mapElectioneeringCommRow(row: ParsedRow): FecElectioneeringComm | null {
  // CSV headers: COMMITTEE_ID, CANDIDATE_ID, REPORTED_DISBURSEMENT_AMOUNT, DISBURSEMENT_DATE, DISBURSEMENT_DESCRIPTION
  const committeeId = str(row.COMMITTEE_ID) ?? str(row.committee_id) ?? str(row.CMTE_ID);
  if (!committeeId) return null;
  return {
    committeeId,
    candidateId: str(row.CANDIDATE_ID) ?? str(row.candidate_id) ?? str(row.CAND_ID),
    amount: parseFloat(row.CALCULATED_CANDIDATE_SHARE) ?? parseFloat(row.REPORTED_DISBURSEMENT_AMOUNT) ?? 0,
    date: str(row.COMMUNICATION_DATE) ?? str(row.DISBURSEMENT_DATE),
    description: str(row.DISBURSEMENT_DESCRIPTION) ?? str(row.communication_description),
  };
}

export function mapLeadershipPacLinkRow(row: ParsedRow): FecLeadershipPacLink | null {
  // webl columns: CMTE_ID, CMTE_NM, SEN_CAN_ID, SEN_CAN_NAME, HOUSE_CAN_ID, HOUSE_CAN_NAME, REG_NUM, REG_NAME
  // Each row may have a Senate candidate, House candidate, or both — use whichever is present
  const committeeId = str(row.CMTE_ID);
  const candidateId = str(row.SEN_CAN_ID) ?? str(row.HOUSE_CAN_ID) ?? str(row.CAND_ID);
  if (!committeeId || !candidateId) return null;
  return {
    committeeId,
    candidateId,
    committeeName: str(row.CMTE_NM),
  };
}
