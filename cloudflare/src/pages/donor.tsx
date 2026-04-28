import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { ProvenancePanel } from "../components/page-templates";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  MetricCard,
  TableExplorer,
  ClaimCard,
  UtilityRail,
} from "../components/ui-primitives";
import { fmtCompact, donorTypeLabel } from "../lib/format";
import { loadDonor, type DonorDetail } from "../lib/feed";
import { useSetAiContext } from "../lib/ai-context";

const evidenceLinks = [
  { label: "FEC.gov", href: "https://www.fec.gov" },
];

export function DonorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DonorDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadDonor(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load donor");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useSetAiContext(
    data
      ? {
          kind: "Donor",
          name: data.donor.donor,
          facts: [
            `Donor type: ${donorTypeLabel(data.donor.donorType)}.`,
            data.donor.donorEmployer ? `Employer: ${data.donor.donorEmployer}.` : null,
            data.donor.donorState ? `State: ${data.donor.donorState}.` : null,
            data.donor.totalContributed
              ? `Total contributed: $${Math.round(data.donor.totalContributed).toLocaleString()}.`
              : null,
            data.donor.contributionRows
              ? `Itemized contribution rows: ${data.donor.contributionRows.toLocaleString()}.`
              : null,
            data.donor.recipientCount
              ? `Distinct recipients: ${data.donor.recipientCount}.`
              : null,
          ].filter(Boolean) as string[],
        }
      : null,
  );

  if (error) {
    return (
      <main className="space-y-4">
        <SectionCard title="Donor not found" subtitle={error}>
          <Link className="pt-link" href="/donors">Back to donors</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) {
    return <p className="pt-muted">Loading donor record…</p>;
  }

  const donor = data.donor;
  const recipientTypeTotals = donor.topRecipients.reduce<Record<string, { total: number; count: number }>>(
    (totals, recipient) => {
      const key = recipient.entityType;
      totals[key] = {
        total: (totals[key]?.total ?? 0) + recipient.total,
        count: (totals[key]?.count ?? 0) + 1,
      };
      return totals;
    },
    {},
  );

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title={donor.donor}
          subtitle={`${donorTypeLabel(donor.donorType)} donor${donor.donorEmployer ? ` · ${donor.donorEmployer}` : ""}${donor.donorState ? ` · ${donor.donorState}` : ""}`}
        />
        <CoverageStatusBar freshness="Latest ingestion cycle" quality="medium" />
        <div className="grid gap-4">
          <ProvenancePanel
            title="Donor profile provenance"
            backend="static-feed"
            runId={undefined}
            freshness="Latest public donor snapshot"
            coverage="Itemized FEC contribution records resolved into donor and recipient summaries."
            sourceSystems={["FEC individual contributions", "FEC committees", "candidate-member crosswalk"]}
            notes="Recipient labels are normalized from available committee and candidate records. The profile is a public-record summary, not an identity verification claim."
          />
        </div>

        <SectionCard title="Overview" subtitle="Aggregate contribution data for this donor.">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              label="Total contributed"
              value={fmtCompact(donor.totalContributed)}
              delta="all committees"
              period="latest cycle"
              quality="medium"
            />
            <MetricCard
              label="Contribution rows"
              value={donor.contributionRows.toLocaleString()}
              delta="itemized records"
              period="latest cycle"
              quality="medium"
            />
            <MetricCard
              label="Recipients"
              value={String(donor.recipientCount)}
              delta="unique entities"
              period="latest cycle"
              quality="medium"
            />
            <MetricCard
              label="Type"
              value={donorTypeLabel(donor.donorType)}
              delta="classification"
              period="latest cycle"
              quality="medium"
            />
          </div>
        </SectionCard>

        {donor.topRecipients.length > 0 && (
          <>
            <SectionCard
              title="Recipient type mix"
              subtitle="Top-recipient dollars grouped by the entity type visible in the public records."
            >
              <TableExplorer
                columns={["Recipient type", "Visible recipients", "Total"]}
                rows={Object.entries(recipientTypeTotals)
                  .sort(([, left], [, right]) => right.total - left.total)
                  .map(([type, summary]) => [
                    type,
                    String(summary.count),
                    fmtCompact(summary.total),
                  ])}
              />
            </SectionCard>
            <SectionCard
              title="Top recipients"
              subtitle={`${donor.topRecipients.length} recipients ranked by total received from this donor.`}
            >
              <TableExplorer
                columns={["Recipient", "Type", "Total", "Detail"]}
                rows={donor.topRecipients.map((r) => [
                  r.label,
                  r.entityType,
                  fmtCompact(r.total),
                  r.href ? { label: "Open", href: r.href } : "—",
                ])}
              />
            </SectionCard>
          </>
        )}

        <ClaimCard
          claim={`${donor.donor} has ${donor.contributionRows.toLocaleString()} itemized contribution records totaling ${fmtCompact(donor.totalContributed)} across ${donor.recipientCount} recipients.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="Contribution records show financial transfers, not policy influence or quid pro quo arrangements."
          sourceLinks={evidenceLinks}
        />
      </main>
      <UtilityRail />
    </div>
  );
}

export default DonorDetailPage;
