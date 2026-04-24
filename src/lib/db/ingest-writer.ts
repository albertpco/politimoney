import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { buildMissingCandidateStubs } from "@/lib/data/candidate-stubs";
import { buildCandidateMemberCrosswalk } from "@/lib/data/crosswalk";
import type { IngestArtifacts, IngestRunSummary } from "@/lib/ingest/types";
import { getPrismaClient } from "@/lib/db/client";

type DbPersistResult = {
  enabled: boolean;
  wrote: boolean;
  message?: string;
};

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function billKey(input: { congress: number; billType: string; billNumber: string }): string {
  return `${input.congress}-${input.billType}-${input.billNumber}`;
}

function stateOutcomeKey(input: { stateCode: string; year: number }): string {
  return `${input.stateCode}-${input.year}`;
}

function toDate(value: string): Date {
  return new Date(value);
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

export async function createIngestRunPlaceholder(
  runId: string,
  startedAt: string,
  cycles: number[],
): Promise<void> {
  const prisma = getPrismaClient();
  if (!prisma) return;
  await prisma.ingestRun.create({
    data: {
      runId,
      startedAt: toDate(startedAt),
      finishedAt: toDate(startedAt), // placeholder, updated later
      cycle: Math.max(...cycles),
      cycles,
      candidateLimit: 0,
      fecCommitteeLimit: 0,
      fecContributionLimit: 0,
      faraRegistrantLimit: 0,
      warnings: [],
      sources: {},
      totals: {},
    },
  });
}

export async function persistIngestionToDatabase(
  summary: IngestRunSummary,
  artifacts: IngestArtifacts,
): Promise<DbPersistResult> {
  const prisma = getPrismaClient();
  if (!prisma) {
    return {
      enabled: false,
      wrote: false,
      message: "Database persistence skipped (set DATABASE_URL to enable).",
    };
  }

  try {
    await prisma.ingestRun.upsert({
      where: { runId: summary.runId },
      update: {
        startedAt: toDate(summary.startedAt),
        finishedAt: toDate(summary.finishedAt),
        cycle: Math.max(...summary.cycles),
        cycles: summary.cycles,
        candidateLimit: summary.candidateLimit,
        fecCommitteeLimit: summary.fecCommitteeLimit,
        fecContributionLimit: summary.fecContributionLimit,
        faraRegistrantLimit: summary.faraRegistrantLimit,
        warnings: summary.warnings,
        sources: summary.sources,
        totals: summary.totals,
      },
      create: {
        runId: summary.runId,
        startedAt: toDate(summary.startedAt),
        finishedAt: toDate(summary.finishedAt),
        cycle: Math.max(...summary.cycles),
        cycles: summary.cycles,
        candidateLimit: summary.candidateLimit,
        fecCommitteeLimit: summary.fecCommitteeLimit,
        fecContributionLimit: summary.fecContributionLimit,
        faraRegistrantLimit: summary.faraRegistrantLimit,
        warnings: summary.warnings,
        sources: summary.sources,
        totals: summary.totals,
      },
    });

    // Check if bulk contributions were already streamed for this run —
    // if so, skip deleting them (they'd be 50M+ rows from bulk ingestion)
    const existingContribCount = await prisma.rawFecContribution.count({
      where: { runId: summary.runId },
    });
    const hasBulkContributions = existingContribCount > summary.fecContributionLimit;

    await Promise.all([
      prisma.rawFecCandidate.deleteMany({ where: { runId: summary.runId } }),
      prisma.rawFecCommittee.deleteMany({ where: { runId: summary.runId } }),
      hasBulkContributions
        ? Promise.resolve()
        : prisma.rawFecContribution.deleteMany({ where: { runId: summary.runId } }),
      prisma.rawCongressBill.deleteMany({ where: { runId: summary.runId } }),
      prisma.rawStateOutcome.deleteMany({ where: { runId: summary.runId } }),
    ]);

    if (artifacts.fec.candidates.length) {
      await prisma.rawFecCandidate.createMany({
        data: artifacts.fec.candidates.map((candidate) => ({
          runId: summary.runId,
          sourceRecordId: candidate.candidateId,
          payloadHash: hashPayload(candidate),
          payload: candidate,
        })),
      });
    }

    if (artifacts.fec.committees.length) {
      await prisma.rawFecCommittee.createMany({
        data: artifacts.fec.committees.map((committee) => ({
          runId: summary.runId,
          sourceRecordId: committee.committeeId,
          payloadHash: hashPayload(committee),
          payload: committee,
        })),
      });
    }

    if (artifacts.fec.contributions.length && !hasBulkContributions) {
      await prisma.rawFecContribution.createMany({
        data: artifacts.fec.contributions.map((contribution) => {
          const sourceRecordId = [
            contribution.committeeId,
            contribution.donorName,
            contribution.amount,
            contribution.contributionDate ?? "",
            contribution.city ?? "",
            contribution.state ?? "",
          ].join("|");
          return {
            runId: summary.runId,
            sourceRecordId,
            payloadHash: hashPayload(contribution),
            payload: contribution,
          };
        }),
      });
    }

    if (artifacts.congress.bills.length) {
      await prisma.rawCongressBill.createMany({
        data: artifacts.congress.bills.map((bill) => ({
          runId: summary.runId,
          sourceRecordId: billKey(bill),
          payloadHash: hashPayload(bill),
          payload: bill,
        })),
      });
    }

    if (artifacts.outcomes.states.length) {
      await prisma.rawStateOutcome.createMany({
        data: artifacts.outcomes.states.map((state) => ({
          runId: summary.runId,
          sourceRecordId: stateOutcomeKey({
            stateCode: state.stateCode,
            year: state.sourceYears.census ?? Math.max(...summary.cycles),
          }),
          payloadHash: hashPayload(state),
          payload: state,
        })),
      });
    }

    await processInChunks(artifacts.fec.candidates, 50, async (candidate) => {
      await prisma.candidate.upsert({
        where: { candidateId: candidate.candidateId },
        update: {
          name: candidate.name,
          office: candidate.office,
          officeState: candidate.officeState,
          officeDistrict: candidate.officeDistrict,
          party: candidate.party,
          incumbentChallenge: candidate.incumbentChallenge,
          candidateStatus: candidate.candidateStatus,
          electionYear: candidate.electionYear,
          principalCommittees: candidate.principalCommittees,
          lastSeenRunId: summary.runId,
        },
        create: {
          candidateId: candidate.candidateId,
          name: candidate.name,
          office: candidate.office,
          officeState: candidate.officeState,
          officeDistrict: candidate.officeDistrict,
          party: candidate.party,
          incumbentChallenge: candidate.incumbentChallenge,
          candidateStatus: candidate.candidateStatus,
          electionYear: candidate.electionYear,
          principalCommittees: candidate.principalCommittees,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    await processInChunks(artifacts.fec.committees, 50, async (committee) => {
      await prisma.committee.upsert({
        where: { committeeId: committee.committeeId },
        update: {
          name: committee.name,
          committeeType: committee.committeeType,
          designation: committee.designation,
          party: committee.party,
          treasurerName: committee.treasurerName,
          filingFrequency: committee.filingFrequency,
          orgType: committee.orgType,
          connectedOrgName: committee.connectedOrgName,
          linkedCandidateId: committee.linkedCandidateId,
          lastSeenRunId: summary.runId,
        },
        create: {
          committeeId: committee.committeeId,
          name: committee.name,
          committeeType: committee.committeeType,
          designation: committee.designation,
          party: committee.party,
          treasurerName: committee.treasurerName,
          filingFrequency: committee.filingFrequency,
          orgType: committee.orgType,
          connectedOrgName: committee.connectedOrgName,
          linkedCandidateId: committee.linkedCandidateId,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    await processInChunks(artifacts.congress.members, 50, async (member) => {
      await prisma.congressMember.upsert({
        where: { bioguideId: member.bioguideId },
        update: {
          name: member.name,
          party: member.party,
          partyCode: member.partyCode,
          state: member.state,
          stateName: member.stateName,
          district: member.district,
          chamber: member.chamber,
          termStartYear: member.termStartYear,
          updateDate: member.updateDate,
          currentMember: member.currentMember,
          officialUrl: member.officialUrl,
          directOrderName: member.directOrderName,
          firstName: member.firstName,
          lastName: member.lastName,
          lastSeenRunId: summary.runId,
        },
        create: {
          bioguideId: member.bioguideId,
          name: member.name,
          party: member.party,
          partyCode: member.partyCode,
          state: member.state,
          stateName: member.stateName,
          district: member.district,
          chamber: member.chamber,
          termStartYear: member.termStartYear,
          updateDate: member.updateDate,
          currentMember: member.currentMember,
          officialUrl: member.officialUrl,
          directOrderName: member.directOrderName,
          firstName: member.firstName,
          lastName: member.lastName,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    if (artifacts.congress.memberships?.length) {
      const membershipCongresses = [
        ...new Set(artifacts.congress.memberships.map((row) => row.congress)),
      ];
      await prisma.congressMembership.deleteMany({
        where: { congress: { in: membershipCongresses } },
      });
      await prisma.congressMembership.createMany({
        data: artifacts.congress.memberships.map((row) => ({
          bioguideId: row.bioguideId,
          congress: row.congress,
          chamber: row.chamber,
          state: row.state,
          stateName: row.stateName,
          district: row.district,
          party: row.party,
          partyCode: row.partyCode,
          memberType: row.memberType,
          startYear: row.startYear,
          endYear: row.endYear,
        })),
        skipDuplicates: true,
      });
    }

    await processInChunks(artifacts.congress.bills, 40, async (bill) => {
      const id = billKey(bill);
      await prisma.bill.upsert({
        where: { billId: id },
        update: {
          congress: bill.congress,
          billType: bill.billType,
          billNumber: bill.billNumber,
          title: bill.title,
          latestActionDate: bill.latestActionDate,
          latestActionText: bill.latestActionText,
          policyArea: bill.policyArea,
          sponsor: bill.sponsor,
          sponsorParty: bill.sponsorParty,
          sponsorState: bill.sponsorState,
          lastSeenRunId: summary.runId,
        },
        create: {
          billId: id,
          congress: bill.congress,
          billType: bill.billType,
          billNumber: bill.billNumber,
          title: bill.title,
          latestActionDate: bill.latestActionDate,
          latestActionText: bill.latestActionText,
          policyArea: bill.policyArea,
          sponsor: bill.sponsor,
          sponsorParty: bill.sponsorParty,
          sponsorState: bill.sponsorState,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    await processInChunks(artifacts.congress.houseVotes, 40, async (vote) => {
      await prisma.houseVote.upsert({
        where: { voteId: vote.voteId },
        update: {
          identifier: vote.identifier,
          congress: vote.congress,
          session: vote.session,
          rollCallNumber: vote.rollCallNumber,
          startDate: vote.startDate,
          updateDate: vote.updateDate,
          voteType: vote.voteType,
          result: vote.result,
          legislationType: vote.legislationType,
          legislationNumber: vote.legislationNumber,
          voteQuestion: vote.voteQuestion,
          amendmentType: vote.amendmentType,
          amendmentNumber: vote.amendmentNumber,
          amendmentAuthor: vote.amendmentAuthor,
          legislationUrl: vote.legislationUrl,
          billId: vote.billId,
          lastSeenRunId: summary.runId,
        },
        create: {
          voteId: vote.voteId,
          identifier: vote.identifier,
          congress: vote.congress,
          session: vote.session,
          rollCallNumber: vote.rollCallNumber,
          startDate: vote.startDate,
          updateDate: vote.updateDate,
          voteType: vote.voteType,
          result: vote.result,
          legislationType: vote.legislationType,
          legislationNumber: vote.legislationNumber,
          voteQuestion: vote.voteQuestion,
          amendmentType: vote.amendmentType,
          amendmentNumber: vote.amendmentNumber,
          amendmentAuthor: vote.amendmentAuthor,
          legislationUrl: vote.legislationUrl,
          billId: vote.billId,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    if (artifacts.congress.houseVoteMemberVotes.length) {
      const voteMemberStubs = new Map<
        string,
        {
          bioguideId: string;
          state: string;
          partyCode?: string;
          firstName?: string;
          lastName?: string;
        }
      >();
      for (const row of artifacts.congress.houseVoteMemberVotes) {
        if (voteMemberStubs.has(row.bioguideId)) continue;
        voteMemberStubs.set(row.bioguideId, {
          bioguideId: row.bioguideId,
          state: row.voteState ?? "US",
          partyCode: row.voteParty,
          firstName: row.firstName,
          lastName: row.lastName,
        });
      }
      await processInChunks([...voteMemberStubs.values()], 50, async (stub) => {
        await prisma.congressMember.upsert({
          where: { bioguideId: stub.bioguideId },
          update: {
            partyCode: stub.partyCode,
            firstName: stub.firstName,
            lastName: stub.lastName,
            currentMember: undefined,
          },
          create: {
            bioguideId: stub.bioguideId,
            name:
              stub.lastName || stub.firstName
                ? `${stub.lastName ?? ""}, ${stub.firstName ?? ""}`.trim().replace(/^,\s*/, "")
                : stub.bioguideId,
            partyCode: stub.partyCode,
            state: stub.state,
            chamber: "H",
            firstName: stub.firstName,
            lastName: stub.lastName,
            firstSeenRunId: summary.runId,
            lastSeenRunId: summary.runId,
          },
        });
      });

      const voteIds = [...new Set(artifacts.congress.houseVoteMemberVotes.map((row) => row.voteId))];
      await prisma.houseVoteMemberVote.deleteMany({
        where: { voteId: { in: voteIds } },
      });
      await prisma.houseVoteMemberVote.createMany({
        data: artifacts.congress.houseVoteMemberVotes.map((row) => ({
          voteId: row.voteId,
          bioguideId: row.bioguideId,
          voteCast: row.voteCast,
          voteParty: row.voteParty,
          voteState: row.voteState,
          firstName: row.firstName,
          lastName: row.lastName,
        })),
        skipDuplicates: true,
      });
    }

    if (artifacts.congress.senateVotes?.length) {
      await processInChunks(artifacts.congress.senateVotes, 40, async (vote) => {
        await prisma.senateVote.upsert({
          where: { voteId: vote.voteId },
          update: {
            congress: vote.congress,
            session: vote.session,
            rollCallNumber: vote.rollCallNumber,
            voteDate: vote.voteDate,
            modifyDate: vote.modifyDate,
            issue: vote.issue,
            question: vote.question,
            voteQuestionText: vote.voteQuestionText,
            voteDocumentText: vote.voteDocumentText,
            voteTitle: vote.voteTitle,
            majorityRequirement: vote.majorityRequirement,
            result: vote.result,
            resultText: vote.resultText,
            billId: vote.billId,
            documentType: vote.documentType,
            documentNumber: vote.documentNumber,
            lastSeenRunId: summary.runId,
          },
          create: {
            voteId: vote.voteId,
            congress: vote.congress,
            session: vote.session,
            rollCallNumber: vote.rollCallNumber,
            voteDate: vote.voteDate,
            modifyDate: vote.modifyDate,
            issue: vote.issue,
            question: vote.question,
            voteQuestionText: vote.voteQuestionText,
            voteDocumentText: vote.voteDocumentText,
            voteTitle: vote.voteTitle,
            majorityRequirement: vote.majorityRequirement,
            result: vote.result,
            resultText: vote.resultText,
            billId: vote.billId,
            documentType: vote.documentType,
            documentNumber: vote.documentNumber,
            firstSeenRunId: summary.runId,
            lastSeenRunId: summary.runId,
          },
        });
      });
    }

    if (artifacts.congress.senateVoteMemberVotes?.length) {
      const voteIds = [
        ...new Set(artifacts.congress.senateVoteMemberVotes.map((row) => row.voteId)),
      ];
      await prisma.senateVoteMemberVote.deleteMany({
        where: { voteId: { in: voteIds } },
      });
      await prisma.senateVoteMemberVote.createMany({
        data: artifacts.congress.senateVoteMemberVotes.map((row) => ({
          voteId: row.voteId,
          bioguideId: row.bioguideId,
          lisMemberId: row.lisMemberId,
          voteCast: row.voteCast,
          voteParty: row.voteParty,
          voteState: row.voteState,
          firstName: row.firstName,
          lastName: row.lastName,
          memberFull: row.memberFull,
        })),
        skipDuplicates: true,
      });
    }

    const crosswalkRows = buildCandidateMemberCrosswalk(
      artifacts.fec.candidates,
      artifacts.congress.members,
      artifacts.fec.committees,
    );
    if (crosswalkRows.length) {
      const missingCandidateStubs = buildMissingCandidateStubs(
        crosswalkRows,
        artifacts.fec.candidates,
        artifacts.fec.committees,
        artifacts.congress.members,
      );

      if (missingCandidateStubs.length) {
        await prisma.candidate.createMany({
          data: missingCandidateStubs.map((candidate) => ({
            candidateId: candidate.candidateId,
            name: candidate.name,
            office: candidate.office,
            officeState: candidate.officeState,
            officeDistrict: candidate.officeDistrict,
            party: candidate.party,
            incumbentChallenge: candidate.incumbentChallenge,
            candidateStatus: candidate.candidateStatus,
            electionYear: candidate.electionYear,
            principalCommittees:
              candidate.principalCommittees as unknown as Prisma.InputJsonValue,
            firstSeenRunId: summary.runId,
            lastSeenRunId: summary.runId,
          })),
          skipDuplicates: true,
        });
      }

      await prisma.candidateMemberCrosswalk.deleteMany({
        where: {
          candidateId: {
            in: crosswalkRows.map((row) => row.candidateId),
          },
        },
      });
      await prisma.candidateMemberCrosswalk.createMany({
        data: crosswalkRows.map((row) => ({
          candidateId: row.candidateId,
          bioguideId: row.bioguideId,
          matchType: row.matchType,
          confidence: row.confidence,
          notes: row.notes,
        })),
        skipDuplicates: true,
      });
    }

    await processInChunks(artifacts.outcomes.states, 50, async (state) => {
      const year = state.sourceYears.census ?? Math.max(...summary.cycles);
      const id = stateOutcomeKey({ stateCode: state.stateCode, year });
      await prisma.stateOutcome.upsert({
        where: { stateOutcomeId: id },
        update: {
          stateCode: state.stateCode,
          stateName: state.stateName,
          year,
          population: state.population,
          childPovertyPct: state.childPovertyPct,
          fertilityRatePer1kWomen: state.fertilityRatePer1kWomen,
          suicideRatePer100k: state.suicideRatePer100k,
          childMortalityPer1k: state.childMortalityPer1k,
          sourceYears: state.sourceYears,
          lastSeenRunId: summary.runId,
        },
        create: {
          stateOutcomeId: id,
          stateCode: state.stateCode,
          stateName: state.stateName,
          year,
          population: state.population,
          childPovertyPct: state.childPovertyPct,
          fertilityRatePer1kWomen: state.fertilityRatePer1kWomen,
          suicideRatePer100k: state.suicideRatePer100k,
          childMortalityPer1k: state.childMortalityPer1k,
          sourceYears: state.sourceYears,
          firstSeenRunId: summary.runId,
          lastSeenRunId: summary.runId,
        },
      });
    });

    return { enabled: true, wrote: true };
  } catch (error) {
    return {
      enabled: true,
      wrote: false,
      message:
        error instanceof Error
          ? `Database persistence failed: ${error.message}`
          : "Database persistence failed: unknown error",
    };
  }
}
