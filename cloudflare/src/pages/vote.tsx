import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { EntityDetailTemplate, ProvenancePanel } from "../components/page-templates";
import {
  ClaimCard,
  FundingSourceBreakdown,
  MetricCard,
  SectionCard,
  TableExplorer,
  VoteBreakdownBar,
  PartySplitBars,
} from "../components/ui-primitives";
import { buildVoteSegments } from "../lib/vote-segments";
import { VoteSplitCards } from "../components/vote-split-cards";
import { loadHouseVote, loadSenateVote, type VoteDetail } from "../lib/feed";

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

function memberLabel(m: { firstName?: string; lastName?: string; bioguideId: string }): string {
  const label = `${m.firstName ?? ""} ${m.lastName ?? ""}`.trim();
  return label || m.bioguideId;
}

export function VoteDetailPage({ chamber }: { chamber: "H" | "S" }) {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<VoteDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loader = chamber === "H" ? loadHouseVote : loadSenateVote;
    loader(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load vote");
      });
    return () => {
      cancelled = true;
    };
  }, [id, chamber]);

  if (error) {
    return (
      <main>
        <SectionCard title={`${chamber === "H" ? "House" : "Senate"} vote not found`} subtitle={error}>
          <Link className="pt-link" href="/votes">Back to votes</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) return <p className="pt-muted">Loading vote record…</p>;

  const { vote, memberVotes, funding } = data;
  const analysisGroups = funding?.groups ?? [];
  const chamberLabel = chamber === "H" ? "House" : "Senate";
  const question = vote.question ?? `${chamberLabel} roll call ${vote.rollCallNumber}`;
  const subtitle = [
    `${chamberLabel} roll call ${vote.rollCallNumber}`,
    vote.congress ? `${vote.congress}th Congress` : null,
    formatDate(vote.startDate),
    vote.result ?? "Result unavailable",
  ]
    .filter(Boolean)
    .join(" · ");

  // Build party + overall breakdowns
  let voteBreakdown: React.ReactNode = null;
  if (memberVotes.length > 0) {
    const overall: Record<string, number> = {};
    const partyMap: Record<string, Record<string, number>> = {};
    for (const mv of memberVotes) {
      const cast = mv.voteCast ?? "Unknown";
      overall[cast] = (overall[cast] ?? 0) + 1;
      const party = mv.voteParty ?? "Unknown";
      if (!partyMap[party]) partyMap[party] = {};
      partyMap[party][cast] = (partyMap[party][cast] ?? 0) + 1;
    }
    const partyOrder = ["R", "D", "I"];
    const partyNames: Record<string, string> = { R: "Republican", D: "Democrat", I: "Independent" };
    const sortedParties = Object.entries(partyMap).sort(
      ([a], [b]) =>
        (partyOrder.indexOf(a) === -1 ? 99 : partyOrder.indexOf(a)) -
        (partyOrder.indexOf(b) === -1 ? 99 : partyOrder.indexOf(b)),
    );
    voteBreakdown = (
      <SectionCard title="Vote breakdown" subtitle={`${memberVotes.length} members recorded on this roll call.`}>
        <div className="space-y-5">
          <VoteBreakdownBar title="Overall" segments={buildVoteSegments(overall)} />
          <PartySplitBars
            title="By party"
            parties={sortedParties.map(([p, counts]) => ({
              party: partyNames[p] ?? p,
              segments: buildVoteSegments(counts),
            }))}
          />
        </div>
      </SectionCard>
    );
  }

  return (
    <EntityDetailTemplate
      title={question}
      subtitle={subtitle}
      summary={
        <ClaimCard
          claim={`This ${chamberLabel} vote is linked to ${analysisGroups.length} funding groups and ${memberVotes.length} member vote records.`}
          level="high"
          evidenceCount={Math.max(analysisGroups.length, 1)}
          nonClaim="The funding split shows association across vote groups and linked receipts. It does not, by itself, establish causation."
          sourceLinks={[
            { label: "Votes hub", href: "/votes" },
            ...(vote.billId ? [{ label: vote.billId, href: `/bills/${vote.billId.toLowerCase()}` }] : []),
          ]}
        />
      }
      sidebar={
        <ProvenancePanel
          title={`${chamberLabel} vote provenance`}
          backend="static-feed"
          freshness="Latest staged vote record"
          coverage="Linked bill context and funding groups when available."
          sourceSystems={[`${chamberLabel} roll calls`, "FEC candidate financials"]}
          notes="Open the member vote table to jump from a vote record into a member profile."
        />
      }
    >
      <section className="grid gap-3 md:grid-cols-3">
        <MetricCard
          label="Roll call"
          value={String(vote.rollCallNumber ?? "—")}
          delta={vote.congress ? `Congress ${vote.congress}` : "current session"}
          period="current session"
          quality="high"
        />
        <MetricCard
          label="Result"
          value={vote.result ?? "—"}
          delta={vote.voteType ?? `${chamberLabel} vote`}
          period="roll-call outcome"
          quality="high"
        />
        <MetricCard
          label="Bill"
          value={vote.billId ?? "—"}
          delta="Linked bill identifier"
          period="current record"
          quality={vote.billId ? "high" : "medium"}
        />
      </section>

      {voteBreakdown}

      <SectionCard
        title="Funding context"
        subtitle="Vote groups ranked by member count, with receipt buckets from linked FEC candidate financials."
      >
        {analysisGroups.length ? (
          <div className="space-y-6">
            <VoteSplitCards
              groups={analysisGroups.map((g) => ({
                voteCast: g.voteCast,
                memberCount: g.memberCount ?? 0,
                matchedCandidateCount: g.candidateMatched ?? 0,
                totalReceipts: g.totalReceipts ?? 0,
              }))}
              caveat={
                <span>
                  Money on each side reflects <b>career receipts</b> of members who voted that way — it shows{" "}
                  <b>association</b>, not causation. A side raising more from a sector has not necessarily voted for that sector.
                </span>
              }
            />
            {analysisGroups.map((group) => (
              <div key={group.voteCast} className="pt-panel space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="pt-title text-base">{group.voteCast}</h3>
                    <p className="pt-muted text-sm">
                      {group.memberCount ?? 0} members · {group.candidateMatched ?? 0} matched candidate records · $
                      {Math.round(group.totalReceipts ?? 0).toLocaleString()} linked receipts
                    </p>
                  </div>
                  <span className="pt-badge">Association, not causation</span>
                </div>
                {group.sourceBreakdown?.length ? (
                  <FundingSourceBreakdown
                    title="Receipt source mix"
                    sources={group.sourceBreakdown.map((s) => ({
                      label: s.label,
                      value: s.amount,
                      detail: `${(s.share * 100).toFixed(1)}% of receipts`,
                    }))}
                  />
                ) : null}
                {group.topMembers?.length ? (
                  <TableExplorer
                    columns={["Top linked members", "Candidate receipts"]}
                    rows={group.topMembers.map((m) => [
                      m.name,
                      `$${Math.round(m.total).toLocaleString()}`,
                    ])}
                  />
                ) : null}
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
        subtitle={`${chamberLabel} members tied to this roll call, with links into member profiles.`}
      >
        {memberVotes.length ? (
          <TableExplorer
            columns={["Member", "Vote cast", "Party", "State", "Route"]}
            rows={memberVotes.map((mv) => [
              memberLabel(mv),
              mv.voteCast ?? "—",
              mv.voteParty ?? "—",
              mv.voteState ?? "—",
              { label: "Open", href: `/members/${mv.bioguideId.toLowerCase()}` },
            ])}
          />
        ) : (
          <p className="pt-muted text-sm">No member vote records are available for this roll call in the current dataset.</p>
        )}
      </SectionCard>

      <SectionCard title="Next step" subtitle="Move from the vote record to the underlying bill or back to the vote hub.">
        <div className="flex flex-wrap gap-3">
          <Link href="/votes" className="pt-button-secondary px-4 py-2 text-sm">Back to votes</Link>
          {vote.billId ? (
            <Link href={`/bills/${vote.billId.toLowerCase()}`} className="pt-button-primary px-4 py-2 text-sm">
              Open linked bill
            </Link>
          ) : null}
        </div>
      </SectionCard>
    </EntityDetailTemplate>
  );
}

export function HouseVotePage() {
  return <VoteDetailPage chamber="H" />;
}
export function SenateVotePage() {
  return <VoteDetailPage chamber="S" />;
}

export default VoteDetailPage;
