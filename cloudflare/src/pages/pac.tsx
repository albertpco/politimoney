import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { ProvenancePanel } from "../components/page-templates";
import {
  SectionCard,
  MetricCard,
  FundingSourceBreakdown,
  TableExplorer,
} from "../components/ui-primitives";
import { loadPac, type PacDetail } from "../lib/feed";
import { useSetAiContext } from "../lib/ai-context";

function money(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PacDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PacDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadPac(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load committee");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  const profileForCtx = data?.profile;

  useSetAiContext(
    profileForCtx
      ? {
          kind: "PAC / Committee",
          name: profileForCtx.label ?? profileForCtx.entityId ?? id ?? "Committee",
          id: profileForCtx.entityId ?? profileForCtx.committeeIds?.[0] ?? id,
          facts: [
            profileForCtx.issue ? `Issue: ${profileForCtx.issue}.` : null,
            profileForCtx.totalReceipts
              ? `Total receipts (latest cycle): $${Math.round(profileForCtx.totalReceipts).toLocaleString()}.`
              : null,
            profileForCtx.totalDisbursements
              ? `Total disbursements: $${Math.round(profileForCtx.totalDisbursements).toLocaleString()}.`
              : null,
            profileForCtx.cashOnHand
              ? `Cash on hand: $${Math.round(profileForCtx.cashOnHand).toLocaleString()}.`
              : null,
            profileForCtx.recipients?.length
              ? `Top recipients listed on page: ${profileForCtx.recipients.length}.`
              : null,
            profileForCtx.topDonors?.length
              ? `Top donors listed on page: ${profileForCtx.topDonors.length}.`
              : null,
          ].filter(Boolean) as string[],
        }
      : null,
  );

  if (error) {
    return (
      <main className="space-y-4">
        <SectionCard title="Committee not found" subtitle={error}>
          <Link className="pt-link" href="/pacs">Back to PACs</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) {
    return <p className="pt-muted">Loading committee record…</p>;
  }

  const profile = data.profile ?? {};
  const committeeId = profile.entityId ?? profile.committeeIds?.[0] ?? id ?? "";
  const name = profile.label ?? committeeId;
  const totalReceipts = profile.totalReceipts ?? 0;
  const topDonors = profile.topDonors ?? [];
  const recipients = profile.recipients ?? [];

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <SectionCard title={name} subtitle={`${profile.issue ? `${profile.issue} · ` : ""}Committee ID: ${committeeId}`}>
          <p className="pt-muted text-sm">
            This page resolves committee profiles by committee ID and keeps the funding data on one stable route.
          </p>
        </SectionCard>
        <div className="grid gap-4">
          <ProvenancePanel
            title="Committee provenance"
            backend="static-feed"
            runId={undefined}
            freshness="Latest public committee snapshot"
            coverage="FEC committee profile, PAC summaries, donor totals, and recipient links when available."
            sourceSystems={["FEC committees", "FEC PAC summaries", "FEC contributions", "candidate-member crosswalk"]}
            notes="Committee labels and issue text come from the loaded public records. Financial totals depend on the latest available filing cycle."
          />
        </div>

        {totalReceipts > 0 ? (
          <SectionCard title="Financial summary" subtitle="Latest public-record totals for the committee.">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Total receipts" value={money(profile.totalReceipts)} delta="classified FEC receipts" period="latest cycle" quality="high" />
              <MetricCard label="Disbursements" value={money(profile.totalDisbursements)} delta="reported committee spending" period="latest cycle" quality="high" />
              <MetricCard label="Cash on hand" value={money(profile.cashOnHand)} delta="end of period" period="latest cycle" quality="high" />
            </div>
            {(profile.totalIndividualContributions ?? profile.otherCommitteeContributions ?? profile.partyContributions ?? profile.independentExpenditures) ? (
              <div className="mt-4">
                <FundingSourceBreakdown
                  sources={[
                    {
                      label: "Individual contributions",
                      value: profile.totalIndividualContributions ?? 0,
                      detail: "Receipts attributed to individual donors when the public records can classify them.",
                    },
                    {
                      label: "Other committee contributions",
                      value: profile.otherCommitteeContributions ?? 0,
                      detail: "Transfers and support from PACs, committees, and political organizations.",
                    },
                    {
                      label: "Party contributions",
                      value: profile.partyContributions ?? 0,
                      detail: "Receipts reported from party committees.",
                    },
                    {
                      label: "Independent expenditures",
                      value: profile.independentExpenditures ?? 0,
                      detail: "Outside spending reported for the committee or linked candidate context.",
                    },
                  ]}
                />
              </div>
            ) : null}
          </SectionCard>
        ) : (
          <SectionCard title="Financial summary" subtitle="No financial data is available for this committee yet.">
            <p className="pt-muted text-sm">
              This committee may not have filed reports in the current dataset.
            </p>
          </SectionCard>
        )}

        {topDonors.length ? (
          <SectionCard title="Top donors" subtitle="Largest named donors visible in the current public records.">
            <TableExplorer
              columns={["Donor", "Total", "Context"]}
              rows={topDonors.map((donor) => [
                donor.donor ?? donor.name ?? "—",
                money(Number(donor.total ?? donor.amount ?? 0)),
                donor.employer ? `${donor.employer}${donor.occupation ? ` · ${donor.occupation}` : ""}` : "Current public-record donor total",
              ])}
            />
          </SectionCard>
        ) : null}

        {recipients.length ? (
          <SectionCard title="Top recipients" subtitle="Candidates and members supported by this committee.">
            <TableExplorer
              columns={["Recipient", "Support", "Route"]}
              rows={recipients.map((recipient) => [
                recipient.label,
                money(recipient.totalSupport ?? recipient.total ?? 0),
                recipient.href ? { label: "Open", href: recipient.href } : "—",
              ])}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Next step" subtitle="Jump back to the committee directory or search for another entity.">
          <div className="flex flex-wrap gap-3">
            <Link href="/pacs" className="pt-button-secondary px-4 py-2 text-sm">Back to PACs</Link>
            <Link href="/search" className="pt-button-primary px-4 py-2 text-sm">Search again</Link>
          </div>
        </SectionCard>
      </main>
    </div>
  );
}

export default PacDetailPage;
