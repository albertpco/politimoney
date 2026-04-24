import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type {
  FecCandidateCommitteeLink,
  FecCandidateFinancials,
  FecContribution,
  FecIndependentExpenditure,
  FecLeadershipPacLink,
  FecOperatingExpenditure,
  FecPacSummary,
} from "@/lib/ingest/types";

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export class BulkDbWriter {
  constructor(
    private prisma: PrismaClient,
    private runId: string,
  ) {}

  async writeContributionBatch(contributions: FecContribution[]): Promise<void> {
    if (!contributions.length) return;
    await this.prisma.rawFecContribution.createMany({
      data: contributions.map((c) => ({
        runId: this.runId,
        sourceRecordId: c.subId ?? `${c.committeeId}|${c.donorName}|${c.amount}|${c.contributionDate ?? ""}`,
        payloadHash: hashPayload(c),
        payload: c as unknown as import("@prisma/client").Prisma.InputJsonValue,
      })),
    });
  }

  async writeIndependentExpenditureBatch(
    cycle: number,
    items: FecIndependentExpenditure[],
  ): Promise<void> {
    if (!items.length) return;
    await this.prisma.independentExpenditure.createMany({
      data: items.map((ie) => ({
        runId: this.runId,
        cycle,
        committeeId: ie.committeeId,
        committeeName: ie.committeeName,
        candidateId: ie.candidateId,
        candidateName: ie.candidateName,
        amount: ie.amount,
        date: ie.date,
        supportOppose: ie.supportOppose,
        purpose: ie.purpose,
        payee: ie.payee,
        state: ie.state,
        district: ie.district,
        office: ie.office,
      })),
    });
  }

  async writeOperatingExpenditureBatch(
    cycle: number,
    items: FecOperatingExpenditure[],
  ): Promise<void> {
    if (!items.length) return;
    await this.prisma.operatingExpenditure.createMany({
      data: items.map((oe) => ({
        runId: this.runId,
        cycle,
        committeeId: oe.committeeId,
        amount: oe.amount,
        date: oe.date,
        purpose: oe.purpose,
        payee: oe.payee,
        city: oe.city,
        state: oe.state,
        zipCode: oe.zipCode,
        categoryCode: oe.categoryCode,
        transactionId: oe.transactionId,
      })),
    });
  }

  async writeCandidateCommitteeLinks(
    cycle: number,
    links: FecCandidateCommitteeLink[],
  ): Promise<void> {
    if (!links.length) return;
    await this.prisma.candidateCommitteeLink.createMany({
      data: links.map((l) => ({
        runId: this.runId,
        cycle,
        candidateId: l.candidateId,
        candidateElectionYear: l.candidateElectionYear,
        committeeId: l.committeeId,
        committeeDesignation: l.committeeDesignation,
        committeeType: l.committeeType,
      })),
      skipDuplicates: true,
    });
  }

  async writeCandidateFinancials(
    cycle: number,
    items: FecCandidateFinancials[],
  ): Promise<void> {
    if (!items.length) return;
    for (const item of items) {
      await this.prisma.candidateFinancials.upsert({
        where: {
          candidateId_cycle: { candidateId: item.candidateId, cycle },
        },
        update: {
          runId: this.runId,
          name: item.name,
          party: item.party,
          totalReceipts: item.totalReceipts,
          totalDisbursements: item.totalDisbursements,
          cashOnHand: item.cashOnHand,
          totalIndividualContributions: item.totalIndividualContributions,
          otherCommitteeContributions: item.otherCommitteeContributions,
          partyContributions: item.partyContributions,
        },
        create: {
          runId: this.runId,
          cycle,
          candidateId: item.candidateId,
          name: item.name,
          party: item.party,
          totalReceipts: item.totalReceipts,
          totalDisbursements: item.totalDisbursements,
          cashOnHand: item.cashOnHand,
          totalIndividualContributions: item.totalIndividualContributions,
          otherCommitteeContributions: item.otherCommitteeContributions,
          partyContributions: item.partyContributions,
        },
      });
    }
  }

  async writePacSummaries(cycle: number, items: FecPacSummary[]): Promise<void> {
    if (!items.length) return;
    for (const item of items) {
      await this.prisma.pacSummary.upsert({
        where: {
          committeeId_cycle: { committeeId: item.committeeId, cycle },
        },
        update: {
          runId: this.runId,
          name: item.name,
          committeeType: item.committeeType,
          designation: item.designation,
          party: item.party,
          totalReceipts: item.totalReceipts,
          totalDisbursements: item.totalDisbursements,
          cashOnHand: item.cashOnHand,
          independentExpenditures: item.independentExpenditures,
        },
        create: {
          runId: this.runId,
          cycle,
          committeeId: item.committeeId,
          name: item.name,
          committeeType: item.committeeType,
          designation: item.designation,
          party: item.party,
          totalReceipts: item.totalReceipts,
          totalDisbursements: item.totalDisbursements,
          cashOnHand: item.cashOnHand,
          independentExpenditures: item.independentExpenditures,
        },
      });
    }
  }

  async writeLeadershipPacLinks(items: FecLeadershipPacLink[]): Promise<void> {
    if (!items.length) return;
    await this.prisma.leadershipPacLink.createMany({
      data: items.map((l) => ({
        runId: this.runId,
        committeeId: l.committeeId,
        candidateId: l.candidateId,
        committeeName: l.committeeName,
      })),
      skipDuplicates: true,
    });
  }
}
