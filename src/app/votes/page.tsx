import Link from "next/link";
import { PageScaffold, ProvenancePanel } from "@/components/page-templates";
import { ClaimCard, MetricCard, SectionCard, TableExplorer, TrendChart } from "@/components/ui-primitives";
import {
  getDataBackendMode,
  getHouseVoteCountRepository,
  getLatestRunSummaryRepository,
  getSenateVoteCountRepository,
} from "@/lib/data/repository";
import { getLatestBillsRepository } from "@/lib/data/bill-repository";
import { getLatestSenateVotesRepository } from "@/lib/data/vote-repository";
import { getLatestHouseVotesRepository as getLatestHouseVotesDomainRepository } from "@/lib/data/vote-repository";

export const revalidate = 3600;

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

function voteSummaryText(
  vote: {
    voteQuestion?: string;
    question?: string;
    voteQuestionText?: string;
    voteTitle?: string;
    issue?: string;
    rollCallNumber: number;
  },
  chamber: "house" | "senate",
): string {
  return (
    vote.voteQuestion ??
    vote.question ??
    vote.voteQuestionText ??
    vote.voteTitle ??
    vote.issue ??
    `${chamber === "house" ? "House" : "Senate"} roll call ${vote.rollCallNumber}`
  );
}

function voteRoute(chamber: "house" | "senate", voteId: string): string {
  return `/votes/${chamber}/${encodeURIComponent(voteId.toLowerCase())}`;
}

function billRoute(billId?: string): string | undefined {
  return billId ? `/bills/${encodeURIComponent(billId.toLowerCase())}` : undefined;
}

