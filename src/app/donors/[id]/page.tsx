import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  CaveatPanel,
  ProvenancePanel,
} from "@/components/page-templates";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  MetricCard,
  TableExplorer,
  ClaimCard,
  UtilityRail,
} from "@/components/ui-primitives";
import {
  getDataBackendMode,
  getDonorProfileRepository,
  getLatestRunSummaryRepository,
} from "@/lib/data/repository";
import { fmtCompact, donorTypeLabel } from "@/lib/format";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const donor = await getDonorProfileRepository(id);
  if (!donor) return { title: "Donor not found | Politired" };
  return {
    title: `${donor.donor} | Politired`,
    description: `Donor profile for ${donor.donor}. Total contributed: ${fmtCompact(donor.totalContributed)}, ${donor.recipientCount} recipients.`,
  };
}

export default async function DonorDetailPage({ params }: Props) {
  const { id } = await params;
  const [donor, backend, runSummary] = await Promise.all([
    getDonorProfileRepository(id),
    getDataBackendMode(),
    getLatestRunSummaryRepository(),
  ]);
  if (!donor) notFound();
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
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
        />
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <ProvenancePanel
            title="Donor profile provenance"
            backend={backend}
            runId={runSummary?.runId}
            freshness={runSummary?.finishedAt ? `Latest ingest finished ${new Date(runSummary.finishedAt).toLocaleDateString("en-US")}` : "Latest loaded FEC read model"}
            coverage="Itemized FEC contribution records resolved into donor and recipient summaries."
            sourceSystems={["FEC individual contributions", "FEC committees", "candidate-member crosswalk"]}
            notes="Recipient labels are normalized from available committee and candidate records. The profile is a public-record summary, not an identity verification claim."
          />
          <CaveatPanel
            title="Claim boundary"
          >
            <p>Totals reflect records currently loaded into the local read model.</p>
            <p>A contribution record does not establish policy influence, intent, or a quid pro quo.</p>
            <p>Named donors can share names; use employer, state, recipient, and dates before drawing conclusions.</p>
          </CaveatPanel>
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
            subtitle="Top-recipient dollars grouped by the entity type visible in the read model."
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
                { label: "Open", href: r.href },
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
