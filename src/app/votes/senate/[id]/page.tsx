import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EntityDetailTemplate, ProvenancePanel } from "@/components/page-templates";
import {
  ClaimCard,
  FundingSourceBreakdown,
  MetricCard,
  SectionCard,
  TableExplorer,
  VoteBreakdownBar,
  PartySplitBars,
} from "@/components/ui-primitives";
import { buildVoteSegments } from "@/lib/vote-segments";
import { VoteSplitCards } from "@/components/vote-split-cards";
import {
  analyzeSenateVoteFundingRepository,
  getDataBackendMode,
  getLatestRunSummaryRepository,
  getSenateVoteMemberVotesRepository,
} from "@/lib/data/repository";
import { getLatestBillsRepository } from "@/lib/data/bill-repository";
import { findSenateVoteByIdRepository } from "@/lib/data/vote-repository";

export const revalidate = 3600;

export async function generateMetadata({ params }: SenateVotePageProps): Promise<Metadata> {
  const { id } = await params;
  const vote = await findSenateVoteByIdRepository(id);
  if (!vote) return { title: "Senate vote not found | Politired" };
  const question = vote.question ?? "Vote";
  return {
    title: `Senate Roll Call ${vote.rollCallNumber} | Politired`,
    description: `${question}${vote.result ? ` (${vote.result})` : ""}. View member breakdown, party split, and funding analysis.`,
  };
}

type SenateVotePageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value?: string | Date): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? String(value)
    : new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(parsed);
}

function voteSummaryText(vote: {
  question?: string;
  voteQuestionText?: string;
  voteTitle?: string;
  issue?: string;
  rollCallNumber: number;
}): string {
  return (
    vote.question ??
    vote.voteQuestionText ??
    vote.voteTitle ??
    vote.issue ??
    `Senate roll call ${vote.rollCallNumber}`
  );
}

function memberLabel(member: {
  memberFull?: string;
  firstName?: string;
  lastName?: string;
  bioguideId: string;
}): string {
  const label = member.memberFull ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim();
  return label || member.bioguideId;
}

