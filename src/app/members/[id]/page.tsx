import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CaveatPanel,
  ProvenancePanel,
} from "@/components/page-templates";
import {
  SectionCard,
  MetricCard,
  FundingSourceBreakdown,
  TableExplorer,
  VoteBreakdownBar,
} from "@/components/ui-primitives";
import { buildVoteSegments } from "@/lib/vote-segments";
import {
  findMemberByBioguideIdRepository,
} from "@/lib/data/member-repository";
import {
  getLatestCommitteesRepository,
  getFundingProfileRepository,
} from "@/lib/data/committee-repository";
import { getRecentMemberVotePositionsRepository } from "@/lib/data/repository";
import {
  getDataBackendMode,
  getLatestRunSummaryRepository,
} from "@/lib/data/repository";
import { getMemberFundingRanking } from "@/lib/data/peer-ranking";
import { PeerRail } from "@/components/design-primitives";
import { MemberSankey } from "@/components/member-sankey";
import { MemberTimeline } from "@/components/member-timeline";

export const revalidate = 3600;

export async function generateMetadata({ params }: MemberDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const member = await findMemberByBioguideIdRepository(id);
  if (!member) return { title: "Member not found | Politired" };
  const role = member.chamber === "S" ? "Senator" : "Representative";
  return {
    title: `${member.name} | Politired`,
    description: `${role} ${member.name} (${member.partyCode ?? member.party ?? "—"}-${member.state}). View funding profile, voting record, and linked PACs.`,
  };
}