export default async function VotesPage() {
  const [backend, runSummary, houseVotes, senateVotes, houseCount, senateCount, bills] =
    await Promise.all([
      getDataBackendMode(),
      getLatestRunSummaryRepository(),
      getLatestHouseVotesDomainRepository(12),
      getLatestSenateVotesRepository(12),
      getHouseVoteCountRepository(),
      getSenateVoteCountRepository(),
      getLatestBillsRepository(),
    ]);

  const billMap = new Map(bills.map((bill) => [bill.id.toLowerCase(), bill]));
  const latestHouseVote = houseVotes[0];
  const latestSenateVote = senateVotes[0];
  const combinedCount = houseCount + senateCount;

  return (
    <PageScaffold
      title="Votes"
      subtitle="Browse recent House and Senate roll calls, then open the vote-level money context and linked member records."
      sidebar={
        <ProvenancePanel
          title="Vote provenance"
          backend={backend}
          runId={runSummary?.runId}
          freshness={
            runSummary?.finishedAt
              ? `Latest ingest finished ${formatDate(runSummary.finishedAt)}`
              : "Latest loaded vote artifacts"
          }
          coverage="House and Senate roll calls with linked bills and member vote records when available."
          sourceSystems={["Congress", "FEC", "Derived vote-funding summaries"]}
          notes="Use the House and Senate detail routes for vote-level funding groups, then follow through to member profiles."
        />
      }
    >
      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard
          label="House roll calls"
          value={String(houseCount)}
          delta="loaded records"
          period="current snapshot"
          quality="high"
        />
        <MetricCard
          label="Senate roll calls"
          value={String(senateCount)}
          delta="loaded records"
          period="current snapshot"
          quality="high"
        />
        <MetricCard
          label="Total roll calls"
          value={String(combinedCount)}
          delta="House + Senate"
          period="current snapshot"
          quality="high"
        />
        <MetricCard
          label="Latest loaded votes"
          value={String(houseVotes.length + senateVotes.length)}
          delta="recent items shown below"
          period="top 12 each chamber"
          quality="medium"
        />
      </section>

      {(() => {
        const houseResults: Record<string, number> = {};
        for (const v of houseVotes) {
          const r = v.result ?? "Unknown";
          houseResults[r] = (houseResults[r] ?? 0) + 1;
        }
        const senateResults: Record<string, number> = {};
        for (const v of senateVotes) {
          const r = v.resultText ?? v.result ?? "Unknown";
          senateResults[r] = (senateResults[r] ?? 0) + 1;
        }
        return (
          <div className="grid gap-4 xl:grid-cols-2">
            <TrendChart
              title="Recent House vote results"
              points={Object.entries(houseResults).map(([label, value]) => ({ label, value }))}
            />
            <TrendChart
              title="Recent Senate vote results"
              points={Object.entries(senateResults).map(([label, value]) => ({ label, value }))}
            />
          </div>
        );
      })()}

      <SectionCard
        title="What this page answers"
        subtitle="It gives you the vote, the bill if linked, and the route into the money context."
      >
        <ClaimCard
          claim="Politired links roll-call votes to bill records, member vote records, and funding analysis when the underlying data is present."
          level="high"
          evidenceCount={4}
          nonClaim="A linked vote page shows recorded relationships and receipts context. It does not by itself prove causation."
          sourceLinks={[
            { label: "Votes hub", href: "/votes" },
            ...(latestHouseVote
              ? [{ label: "Latest House vote", href: voteRoute("house", latestHouseVote.voteId) }]
              : []),
            ...(latestSenateVote
              ? [{ label: "Latest Senate vote", href: voteRoute("senate", latestSenateVote.voteId) }]
              : []),
            ...(latestHouseVote?.billId
              ? [{ label: "Latest House bill", href: billRoute(latestHouseVote.billId) ?? "/votes" }]
              : []),
            ...(latestSenateVote?.billId
              ? [{ label: "Latest Senate bill", href: billRoute(latestSenateVote.billId) ?? "/votes" }]
              : []),
          ]}
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Recent House votes"
          subtitle="Newest House roll calls in the current dataset."
        >
          <TableExplorer
            columns={["Question", "Bill", "Result", "Date", "Route"]}
            rows={houseVotes.map((vote) => {
              const bill = vote.billId ? billMap.get(vote.billId.toLowerCase()) : undefined;
              return [
                voteSummaryText(vote, "house"),
                bill
                  ? { label: bill.title, href: billRoute(bill.id) ?? "/votes" }
                  : vote.billId ?? "—",
                vote.result ?? "—",
                formatDate(vote.startDate ?? vote.updateDate),
                { label: "Open", href: voteRoute("house", vote.voteId) },
              ];
            })}
          />
        </SectionCard>

        <SectionCard
          title="Recent Senate votes"
          subtitle="Newest Senate roll calls in the current dataset."
        >
          <TableExplorer
            columns={["Question", "Bill", "Result", "Date", "Route"]}
            rows={senateVotes.map((vote) => {
              const bill = vote.billId ? billMap.get(vote.billId.toLowerCase()) : undefined;
              return [
                voteSummaryText(vote, "senate"),
                bill
                  ? { label: bill.title, href: billRoute(bill.id) ?? "/votes" }
                  : vote.billId ?? "—",
                vote.resultText ?? vote.result ?? "—",
                formatDate(vote.voteDate ?? vote.modifyDate),
                { label: "Open", href: voteRoute("senate", vote.voteId) },
              ];
            })}
          />
        </SectionCard>
      </div>

      <SectionCard
        title="Next step"
        subtitle="Open a vote detail page to inspect the funding split and member vote records."
      >
        <div className="flex flex-wrap gap-3">
          <Link
            href={latestHouseVote ? voteRoute("house", latestHouseVote.voteId) : "/votes"}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Latest House vote
          </Link>
          <Link
            href={latestSenateVote ? voteRoute("senate", latestSenateVote.voteId) : "/votes"}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Latest Senate vote
          </Link>
          <Link
            href="/search"
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Search again
          </Link>
        </div>
      </SectionCard>
    </PageScaffold>
  );
}
