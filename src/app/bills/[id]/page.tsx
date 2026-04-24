import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  EntityDetailTemplate,
  ProvenancePanel,
  CaveatPanel,
} from "@/components/page-templates";
import {
  SectionCard,
  TableExplorer,
  VoteBreakdownBar,
} from "@/components/ui-primitives";
import { buildVoteSegments } from "@/lib/vote-segments";
import {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getLatestHouseVotesRepository,
  getLatestSenateVotesRepository,
  getHouseVoteMemberVotesRepository,
  getSenateVoteMemberVotesRepository,
} from "@/lib/data/vote-repository";
import { findBillByIdRepository } from "@/lib/data/bill-repository";

export const revalidate = 3600;

export async function generateMetadata({ params }: BillDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const bill = await findBillByIdRepository(id);
  if (!bill) return { title: "Bill not found | Politired" };
  const label = `${bill.billType.toUpperCase()} ${bill.billNumber}`;
  return {
    title: `${label} | Politired`,
    description: bill.title
      ? `${label}: ${bill.title}. View vote context, sponsor details, and funding analysis.`
      : `View vote context and funding analysis for ${label}.`,
  };
}

type BillDetailPageProps = {
  params: Promise<{ id: string }>;
};

function billLabel(billType: string, billNumber: string): string {
  return `${billType.toUpperCase()} ${billNumber}`;
}

function chamberLabel(chamber: "H" | "S"): string {
  return chamber === "H" ? "House" : "Senate";
}

function formatVoteName(
  chamber: "H" | "S",
  vote: {
    voteId: string;
    rollCallNumber: number;
    result?: string;
    question?: string;
    voteQuestion?: string;
    voteDate?: string;
    startDate?: string;
    updateDate?: string;
    session?: number;
  },
): string {
  const date = vote.voteDate ?? vote.startDate ?? vote.updateDate;
  const question = vote.question ?? vote.voteQuestion ?? "Vote";
  return `${chamberLabel(chamber)} Roll Call ${vote.rollCallNumber}${date ? ` · ${date}` : ""} · ${question} ${vote.result ? `(${vote.result})` : ""}`;
}

export default async function BillDetailPage({ params }: BillDetailPageProps) {
  const { id } = await params;
  const bill = await findBillByIdRepository(id);
  if (!bill) notFound();

  const [houseVotes, senateVotes, houseContext, senateContext] = await Promise.all([
    getLatestHouseVotesRepository(),
    getLatestSenateVotesRepository(),
    analyzeHouseVoteFundingRepository({ billId: bill.id }),
    analyzeSenateVoteFundingRepository({ billId: bill.id }),
  ]);

  const relatedHouseVotes = houseVotes.filter((vote) => vote.billId?.toLowerCase() === bill.id.toLowerCase());
  const relatedSenateVotes = senateVotes.filter((vote) => vote.billId?.toLowerCase() === bill.id.toLowerCase());

  // Fetch member votes for the first related vote in each chamber (for breakdown bars)
  const [houseMemberVotes, senateMemberVotes] = await Promise.all([
    relatedHouseVotes[0]
      ? getHouseVoteMemberVotesRepository(relatedHouseVotes[0].voteId)
      : Promise.resolve([]),
    relatedSenateVotes[0]
      ? getSenateVoteMemberVotesRepository(relatedSenateVotes[0].voteId)
      : Promise.resolve([]),
  ]);

  function tallyVotes(votes: Array<{ voteCast: string }>): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const v of votes) {
      counts[v.voteCast] = (counts[v.voteCast] ?? 0) + 1;
    }
    return counts;
  }

  return (
    <EntityDetailTemplate
      eyebrow="Public record"
      title={billLabel(bill.billType, bill.billNumber)}
      subtitle={bill.title}
      summary={
        <div className="space-y-2">
          <p className="text-sm leading-6 text-stone-700">
            {bill.sponsor ? `Sponsored by ${bill.sponsor}.` : "No sponsor is listed in the current dataset."}
          </p>
          <dl className="grid gap-3 text-sm text-stone-700 md:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Congress</dt>
              <dd className="mt-1">{bill.congress}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Bill type</dt>
              <dd className="mt-1">{bill.billType.toUpperCase()}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Sponsor</dt>
              <dd className="mt-1">
                {bill.sponsor
                  ? `${bill.sponsor}${bill.sponsorParty ? ` (${bill.sponsorParty})` : ""}${bill.sponsorState ? ` - ${bill.sponsorState}` : ""}`
                  : "Unknown"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Latest action</dt>
              <dd className="mt-1">{bill.status}</dd>
            </div>
          </dl>
          <p className="text-sm leading-6 text-stone-700">{bill.summary}</p>
        </div>
      }
      sidebar={
        <div className="space-y-3">
          <ProvenancePanel
            freshness="Latest bill snapshot"
            coverage="complete"
            backend="repository"
            sourceSystems={["Congress", "repository"]}
            notes="This route is backed by the existing bill read model and bill-linked roll-call votes."
          />
          <CaveatPanel title="What this does not prove">
            A bill page links sponsorship and vote context, but it does not by itself establish
            motive, causality, or influence.
          </CaveatPanel>
        </div>
      }
    >
      <SectionCard
        title="Vote context"
        subtitle="Bills often map to one or more House or Senate roll calls."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-950">House</h3>
            {houseMemberVotes.length > 0 ? (
              <VoteBreakdownBar
                title={relatedHouseVotes[0] ? `Roll call ${relatedHouseVotes[0].rollCallNumber}` : undefined}
                segments={buildVoteSegments(tallyVotes(houseMemberVotes))}
              />
            ) : null}
            {houseContext ? (
              <div className="rounded-[1rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                {houseContext.question ?? "No question text available."} {houseContext.result ? `(${houseContext.result})` : ""}
              </div>
            ) : (
              <p className="text-sm text-stone-600">No House vote funding context found for this bill.</p>
            )}
            {relatedHouseVotes.length ? (
              <TableExplorer
                columns={["Roll call", "Result", "Profile"]}
                rows={relatedHouseVotes.slice(0, 10).map((vote) => [
                  formatVoteName("H", vote),
                  vote.result ?? "—",
                  {
                    label: "Open",
                    href: `/votes/house/${vote.voteId}`,
                  },
                ])}
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-950">Senate</h3>
            {senateMemberVotes.length > 0 ? (
              <VoteBreakdownBar
                title={relatedSenateVotes[0] ? `Roll call ${relatedSenateVotes[0].rollCallNumber}` : undefined}
                segments={buildVoteSegments(tallyVotes(senateMemberVotes))}
              />
            ) : null}
            {senateContext ? (
              <div className="rounded-[1rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
                {senateContext.question ?? "No question text available."} {senateContext.result ? `(${senateContext.result})` : ""}
              </div>
            ) : (
              <p className="text-sm text-stone-600">No Senate vote funding context found for this bill.</p>
            )}
            {relatedSenateVotes.length ? (
              <TableExplorer
                columns={["Roll call", "Result", "Profile"]}
                rows={relatedSenateVotes.slice(0, 10).map((vote) => [
                  formatVoteName("S", vote),
                  vote.result ?? "—",
                  {
                    label: "Open",
                    href: `/votes/senate/${vote.voteId}`,
                  },
                ])}
              />
            ) : null}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Next step" subtitle="Jump back to the directory or search for another bill.">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/bills"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Back to bills
          </Link>
          <Link
            href="/search"
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Search again
          </Link>
        </div>
      </SectionCard>
    </EntityDetailTemplate>
  );
}
