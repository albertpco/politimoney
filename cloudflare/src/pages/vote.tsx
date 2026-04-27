import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { EntityDetailTemplate, ProvenancePanel } from "../components/page-templates";
import {
  MetricCard,
  SectionCard,
  TableExplorer,
  VoteBreakdownBar,
  PartySplitBars,
} from "../components/ui-primitives";
import { buildVoteSegments } from "../lib/vote-segments";
import { loadHouseVote, loadIndex, loadSenateVote, type VoteDetail } from "../lib/feed";
import { congressBillUrl } from "../lib/congress-links";

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
  const [billHref, setBillHref] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const loader = chamber === "H" ? loadHouseVote : loadSenateVote;
    loader(id)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          const billId = d.vote.billId?.toLowerCase();
          if (!billId) {
            setBillHref(null);
            return;
          }
          loadIndex("bills")
            .then((bills) => {
              if (!cancelled) {
                setBillHref(bills.some((bill) => bill.id.toLowerCase() === billId) ? `/bills/${billId}` : null);
              }
            })
            .catch(() => {
              if (!cancelled) setBillHref(null);
            });
        }
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
  const congressUrl =
    vote.legislationUrl ??
    congressBillUrl({
      congress: vote.congress,
      billType: vote.documentType,
      billNumber: vote.documentNumber,
      billId: vote.billId,
    });

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
      sidebar={
        <ProvenancePanel
          title={`${chamberLabel} vote provenance`}
          backend="static-feed"
          freshness="Latest public vote snapshot"
          coverage="Linked bill context and funding groups when available."
          sourceSystems={[`${chamberLabel} roll calls`, "FEC candidate financials"]}
          sourceLinks={congressUrl ? [{ label: "Open linked measure on Congress.gov", href: congressUrl, external: true }] : undefined}
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
        <div className="pt-card p-4">
          <div className="metric">
            <span className="label">Bill identifier</span>
            {congressUrl ? (
              <a
                href={congressUrl}
                target="_blank"
                rel="noreferrer"
                className="value pt-link"
                style={{ color: "var(--source)", textDecorationThickness: "1px" }}
              >
                {vote.billId ?? "Open measure"}
              </a>
            ) : (
              <span className="value">{vote.billId ?? "—"}</span>
            )}
            <span className="delta">
              {congressUrl ? "Open on Congress.gov" : "Linked measure"} <span className="muted">(public record)</span>
            </span>
          </div>
        </div>
      </section>

      {voteBreakdown}

      <SectionCard
        title="Who voted how"
        subtitle={`${chamberLabel} members on this roll call, with party, state, vote, and profile links.`}
      >
        {memberVotes.length ? (
          <TableExplorer
            columns={["Member", "Vote", "Party", "State", "Profile"]}
            rows={memberVotes.map((mv) => [
              memberLabel(mv),
              mv.voteCast ?? "—",
              mv.voteParty ?? "—",
              mv.voteState ?? "—",
              { label: "Open profile", href: `/members/${mv.bioguideId.toLowerCase()}` },
            ])}
          />
        ) : (
          <p className="pt-muted text-sm">No member vote records are available for this roll call in the public record snapshot.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Funding boundary"
        subtitle="Money shown here is context around member vote groups, not an explanation for a vote."
      >
        {analysisGroups.length ? (
          <div className="space-y-4">
            <div className="caveat">
              <span className="badge">Boundary</span>
              <div>
                Public money records are not clear proof of why anyone voted. Use the member table above for party, state, vote, and profile links.
              </div>
            </div>
            {analysisGroups.map((group) => (
              <div key={group.voteCast} className="pt-panel space-y-3 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="pt-title text-base">{group.voteCast}</h3>
                    <p className="pt-muted text-sm">
                      {group.memberCount ?? 0} members in this vote group
                    </p>
                  </div>
                  <span className="pt-badge">Context only</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="pt-muted text-sm">No funding comparison is available for this vote. The member vote table below is still the primary record.</p>
        )}
      </SectionCard>

      <SectionCard title="Next step" subtitle="Move from the vote record to the underlying bill or back to the vote hub.">
        <div className="flex flex-wrap gap-3">
          <Link href="/votes" className="pt-button-secondary px-4 py-2 text-sm">Back to votes</Link>
          {billHref ? (
            <Link href={billHref} className="pt-button-secondary px-4 py-2 text-sm">
              Open PolitiMoney bill page
            </Link>
          ) : vote.billId ? (
            <span className="pt-muted self-center text-sm">Linked bill page unavailable in this snapshot: {vote.billId}</span>
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
