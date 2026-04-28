import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import {
  EntityDetailTemplate,
  ProvenancePanel,
  CaveatPanel,
} from "../components/page-templates";
import {
  SectionCard,
  TableExplorer,
  MetricCard,
  FundingSourceBreakdown,
} from "../components/ui-primitives";
import {
  loadBill,
  loadHouseVote,
  loadSenateVote,
  loadIndex,
  loadMember,
  type BillDetail,
  type BillLinkedVote,
  type MemberDetail,
  type VoteDetail,
  type VoteFundingGroup,
} from "../lib/feed";
import { congressBillUrl } from "../lib/congress-links";
import { useSetAiContext } from "../lib/ai-context";

const VOTE_FUNDING_LIMIT = 4;

function billLabel(billType: string, billNumber: string): string {
  return `${billType.toUpperCase()} ${billNumber}`;
}

function chamberLabel(chamber: string): string {
  return chamber === "H" ? "House" : chamber === "S" ? "Senate" : chamber;
}

function money(value: number | undefined | null): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function compactMoney(value: number | undefined | null): string {
  if (!value || !Number.isFinite(value)) return "$0";
  const n = Math.abs(value);
  if (n >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return money(value);
}

function normalizeName(value: string | undefined | null): string {
  if (!value) return "";
  return value.toLowerCase().replace(/[^a-z]/g, "");
}

function looksSenate(billType: string | undefined): boolean | undefined {
  if (!billType) return undefined;
  const upper = billType.toUpperCase();
  if (upper.startsWith("S")) return true;
  if (upper.startsWith("H")) return false;
  return undefined;
}

type EnrichedLinkedVote = BillLinkedVote & {
  funding?: VoteFundingGroup[];
  loadingFunding?: boolean;
  fundingFailed?: boolean;
};

export function BillDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<BillDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voteDetails, setVoteDetails] = useState<Record<string, VoteDetail | null>>({});
  const [voteLoadFailed, setVoteLoadFailed] = useState<Record<string, boolean>>({});
  const [sponsorBioguide, setSponsorBioguide] = useState<string | null>(null);
  const [sponsorDetail, setSponsorDetail] = useState<MemberDetail | null>(null);

  // 1. Load the bill itself.
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

  // 2. Resolve sponsor → bioguide via members index (no feed change needed).
  useEffect(() => {
    if (!data?.bill.sponsor) return;
    const sponsorNorm = normalizeName(data.bill.sponsor);
    if (!sponsorNorm) return;
    const sponsorState = data.bill.sponsorState?.toUpperCase();
    const billChamberSenate = looksSenate(data.bill.billType);
    let cancelled = false;
    loadIndex("members")
      .then((rows) => {
        if (cancelled) return;
        const candidates = rows.filter((row) => normalizeName(row.label) === sponsorNorm);
        if (candidates.length === 0) {
          setSponsorBioguide(null);
          return;
        }
        // Refine by state, then by chamber suggested by bill type.
        const filteredByState = sponsorState
          ? candidates.filter((row) => (row.tags ?? []).some((t) => t?.toUpperCase() === sponsorState))
          : candidates;
        const refined = filteredByState.length ? filteredByState : candidates;
        const filteredByChamber =
          billChamberSenate === undefined
            ? refined
            : refined.filter((row) => (row.tags ?? []).some((t) => t?.toUpperCase() === (billChamberSenate ? "S" : "H")));
        const final = filteredByChamber.length ? filteredByChamber : refined;
        setSponsorBioguide(final[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setSponsorBioguide(null);
      });
    return () => {
      cancelled = true;
    };
  }, [data?.bill.sponsor, data?.bill.sponsorState, data?.bill.billType]);

  // 3. Once we know the sponsor's bioguide, fetch their funding profile.
  useEffect(() => {
    if (!sponsorBioguide) {
      setSponsorDetail(null);
      return;
    }
    let cancelled = false;
    loadMember(sponsorBioguide)
      .then((d) => {
        if (!cancelled) setSponsorDetail(d);
      })
      .catch(() => {
        if (!cancelled) setSponsorDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sponsorBioguide]);

  // 4. Fetch funding for each linked vote (capped) so the bill page surfaces
  //    the money story without forcing a click into each roll-call page.
  useEffect(() => {
    if (!data?.linkedVotes?.length) return;
    let cancelled = false;
    const top = data.linkedVotes.slice(0, VOTE_FUNDING_LIMIT);
    for (const vote of top) {
      const loader = vote.chamber === "S" ? loadSenateVote : loadHouseVote;
      loader(vote.voteId)
        .then((detail) => {
          if (cancelled) return;
          setVoteDetails((prev) => ({ ...prev, [vote.voteId]: detail }));
        })
        .catch(() => {
          if (cancelled) return;
          setVoteLoadFailed((prev) => ({ ...prev, [vote.voteId]: true }));
        });
    }
    return () => {
      cancelled = true;
    };
  }, [data?.linkedVotes]);

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
            sponsorDetail?.funding?.totalReceipts
              ? `Sponsor career receipts (latest cycle): $${Math.round(sponsorDetail.funding.totalReceipts).toLocaleString()}.`
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

  const enrichedLinkedVotes: EnrichedLinkedVote[] = useMemo(() => {
    if (!data?.linkedVotes) return [];
    return data.linkedVotes.map((vote, index) => {
      const detail = voteDetails[vote.voteId];
      return {
        ...vote,
        funding: detail?.funding?.groups ?? undefined,
        loadingFunding:
          index < VOTE_FUNDING_LIMIT &&
          voteDetails[vote.voteId] === undefined &&
          !voteLoadFailed[vote.voteId],
        fundingFailed: voteLoadFailed[vote.voteId] ?? false,
      };
    });
  }, [data?.linkedVotes, voteDetails, voteLoadFailed]);

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
  const linkedVotes = enrichedLinkedVotes;
  const houseVotes = linkedVotes.filter((v) => v.chamber === "H");
  const senateVotes = linkedVotes.filter((v) => v.chamber === "S");
  const status = bill.status ?? bill.latestActionText ?? "—";
  const congressUrl = congressBillUrl({
    congress: bill.congress,
    billType: bill.billType,
    billNumber: bill.billNumber,
    billId: bill.id,
  });
  const sponsorHref = sponsorBioguide ? `/members/${sponsorBioguide.toLowerCase()}` : null;

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
                {bill.sponsor ? (
                  <>
                    {sponsorHref ? (
                      <Link className="pt-link" href={sponsorHref}>{bill.sponsor}</Link>
                    ) : (
                      bill.sponsor
                    )}
                    {bill.sponsorParty ? ` (${bill.sponsorParty})` : ""}
                    {bill.sponsorState ? ` - ${bill.sponsorState}` : ""}
                  </>
                ) : (
                  "Unknown"
                )}
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
            notes="This route shows the bill snapshot, sponsor funding profile, and per-vote funding context where available."
          />
          <CaveatPanel title="What this does not prove">
            A bill page links sponsorship and vote context, but it does not by itself establish
            motive, cause and effect, or influence.
          </CaveatPanel>
        </div>
      }
    >
      {bill.sponsor ? (
        <SectionCard
          title="Sponsor funding"
          subtitle={
            sponsorDetail?.funding
              ? `Latest reported FEC receipts and disbursements for ${bill.sponsor}.`
              : sponsorBioguide === null
                ? `We can link the sponsor name in our records, but FEC funding data isn't available for this profile.`
                : `Looking up funding profile for ${bill.sponsor}…`
          }
        >
          {sponsorDetail?.funding && (sponsorDetail.funding.totalReceipts ?? 0) > 0 ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <MetricCard
                  label="Total receipts"
                  value={money(sponsorDetail.funding.totalReceipts)}
                  delta="classified FEC receipts"
                  period="latest cycle"
                  quality="high"
                />
                <MetricCard
                  label="Total disbursements"
                  value={money(sponsorDetail.funding.totalDisbursements)}
                  delta="reported campaign spending"
                  period="latest cycle"
                  quality="high"
                />
                <MetricCard
                  label="Cash on hand"
                  value={money(sponsorDetail.funding.cashOnHand)}
                  delta="end of period"
                  period="latest cycle"
                  quality="high"
                />
              </div>
              {sponsorDetail.funding.sourceBreakdown?.length ? (
                <FundingSourceBreakdown
                  sources={sponsorDetail.funding.sourceBreakdown.map((s) => ({
                    label: s.label,
                    value: s.amount,
                    detail: `${(s.share * 100).toFixed(1)}% of receipts`,
                  }))}
                />
              ) : null}
              {sponsorDetail.funding.topDonors?.length ? (
                <TableExplorer
                  columns={["Top donors to sponsor", "Amount", "Type"]}
                  rows={sponsorDetail.funding.topDonors.slice(0, 5).map((donor) => [
                    donor.name,
                    money(donor.amount),
                    donor.type ?? "—",
                  ])}
                />
              ) : null}
              {sponsorHref ? (
                <p className="text-xs">
                  <Link className="pt-link" href={sponsorHref}>
                    Open {bill.sponsor}'s full member profile →
                  </Link>
                </p>
              ) : null}
            </div>
          ) : sponsorBioguide === null ? (
            <p className="pt-muted text-sm">
              No matching member profile in our records. The sponsor may be retired or not yet indexed.
            </p>
          ) : (
            <p className="pt-muted text-sm">Loading sponsor funding…</p>
          )}
        </SectionCard>
      ) : null}

      <SectionCard
        title="Vote context"
        subtitle="Bills often map to one or more House or Senate roll calls. When funding analysis is available, top funders for each side appear inline."
      >
        <div className="grid gap-4 xl:grid-cols-2">
          <VoteContextColumn
            heading="House"
            chamber="H"
            votes={houseVotes}
          />
          <VoteContextColumn
            heading="Senate"
            chamber="S"
            votes={senateVotes}
          />
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

function VoteContextColumn({
  heading,
  chamber,
  votes,
}: {
  heading: string;
  chamber: "H" | "S";
  votes: EnrichedLinkedVote[];
}) {
  if (votes.length === 0) {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-stone-950">{heading}</h3>
        <p className="text-sm text-stone-600">
          No {heading} vote is linked to this bill in the public record snapshot.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-stone-950">{heading}</h3>
      <div className="space-y-3">
        {votes.slice(0, 10).map((vote) => (
          <VoteContextCard key={vote.voteId} vote={vote} chamber={chamber} />
        ))}
      </div>
    </div>
  );
}

function VoteContextCard({
  vote,
  chamber,
}: {
  vote: EnrichedLinkedVote;
  chamber: "H" | "S";
}) {
  const href = `/votes/${chamber === "H" ? "house" : "senate"}/${vote.voteId.toLowerCase()}`;
  const yea = vote.funding?.find((g) => g.voteCast?.toLowerCase() === "yea");
  const nay = vote.funding?.find((g) => g.voteCast?.toLowerCase() === "nay");
  return (
    <article className="pt-panel space-y-2 px-3 py-3 text-sm">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-stone-950">
          {chamberLabel(chamber)} Roll Call {vote.rollCallNumber ?? vote.voteId}
        </strong>
        <span className="pt-muted text-xs">
          {vote.startDate ? `${vote.startDate}` : ""}
          {vote.result ? `${vote.startDate ? " · " : ""}${vote.result}` : ""}
        </span>
      </header>
      {vote.question ? <p className="text-stone-700">{vote.question}</p> : null}
      {vote.loadingFunding ? (
        <p className="pt-muted text-xs">Loading funding rollup…</p>
      ) : vote.funding?.length ? (
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <FundingSide label="Yea" group={yea} />
          <FundingSide label="Nay" group={nay} />
        </dl>
      ) : vote.fundingFailed ? (
        <p className="pt-muted text-xs">Funding rollup unavailable for this vote.</p>
      ) : (
        <p className="pt-muted text-xs">Open the roll call for the full funding analysis.</p>
      )}
      <p className="text-xs">
        <Link className="pt-link" href={href}>Open {chamberLabel(chamber)} roll call →</Link>
      </p>
    </article>
  );
}

function FundingSide({
  label,
  group,
}: {
  label: string;
  group: VoteFundingGroup | undefined;
}) {
  if (!group) {
    return (
      <div>
        <dt className="pt-muted text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</dt>
        <dd className="mt-1 text-stone-600">Not reported.</dd>
      </div>
    );
  }
  const memberCount = group.memberCount ?? 0;
  const total = group.totalReceipts ?? 0;
  const top = group.topMembers?.[0];
  return (
    <div>
      <dt className="pt-muted text-[10px] font-semibold uppercase tracking-[0.18em]">{label}</dt>
      <dd className="mt-1 space-y-0.5 text-stone-700">
        <div>
          <strong className="text-stone-950">{memberCount.toLocaleString()}</strong> members ·{" "}
          <strong className="text-stone-950">{compactMoney(total)}</strong> in linked receipts
        </div>
        {top ? (
          <div className="pt-muted text-[11px]">
            Top: {top.name} ({compactMoney(top.total)})
          </div>
        ) : null}
      </dd>
    </div>
  );
}

export default BillDetailPage;
