import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import {
  EntityDetailTemplate,
  ProvenancePanel,
  CaveatPanel,
} from "../components/page-templates";
import { SectionCard, TableExplorer } from "../components/ui-primitives";
import { loadBill, type BillDetail } from "../lib/feed";
import { congressBillUrl } from "../lib/congress-links";
import { useSetAiContext } from "../lib/ai-context";

function billLabel(billType: string, billNumber: string): string {
  return `${billType.toUpperCase()} ${billNumber}`;
}

function chamberLabel(chamber: string): string {
  return chamber === "H" ? "House" : chamber === "S" ? "Senate" : chamber;
}

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadBill(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load bill");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useSetAiContext(
    data
      ? {
          kind: "Bill",
          name: `${data.bill.billType.toUpperCase()} ${data.bill.billNumber}${data.bill.title ? ` — ${data.bill.title}` : ""}`,
          id: data.bill.id,
          facts: [
            `Congress: ${data.bill.congress}.`,
            data.bill.sponsor
              ? `Sponsor: ${data.bill.sponsor}${data.bill.sponsorParty ? ` (${data.bill.sponsorParty}${data.bill.sponsorState ? `-${data.bill.sponsorState}` : ""})` : ""}.`
              : null,
            data.bill.status || data.bill.latestActionText
              ? `Latest action: ${data.bill.status ?? data.bill.latestActionText}${data.bill.latestActionDate ? ` (${data.bill.latestActionDate})` : ""}.`
              : null,
            data.linkedVotes?.length
              ? `Linked roll-call votes on this page: ${data.linkedVotes.length}.`
              : "No linked roll-call votes in this snapshot.",
          ].filter(Boolean) as string[],
        }
      : null,
  );

  if (error) {
    return (
      <main className="space-y-4">
        <SectionCard title="Bill not found" subtitle={error}>
          <Link className="pt-link" href="/bills">Back to bills</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) {
    return <p className="pt-muted">Loading bill record…</p>;
  }

  const bill = data.bill;
  const linkedVotes = data.linkedVotes ?? [];
  const houseVotes = linkedVotes.filter((v) => v.chamber === "H");
  const senateVotes = linkedVotes.filter((v) => v.chamber === "S");
  const status = bill.status ?? bill.latestActionText ?? "—";
  const congressUrl = congressBillUrl({
    congress: bill.congress,
    billType: bill.billType,
    billNumber: bill.billNumber,
    billId: bill.id,
  });

  return (
    <EntityDetailTemplate
      eyebrow="Public record"
      title={billLabel(bill.billType, bill.billNumber)}
      subtitle={bill.title}
      summary={
        <div className="space-y-2">
          <p className="text-sm leading-6 text-stone-700">
            {bill.sponsor ? `Sponsored by ${bill.sponsor}.` : "No sponsor is listed in the public record snapshot."}
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
              <dd className="mt-1">
                {status}
                {bill.latestActionDate ? ` · ${bill.latestActionDate}` : ""}
              </dd>
            </div>
          </dl>
          {bill.summary ? <p className="text-sm leading-6 text-stone-700">{bill.summary}</p> : null}
        </div>
      }
      sidebar={
        <div className="space-y-3">
          <ProvenancePanel
            freshness="Latest bill snapshot"
            coverage="complete"
            backend="static-feed"
            sourceSystems={["Congress", "Public data snapshot"]}
            sourceLinks={congressUrl ? [{ label: "Open on Congress.gov", href: congressUrl, external: true }] : undefined}
            notes="This route shows the bill snapshot and linked roll-call votes when available."
          />
          <CaveatPanel title="What this does not prove">
            A bill page links sponsorship and vote context, but it does not by itself establish
            motive, cause and effect, or influence.
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
            {houseVotes.length ? (
              <TableExplorer
                columns={["Roll call", "Result", "Profile"]}
                rows={houseVotes.slice(0, 10).map((vote) => [
                  `${chamberLabel("H")} Roll Call ${vote.rollCallNumber ?? vote.voteId}${vote.startDate ? ` · ${vote.startDate}` : ""} · ${vote.question ?? "Vote"}${vote.result ? ` (${vote.result})` : ""}`,
                  vote.result ?? "—",
                  { label: "Open", href: `/votes/house/${vote.voteId.toLowerCase()}` },
                ])}
              />
            ) : (
              <p className="text-sm text-stone-600">No House vote is linked to this bill in the public record snapshot.</p>
            )}
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-stone-950">Senate</h3>
            {senateVotes.length ? (
              <TableExplorer
                columns={["Roll call", "Result", "Profile"]}
                rows={senateVotes.slice(0, 10).map((vote) => [
                  `${chamberLabel("S")} Roll Call ${vote.rollCallNumber ?? vote.voteId}${vote.startDate ? ` · ${vote.startDate}` : ""} · ${vote.question ?? "Vote"}${vote.result ? ` (${vote.result})` : ""}`,
                  vote.result ?? "—",
                  { label: "Open", href: `/votes/senate/${vote.voteId.toLowerCase()}` },
                ])}
              />
            ) : (
              <p className="text-sm text-stone-600">No Senate vote is linked to this bill in the public record snapshot.</p>
            )}
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Next step" subtitle="Jump back to the directory or search for another bill.">
        <div className="flex flex-wrap gap-3">
          {congressUrl ? (
            <a
              href={congressUrl}
              target="_blank"
              rel="noreferrer"
              className="pt-button-primary px-4 py-2 text-sm"
            >
              Open on Congress.gov
            </a>
          ) : null}
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

export default BillDetailPage;
