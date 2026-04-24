import { loadEnvConfig } from "@next/env";
import { Prisma } from "@prisma/client";
import { buildMissingCandidateStubs } from "@/lib/data/candidate-stubs";
import { buildCandidateMemberCrosswalk } from "@/lib/data/crosswalk";
import { getPrismaClient } from "@/lib/db/client";
import { getIngestConfig } from "@/lib/ingest/config";
import {
  ingestCongressBills,
  ingestCongressMembers,
  ingestHouseRollCallVotes,
  ingestSenateRollCallVotes,
} from "@/lib/ingest/providers/congress";
import type {
  CongressBill,
  CongressMember,
  CongressMembership,
  FecCandidate,
  FecCommittee,
  HouseRollCallMemberVote,
  HouseRollCallVote,
  SenateRollCallMemberVote,
  SenateRollCallVote,
} from "@/lib/ingest/types";

loadEnvConfig(process.cwd());

function yearToCongress(year: number): number {
  return Math.floor((year - 1789) / 2) + 1;
}

async function processInChunks<T>(
  rows: T[],
  chunkSize: number,
  worker: (chunk: T[]) => Promise<void>,
) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    await worker(rows.slice(index, index + chunkSize));
  }
}

async function loadCandidates(): Promise<FecCandidate[]> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("DATABASE_URL is required for congress spine backfill.");
  }

  const rows = await prisma.candidate.findMany({
    orderBy: { candidateId: "asc" },
  });

  return rows.map((row) => ({
    candidateId: row.candidateId,
    name: row.name,
    office: row.office,
    officeState: row.officeState ?? undefined,
    officeDistrict: row.officeDistrict ?? undefined,
    party: row.party ?? undefined,
    incumbentChallenge: row.incumbentChallenge ?? undefined,
    candidateStatus: row.candidateStatus ?? undefined,
    electionYear: row.electionYear ?? undefined,
    principalCommittees: Array.isArray(row.principalCommittees)
      ? row.principalCommittees.filter(
          (value): value is string => typeof value === "string" && value.length > 0,
        )
      : [],
  }));
}

async function loadCommittees(): Promise<FecCommittee[]> {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("DATABASE_URL is required for congress spine backfill.");
  }

  const rows = await prisma.committee.findMany({
    orderBy: { committeeId: "asc" },
  });

  return rows.map((row) => ({
    committeeId: row.committeeId,
    name: row.name,
    committeeType: row.committeeType ?? undefined,
    designation: row.designation ?? undefined,
    party: row.party ?? undefined,
    treasurerName: row.treasurerName ?? undefined,
    filingFrequency: row.filingFrequency ?? undefined,
    orgType: row.orgType ?? undefined,
    connectedOrgName: row.connectedOrgName ?? undefined,
    linkedCandidateId: row.linkedCandidateId ?? undefined,
  }));
}

