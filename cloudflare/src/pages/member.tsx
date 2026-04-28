import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { ProvenancePanel } from "../components/page-templates";
import {
  SectionCard,
  MetricCard,
  FundingSourceBreakdown,
  TableExplorer,
  VoteBreakdownBar,
} from "../components/ui-primitives";
import { buildVoteSegments } from "../lib/vote-segments";
import { PeerRail } from "../components/design-primitives";
import { MemberSankey } from "../components/member-sankey";
import { MemberTimeline } from "../components/member-timeline";
import { loadMember, type MemberDetail } from "../lib/feed";
import { useSetAiContext } from "../lib/ai-context";

function formatDate(value?: string | Date | null): string {
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

function fmtMoneyShort(n: number): string {
  if (!Number.isFinite(n) || n === 0) return "$0";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<MemberDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadMember(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load member");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useSetAiContext(
    data
      ? {
          kind: "Member",
          name: data.member.name,
          id: data.member.bioguideId,
          facts: [
            `${data.member.chamber === "S" ? "Senator" : "Representative"} from ${data.member.state}${data.member.district ? `-${data.member.district}` : ""}.`,
            data.member.party || data.member.partyCode
              ? `Party: ${data.member.partyCode ?? data.member.party}.`
              : null,
            data.funding?.totalReceipts
              ? `Total campaign receipts (latest cycle): $${Math.round(data.funding.totalReceipts).toLocaleString()}.`
              : null,
            data.funding?.totalDisbursements
              ? `Total disbursements: $${Math.round(data.funding.totalDisbursements).toLocaleString()}.`
              : null,
            data.recentVotes?.length
              ? `Recent recorded votes on this page: ${data.recentVotes.length}.`
              : null,
          ].filter(Boolean) as string[],
        }
      : null,
  );

  if (error) {
    return (
      <main className="space-y-4">
        <SectionCard title="Member not found" subtitle={error}>
          <Link className="pt-link" href="/members">Back to members</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) {
    return <p className="pt-muted">Loading member record…</p>;
  }

  const { member, funding, recentVotes, peerRanking, totalRanked } = data;
  const chamber = member.chamber === "S" ? "S" : "H";

  // Tally vote positions
  const voteCounts: Record<string, number> = {};
  for (const v of recentVotes) {
    if (v.voteCast) voteCounts[v.voteCast] = (voteCounts[v.voteCast] ?? 0) + 1;
  }

  return (
    <div
      style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 280px", gap: 32, alignItems: "start" }}
      className="member-detail-grid"
    >
      <main className="min-w-0 space-y-6">
        <SectionCard
          title={member.name}
          subtitle={`${chamber === "S" ? "Senator" : "Representative"} · ${member.partyCode ?? member.party ?? "—"} · ${member.state}${member.district ? `-${member.district}` : ""}`}
        >
          <p className="pt-muted text-sm">
            This profile matches the member's official Bioguide record with campaign finance and vote records where available.
          </p>
        </SectionCard>

        <div className="grid gap-4">
          <ProvenancePanel
            title="Member profile provenance"
            backend="static-feed"
            runId={undefined}
            freshness="Latest public member snapshot"
            coverage="Congress member record, FEC-linked funding profile (when available), and recent roll-call positions."
            sourceSystems={["Congress member data", "FEC candidate financials", "House/Senate roll calls"]}
            notes="Funding totals are linked by candidate and committee identifiers. Vote and contribution records are shown together for context."
          />
        </div>

        {funding && (funding.totalReceipts ?? 0) > 0 ? (
          <SectionCard title="Funding profile" subtitle="Receipt and disbursement totals from FEC-linked data.">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Total receipts" value={money(funding.totalReceipts)} delta="classified FEC receipts" period="latest cycle" quality="high" />
              <MetricCard label="Total disbursements" value={money(funding.totalDisbursements)} delta="reported campaign spending" period="latest cycle" quality="high" />
              <MetricCard label="Cash on hand" value={money(funding.cashOnHand)} delta="end of period" period="latest cycle" quality="high" />
            </div>
            {funding.sourceBreakdown?.length ? (
              <div className="mt-4">
                <FundingSourceBreakdown
                  sources={funding.sourceBreakdown.map((s) => ({
                    label: s.label,
                    value: s.amount,
                    detail: `${(s.share * 100).toFixed(1)}% of receipts`,
                  }))}
                />
              </div>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard title="Funding profile" subtitle="No FEC-linked funding data is available for this member yet.">
            <p className="pt-muted text-sm">
              This member may not have matched candidate records yet, or their committees may not have filed yet.
            </p>
          </SectionCard>
        )}

        {funding?.topDonors?.length ? (
          <SectionCard title="Top donors" subtitle="Largest named donors visible in the current public records.">
            <TableExplorer
              columns={["Donor", "Total", "Context"]}
              rows={funding.topDonors.map((donor) => [
                donor.name,
                money(donor.amount),
                donor.employer ? `${donor.employer}${donor.occupation ? ` · ${donor.occupation}` : ""}` : "Current donor total",
              ])}
            />
          </SectionCard>
        ) : null}

        {funding && (funding.totalReceipts ?? 0) > 0 && funding.sourceBreakdown?.length ? (
          <SectionCard title="Money flow" subtitle="Receipt sources flowing into the campaign. Ribbon width shows share of receipts.">
            <MemberSankey
              sources={funding.sourceBreakdown.map((s) => ({ label: s.label, value: s.amount }))}
              targetLabel={member.name}
            />
          </SectionCard>
        ) : null}

        {recentVotes.length && recentVotes.some((v) => v.startDate) ? (
          <SectionCard title="Recent roll-call activity" subtitle="Recent recorded votes from House and Senate roll calls.">
            <MemberTimeline
              votes={recentVotes
                .filter((v) => v.startDate)
                .map((v) => ({
                  date: v.startDate as string,
                  voteCast: v.voteCast ?? "",
                  question: v.question,
                }))}
            />
          </SectionCard>
        ) : null}

        {recentVotes.length ? (
          <SectionCard
            title="Recent voting record"
            subtitle={`Last ${recentVotes.length} recorded roll calls from the ${chamber === "H" ? "House" : "Senate"}. Bills are shown as context when available.`}
          >
            <div className="space-y-4">
              <VoteBreakdownBar title="Vote position summary" segments={buildVoteSegments(voteCounts)} />
              <TableExplorer
                columns={["Roll call", "Vote", "Bill context", "Result", "Date", ""]}
                rows={recentVotes.map((vote) => [
                  vote.question ?? `Roll call ${vote.voteId}`,
                  vote.voteCast ?? "—",
                  vote.billId ?? "—",
                  vote.result ?? "—",
                  vote.startDate ? formatDate(vote.startDate) : "—",
                  {
                    label: "Open roll call",
                    href: `/votes/${chamber === "H" ? "house" : "senate"}/${encodeURIComponent(vote.voteId.toLowerCase())}`,
                  },
                ])}
              />
            </div>
          </SectionCard>
        ) : null}

        <SectionCard title="Next step" subtitle="Follow the related committee or jump back to the directory.">
          <div className="flex flex-wrap gap-3">
            <Link href="/members" className="pt-button-secondary px-4 py-2 text-sm">Back to members</Link>
            <Link href="/search" className="pt-button-primary px-4 py-2 text-sm">Search again</Link>
          </div>
        </SectionCard>
      </main>

      <aside style={{ minWidth: 0 }} className="member-detail-aside">
        {peerRanking?.length ? (
          <PeerRail
            title={`Receipts rank · ${chamber === "S" ? "Senate" : "House"}`}
            totalLabel={`/ ${totalRanked ?? peerRanking.length}`}
            rows={peerRanking.map((row) => ({
              rank: row.rank,
              label: <span style={{ fontWeight: row.bioguideId === member.bioguideId ? 600 : 500 }}>{row.name}</span>,
              value: fmtMoneyShort(row.total),
              isYou: row.bioguideId === member.bioguideId,
              href: `/members/${row.bioguideId.toLowerCase()}`,
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

export default MemberDetailPage;