export default async function SenateVotePage({ params }: SenateVotePageProps) {
  const { id } = await params;

  const [backend, runSummary, votes, bills] = await Promise.all([
    getDataBackendMode(),
    getLatestRunSummaryRepository(),
    findSenateVoteByIdRepository(id),
    getLatestBillsRepository(),
  ]);
  const vote = votes;
  if (!vote) notFound();

  const [analysis, memberVotes] = await Promise.all([
    analyzeSenateVoteFundingRepository({ voteId: vote.voteId }),
    getSenateVoteMemberVotesRepository(vote.voteId),
  ]);

  const normalizedBillId = vote.billId?.toLowerCase();
  const bill = normalizedBillId
    ? bills.find((entry) => entry.id === normalizedBillId)
    : undefined;
  const question = voteSummaryText(vote);
  const subtitle = [
    `Senate roll call ${vote.rollCallNumber}`,
    `${vote.congress}th Congress`,
    formatDate(vote.voteDate ?? vote.modifyDate),
    vote.resultText ?? vote.result ?? "Result unavailable",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <EntityDetailTemplate
      title={question}
      subtitle={subtitle}
      summary={
        <ClaimCard
          claim={`This Senate vote is linked to ${analysis?.groups.length ?? 0} funding groups and ${memberVotes.length} member vote records.`}
          level="high"
          evidenceCount={Math.max(analysis?.groups.length ?? 0, 1)}
          nonClaim="The funding split shows association across vote groups and linked receipts. It does not, by itself, establish causation."
          sourceLinks={[
            { label: "Votes hub", href: "/votes" },
            ...(bill ? [{ label: bill.title, href: `/bills/${bill.id}` }] : []),
          ]}
        />
      }
      sidebar={
        <ProvenancePanel
          title="Senate vote provenance"
          backend={backend}
          runId={runSummary?.runId}
          freshness={
            runSummary?.finishedAt
              ? `Latest ingest finished ${formatDate(runSummary.finishedAt)}`
              : "Latest loaded Senate vote"
          }
          coverage="Linked bill context and funding groups when available."
          sourceSystems={["SenateVote", "SenateVoteMemberVote", "FEC candidate financials"]}
          notes="Open the member vote table to jump from a vote record into a member profile."
        />
      }
    >
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Roll call"
          value={String(vote.rollCallNumber)}
          delta={`Congress ${vote.congress}`}
          period={vote.session ? `session ${vote.session}` : "current session"}
          quality="high"
        />
        <MetricCard
          label="Result"
          value={vote.resultText ?? vote.result ?? "—"}
          delta={vote.majorityRequirement ?? "Senate vote"}
          period="roll-call outcome"
          quality="high"
        />
        <MetricCard
          label="Bill"
          value={bill?.billNumber ?? vote.billId ?? "—"}
          delta={bill?.title ?? "Linked bill identifier"}
          period="current record"
          quality={bill ? "high" : "medium"}
        />
      </section>

      {memberVotes.length > 0 ? (() => {
        const overallCounts: Record<string, number> = {};
        const partyBreakdown: Record<string, Record<string, number>> = {};
        for (const mv of memberVotes) {
          overallCounts[mv.voteCast] = (overallCounts[mv.voteCast] ?? 0) + 1;
          const party = mv.voteParty ?? "Unknown";
          if (!partyBreakdown[party]) partyBreakdown[party] = {};
          partyBreakdown[party][mv.voteCast] = (partyBreakdown[party][mv.voteCast] ?? 0) + 1;
        }
        const partyOrder = ["R", "D", "I"];
        const partyNames: Record<string, string> = { R: "Republican", D: "Democrat", I: "Independent" };
        const sortedParties = Object.entries(partyBreakdown).sort(
          ([a], [b]) => (partyOrder.indexOf(a) === -1 ? 99 : partyOrder.indexOf(a)) - (partyOrder.indexOf(b) === -1 ? 99 : partyOrder.indexOf(b)),
        );
        return (
          <SectionCard title="Vote breakdown" subtitle={`${memberVotes.length} senators recorded on this roll call.`}>
            <div className="space-y-5">
              <VoteBreakdownBar title="Overall" segments={buildVoteSegments(overallCounts)} />
              <PartySplitBars
                title="By party"
                parties={sortedParties.map(([party, counts]) => ({
                  party: partyNames[party] ?? party,
                  segments: buildVoteSegments(counts),
                }))}
              />
            </div>
          </SectionCard>
        );
      })() : null}

      <SectionCard
        title="Funding context"
        subtitle="Vote groups ranked by member count, with receipt buckets from linked FEC candidate financials."
      >
        {analysis?.groups.length ? (
          <div className="space-y-6">
            <VoteSplitCards
              groups={analysis.groups.map((g) => ({
                voteCast: g.voteCast,
                memberCount: g.memberCount,
                matchedCandidateCount: g.matchedCandidateCount,
                totalReceipts: g.totalReceipts,
              }))}
              caveat={
                <span>
                  Money on each side reflects <b>career receipts</b> of members who voted that way — it shows{" "}
                  <b>association</b>, not causation. A side raising more from a sector hasn't necessarily voted for that sector.
                </span>
              }
            />
            {analysis.groups.map((group) => (
              <div key={group.voteCast} className="pt-panel space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="pt-title text-base">{group.voteCast}</h3>
                    <p className="pt-muted text-sm">
                      {group.memberCount} senators · {group.matchedCandidateCount} matched candidate records · ${Math.round(group.totalReceipts).toLocaleString()} linked receipts
                    </p>
                  </div>
                  <span className="pt-badge">Association, not causation</span>
                </div>
                <FundingSourceBreakdown
                  title="Receipt source mix"
                  sources={[
                    {
                      label: "Individual contributions",
                      value: group.totalIndividualContributions,
                      detail: "Candidate financial receipts reported from individual contributors.",
                    },
                    {
                      label: "Other committee contributions",
                      value: group.otherCommitteeContributions,
                      detail: "Transfers and support from PACs and other political committees.",
                    },
                    {
                      label: "Party contributions",
                      value: group.partyContributions,
                      detail: "Receipts reported from party committees.",
                    },
                    {
                      label: "Independent expenditures",
                      value: group.independentExpenditures,
                      detail: "Outside spending linked to candidate financial context when available.",
                    },
                  ]}
                />
                <TableExplorer
                  columns={["Top linked senators", "Candidate receipts"]}
                  rows={group.topMembers.map((member) => [
                    member.name,
                    `$${Math.round(member.totalReceipts).toLocaleString()}`,
                  ])}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="pt-muted text-sm">
            No funding analysis summary is available for this vote yet. The roll-call record can still be inspected, but candidate financial joins were not available for this vote.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Member vote records"
        subtitle="Senators tied to this roll call, with links into member profiles."
      >
        {memberVotes.length ? (
          <TableExplorer
            columns={["Member", "Vote cast", "Party", "State", "Route"]}
            rows={memberVotes.map((memberVote) => [
              memberLabel(memberVote),
              memberVote.voteCast,
              memberVote.voteParty ?? "—",
              memberVote.voteState ?? "—",
              { label: "Open", href: `/members/${memberVote.bioguideId.toLowerCase()}` },
            ])}
          />
        ) : (
          <p className="pt-muted text-sm">No member vote records are available for this roll call in the current dataset.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Next step"
        subtitle="Move from the vote record to the underlying bill or back to the vote hub."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href="/votes"
            className="pt-button-secondary px-4 py-2 text-sm"
          >
            Back to votes
          </Link>
          {bill ? (
            <Link
              href={`/bills/${bill.id}`}
              className="pt-button-primary px-4 py-2 text-sm"
            >
              Open linked bill
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </EntityDetailTemplate>
  );
}