async function persistCongressMembers(
  runId: string,
  members: CongressMember[],
  memberships: CongressMembership[],
) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for congress spine backfill.");

  await processInChunks(members, 100, async (chunk) => {
    await Promise.all(
      chunk.map((member) =>
        prisma.congressMember.upsert({
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
            lastSeenRunId: runId,
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
            firstSeenRunId: runId,
            lastSeenRunId: runId,
          },
        }),
      ),
    );
  });

  const congresses = [...new Set(memberships.map((row) => row.congress))];
  if (congresses.length) {
    await prisma.congressMembership.deleteMany({
      where: { congress: { in: congresses } },
    });
    await processInChunks(memberships, 2000, async (chunk) => {
      await prisma.congressMembership.createMany({
        data: chunk.map((row) => ({
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
    });
  }
}

async function persistBills(runId: string, bills: CongressBill[]) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for congress spine backfill.");

  await processInChunks(bills, 100, async (chunk) => {
    await Promise.all(
      chunk.map((bill) => {
        const billId = `${bill.congress}-${bill.billType}-${bill.billNumber}`;
        return prisma.bill.upsert({
          where: { billId },
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
            lastSeenRunId: runId,
          },
          create: {
            billId,
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
            firstSeenRunId: runId,
            lastSeenRunId: runId,
          },
        });
      }),
    );
  });
}

async function persistHouseVotes(
  runId: string,
  votes: HouseRollCallVote[],
  memberVotes: HouseRollCallMemberVote[],
) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for congress spine backfill.");

  await processInChunks(votes, 100, async (chunk) => {
    await Promise.all(
      chunk.map((vote) =>
        prisma.houseVote.upsert({
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
            lastSeenRunId: runId,
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
            firstSeenRunId: runId,
            lastSeenRunId: runId,
          },
        }),
      ),
    );
  });

  const stubs = new Map<
    string,
    {
      bioguideId: string;
      state: string;
      partyCode?: string;
      firstName?: string;
      lastName?: string;
    }
  >();
  for (const row of memberVotes) {
    if (stubs.has(row.bioguideId)) continue;
    stubs.set(row.bioguideId, {
      bioguideId: row.bioguideId,
      state: row.voteState ?? "US",
      partyCode: row.voteParty,
      firstName: row.firstName,
      lastName: row.lastName,
    });
  }

  await processInChunks([...stubs.values()], 100, async (chunk) => {
    await Promise.all(
      chunk.map((stub) =>
        prisma.congressMember.upsert({
          where: { bioguideId: stub.bioguideId },
          update: {
            partyCode: stub.partyCode,
            firstName: stub.firstName,
            lastName: stub.lastName,
            lastSeenRunId: runId,
          },
          create: {
            bioguideId: stub.bioguideId,
            name:
              stub.lastName || stub.firstName
                ? `${stub.lastName ?? ""}, ${stub.firstName ?? ""}`
                    .trim()
                    .replace(/^,\s*/, "")
                : stub.bioguideId,
            partyCode: stub.partyCode,
            state: stub.state,
            chamber: "H",
            firstName: stub.firstName,
            lastName: stub.lastName,
            firstSeenRunId: runId,
            lastSeenRunId: runId,
          },
        }),
      ),
    );
  });

  const voteIds = [...new Set(memberVotes.map((row) => row.voteId))];
  if (voteIds.length) {
    await prisma.houseVoteMemberVote.deleteMany({
      where: { voteId: { in: voteIds } },
    });
    await processInChunks(memberVotes, 5000, async (chunk) => {
      await prisma.houseVoteMemberVote.createMany({
        data: chunk.map((row) => ({
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
    });
  }
}

async function persistSenateVotes(
  runId: string,
  votes: SenateRollCallVote[],
  memberVotes: SenateRollCallMemberVote[],
) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for congress spine backfill.");

  await processInChunks(votes, 100, async (chunk) => {
    await Promise.all(
      chunk.map((vote) =>
        prisma.senateVote.upsert({
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
            lastSeenRunId: runId,
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
            firstSeenRunId: runId,
            lastSeenRunId: runId,
          },
        }),
      ),
    );
  });

  const voteIds = [...new Set(memberVotes.map((row) => row.voteId))];
  if (voteIds.length) {
    await prisma.senateVoteMemberVote.deleteMany({
      where: { voteId: { in: voteIds } },
    });
    await processInChunks(memberVotes, 5000, async (chunk) => {
      await prisma.senateVoteMemberVote.createMany({
        data: chunk.map((row) => ({
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
    });
  }
}

async function persistCrosswalks(
  runId: string,
  candidates: FecCandidate[],
  committees: FecCommittee[],
  members: CongressMember[],
) {
  const prisma = getPrismaClient();
  if (!prisma) throw new Error("DATABASE_URL is required for congress spine backfill.");

  const rows = buildCandidateMemberCrosswalk(candidates, members, committees);
  if (!rows.length) return 0;

  const missingCandidateStubs = buildMissingCandidateStubs(
    rows,
    candidates,
    committees,
    members,
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
        firstSeenRunId: runId,
        lastSeenRunId: runId,
      })),
      skipDuplicates: true,
    });
  }

  await prisma.candidateMemberCrosswalk.deleteMany({
    where: {
      candidateId: {
        in: [...new Set(rows.map((row) => row.candidateId))],
      },
    },
  });

  await processInChunks(rows, 5000, async (chunk) => {
    await prisma.candidateMemberCrosswalk.createMany({
      data: chunk.map((row) => ({
        candidateId: row.candidateId,
        bioguideId: row.bioguideId,
        matchType: row.matchType,
        confidence: row.confidence,
        notes: row.notes,
      })),
      skipDuplicates: true,
    });
  });

  return rows.length;
}

async function main() {
  const prisma = getPrismaClient();
  if (!prisma) {
    throw new Error("DATABASE_URL is required for congress spine backfill.");
  }

  const config = getIngestConfig();
  const cycles = [...new Set(config.cycles)].sort((left, right) => left - right);
  const congresses = [...new Set(cycles.map(yearToCongress))];
  const runId = `congress-spine-${Date.now()}`;

  console.log(`[backfill] cycles: ${cycles.join(", ")}`);
  console.log(`[backfill] congresses: ${congresses.join(", ")}`);

  const [candidates, committees] = await Promise.all([loadCandidates(), loadCommittees()]);

  const billsByCycle = await Promise.all(
    cycles.map((cycle) =>
      ingestCongressBills({
        apiKey: config.congressApiKey,
        cycle,
        limit: 300,
      }),
    ),
  );

  const memberResult = await ingestCongressMembers({
    apiKey: config.congressApiKey,
    congresses,
    limit: 600,
  });

  const voteByCycle = await Promise.all(
    cycles.map((cycle) =>
      ingestHouseRollCallVotes({
        apiKey: config.congressApiKey,
        cycle,
      }),
    ),
  );
  const senateVoteByCycle: Array<{
    senateVotes: SenateRollCallVote[];
    senateVoteMemberVotes: SenateRollCallMemberVote[];
    warnings: string[];
  }> = [];
  for (const cycle of cycles) {
    senateVoteByCycle.push(
      await ingestSenateRollCallVotes({
        cycle,
        members: memberResult.members,
        memberships: memberResult.memberships,
      }),
    );
  }

  const bills = billsByCycle.flatMap((result) => result.bills);
  const houseVotes = voteByCycle.flatMap((result) => result.houseVotes);
  const houseVoteMemberVotes = voteByCycle.flatMap((result) => result.houseVoteMemberVotes);
  const senateVotes = senateVoteByCycle.flatMap((result) => result.senateVotes);
  const senateVoteMemberVotes = senateVoteByCycle.flatMap(
    (result) => result.senateVoteMemberVotes,
  );

  for (const result of billsByCycle) {
    for (const warning of result.warnings) {
      console.warn(`[congress bills] ${warning}`);
    }
  }
  for (const warning of memberResult.warnings) {
    console.warn(`[congress members] ${warning}`);
  }
  for (const result of voteByCycle) {
    for (const warning of result.warnings) {
      console.warn(`[house votes] ${warning}`);
    }
  }
  for (const result of senateVoteByCycle) {
    for (const warning of result.warnings) {
      console.warn(`[senate votes] ${warning}`);
    }
  }

  await persistCongressMembers(runId, memberResult.members, memberResult.memberships);
  await persistBills(runId, bills);
  await persistHouseVotes(runId, houseVotes, houseVoteMemberVotes);
  await persistSenateVotes(runId, senateVotes, senateVoteMemberVotes);
  const crosswalkCount = await persistCrosswalks(
    runId,
    candidates,
    committees,
    memberResult.members,
  );

  console.log(
    JSON.stringify(
      {
        runId,
        cycles,
        congresses,
        members: memberResult.members.length,
        memberships: memberResult.memberships.length,
        bills: bills.length,
        houseVotes: houseVotes.length,
        houseVoteMemberVotes: houseVoteMemberVotes.length,
        senateVotes: senateVotes.length,
        senateVoteMemberVotes: senateVoteMemberVotes.length,
        candidateMemberCrosswalks: crosswalkCount,
      },
      null,
      2,
    ),
  );

  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  const prisma = getPrismaClient();
  await prisma?.$disconnect();
  process.exit(1);
});