type MemberDetailPageProps = {
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

function money(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function MemberDetailPage({ params }: MemberDetailPageProps) {
  const { id } = await params;
  const member = await findMemberByBioguideIdRepository(id);
  if (!member) notFound();

  const chamber = member.chamber === "S" ? "S" : "H";
  const [fundingProfile, committees, recentVotes, backend, runSummary, peerRanking] = await Promise.all([
    getFundingProfileRepository(member.bioguideId),
    getLatestCommitteesRepository(),
    getRecentMemberVotePositionsRepository({
      bioguideId: member.bioguideId,
      chamber: chamber as "H" | "S",
      limit: 30,
    }),
    getDataBackendMode(),
    getLatestRunSummaryRepository(),
    getMemberFundingRanking(member.bioguideId),
  ]);
  const linkedCommittees = committees.filter((committee) =>
    fundingProfile?.committeeIds.includes(committee.committeeId),
  );

  // Tally vote positions for breakdown bar
  const voteCounts: Record<string, number> = {};
  for (const vote of recentVotes) {
    voteCounts[vote.voteCast] = (voteCounts[vote.voteCast] ?? 0) + 1;
  }

  function fmtMoneyShort(n: number): string {
    if (!Number.isFinite(n) || n === 0) return "$0";
    if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString()}`;
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        gap: 32,
        alignItems: "start",
      }}
      className="member-detail-grid"
    >
      <main className="min-w-0 space-y-6">
        <SectionCard
          title={member.name}
          subtitle={`${member.chamber === "S" ? "Senator" : "Representative"} · ${member.partyCode ?? member.party ?? "—"} · ${member.state}${member.district ? `-${member.district}` : ""}`}
        >
          <p className="pt-muted text-sm">
            This page uses the stable `/members/[id]` route and resolves the current member record by Bioguide ID.
          </p>
        </SectionCard>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <ProvenancePanel
            title="Member profile provenance"
            backend={backend}
            runId={runSummary?.runId}
            freshness={runSummary?.finishedAt ? `Latest ingest finished ${formatDate(runSummary.finishedAt)}` : "Latest loaded member read model"}
            coverage="Congress member record, FEC-linked funding profile, committee links, and recent roll-call positions when available."
            sourceSystems={["Congress member data", "FEC candidate financials", "FEC committees", "House/Senate roll calls"]}
            notes="Funding totals are linked by candidate and committee identifiers. Vote records and contribution records are shown together as context, not as proof of motive."
          />
          <CaveatPanel
            title="Claim boundary"
          >
            <p>Receipt totals are campaign/committee records, not payments for a vote.</p>
            <p>Crosswalks can miss old, renamed, or newly created committees.</p>
            <p>Use source-linked vote and bill pages before making a policy claim.</p>
          </CaveatPanel>
        </div>

        {fundingProfile && fundingProfile.totalReceipts > 0 ? (
          <SectionCard title="Funding profile" subtitle="Latest receipt and disbursement totals from FEC-linked data.">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Total receipts" value={money(fundingProfile.totalReceipts)} delta="classified FEC receipts" period="latest cycle" quality="high" />
              <MetricCard label="Total disbursements" value={money(fundingProfile.totalDisbursements)} delta="reported campaign spending" period="latest cycle" quality="high" />
              <MetricCard label="Cash on hand" value={money(fundingProfile.cashOnHand)} delta="end of period" period="latest cycle" quality="high" />
            </div>
            <div className="mt-4">
              <FundingSourceBreakdown
                sources={[
                  {
                    label: "Individual contributions",
                    value: fundingProfile.totalIndividualContributions,
                    detail: "Itemized and summarized individual donor receipts when available.",
                  },
                  {
                    label: "Other committee contributions",
                    value: fundingProfile.otherCommitteeContributions,
                    detail: "Transfers and support from PACs, committees, and political organizations.",
                  },
                  {
                    label: "Party contributions",
                    value: fundingProfile.partyContributions,
                    detail: "Receipts reported from party committees.",
                  },
                  {
                    label: "Independent expenditures",
                    value: fundingProfile.independentExpenditures,
                    detail: "Outside spending linked to the candidate or committee record.",
                  },
                ]}
              />
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Funding profile" subtitle="No FEC-linked funding data is available for this member yet.">
            <p className="pt-muted text-sm">
              This member may not have matched candidate records in the current dataset, or their committees may not have filed yet.
            </p>
          </SectionCard>
        )}

        {fundingProfile?.topDonors?.length ? (
          <SectionCard title="Top donors" subtitle="Largest named donors in the current read model.">
            <TableExplorer
              columns={["Donor", "Total", "Context"]}
              rows={fundingProfile.topDonors.map((donor) => [
                donor.donor,
                money(Number(donor.total)),
                "Current read-model donor total",
              ])}
            />
          </SectionCard>
        ) : null}

        {fundingProfile && fundingProfile.totalReceipts > 0 ? (
          <SectionCard
            title="Money flow"
            subtitle="Receipt sources flowing into the campaign — sketchy diagram, not a precise chart."
          >
            <MemberSankey
              sources={[
                { label: "Individual contributions", value: fundingProfile.totalIndividualContributions ?? 0 },
                { label: "Other committees", value: fundingProfile.otherCommitteeContributions ?? 0 },
                { label: "Party committees", value: fundingProfile.partyContributions ?? 0 },
                { label: "Independent expenditures", value: fundingProfile.independentExpenditures ?? 0 },
              ]}
              targetLabel={member.name}
            />
          </SectionCard>
        ) : null}

        {recentVotes.length ? (
          <SectionCard
            title="Recent activity"
            subtitle="Vote positions across the most recent congressional sessions."
          >
            <MemberTimeline
              votes={recentVotes
                .filter((v) => v.happenedAt)
                .map((v) => ({
                  date: v.happenedAt as string,
                  voteCast: v.voteCast,
                  question: v.question,
                }))}
            />
          </SectionCard>
        ) : null}

        {recentVotes.length ? (
          <SectionCard
            title="Recent voting record"
            subtitle={`Last ${recentVotes.length} roll-call votes from the ${chamber === "H" ? "House" : "Senate"}.`}
          >
            <div className="space-y-4">
              <VoteBreakdownBar
                title="Vote position summary"
                segments={buildVoteSegments(voteCounts)}
              />
              <TableExplorer
                columns={["Question", "Vote", "Bill", "Result", "Date", ""]}
                rows={recentVotes.map((vote) => [
                  vote.question ?? `Roll call ${vote.voteId}`,
                  vote.voteCast,
                  vote.billId
                    ? { label: vote.billId, href: `/bills/${encodeURIComponent(vote.billId.toLowerCase())}` }
                    : "—",
                  vote.result ?? "—",
                  vote.happenedAt ? formatDate(vote.happenedAt) : "—",
                  {
                    label: "Open",
                    href: `/votes/${chamber === "H" ? "house" : "senate"}/${encodeURIComponent(vote.voteId.toLowerCase())}`,
                  },
                ])}
              />
            </div>
          </SectionCard>
        ) : null}

        {linkedCommittees.length ? (
          <SectionCard title="Related PACs" subtitle="Committees linked through the member's funding profile.">
            <TableExplorer
              columns={["Committee", "Type", "Route"]}
              rows={linkedCommittees.slice(0, 20).map((committee) => [
                committee.name,
                committee.issue,
                {
                  label: "Open",
                  href: `/pacs/${encodeURIComponent(committee.committeeId.toLowerCase())}`,
                },
              ])}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Next step" subtitle="Follow the related committee or jump back to the directory.">
          <div className="flex flex-wrap gap-3">
            <Link
            href="/members"
              className="pt-button-secondary px-4 py-2 text-sm"
            >
              Back to members
            </Link>
            <Link
            href="/search"
              className="pt-button-primary px-4 py-2 text-sm"
            >
              Search again
            </Link>
          </div>
        </SectionCard>
      </main>
      <aside style={{ minWidth: 0 }} className="member-detail-aside">
        {peerRanking?.you ? (
          <PeerRail
            title={`Receipts rank · ${peerRanking.chamber === "S" ? "Senate" : "House"}`}
            totalLabel={`${peerRanking.you.rank.toString().padStart(2, "0")} / ${peerRanking.totalRanked}`}
            rows={peerRanking.window.map((row) => ({
              rank: row.rank,
              label: (
                <span>
                  <span style={{ fontWeight: row.bioguideId === member.bioguideId ? 600 : 500 }}>
                    {row.name}
                  </span>
                  <span style={{ color: "var(--ink-3)", fontSize: 11, marginLeft: 6 }}>
                    {row.party ?? ""} · {row.state ?? ""}
                  </span>
                </span>
              ),
              value: fmtMoneyShort(row.totalReceipts),
              isYou: row.bioguideId === member.bioguideId,
              href: `/members/${row.bioguideId}`,
            }))}
          />
        ) : null}
      </aside>
      <style>{`
        @media (max-width: 900px) {
          .member-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
