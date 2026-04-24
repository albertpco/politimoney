import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CaveatPanel,
  ProvenancePanel,
} from "@/components/page-templates";
import { SectionCard, MetricCard, FundingSourceBreakdown, TableExplorer } from "@/components/ui-primitives";
import {
  findCommitteeByIdRepository,
  getCommitteeRecipientsRepository,
  getFundingProfileRepository,
} from "@/lib/data/committee-repository";
import {
  getDataBackendMode,
  getLatestRunSummaryRepository,
} from "@/lib/data/repository";

export const revalidate = 3600;

export async function generateMetadata({ params }: PacDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const committee = await findCommitteeByIdRepository(id);
  if (!committee) return { title: "Committee not found | Politired" };
  return {
    title: `${committee.name} | Politired`,
    description: `${committee.name} (${committee.committeeId}). View financial summary, top donors, and recipients.`,
  };
}

type PacDetailPageProps = {
  params: Promise<{ id: string }>;
};

function money(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function PacDetailPage({ params }: PacDetailPageProps) {
  const { id } = await params;
  const committee = await findCommitteeByIdRepository(id);
  if (!committee) notFound();

  const [fundingProfile, recipients, backend, runSummary] = await Promise.all([
    getFundingProfileRepository(committee.committeeId),
    getCommitteeRecipientsRepository(committee.committeeId, 20),
    getDataBackendMode(),
    getLatestRunSummaryRepository(),
  ]);

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <SectionCard title={committee.name} subtitle={`${committee.issue} · Committee ID: ${committee.committeeId}`}>
          <p className="pt-muted text-sm">
            This page resolves committee profiles by committee ID and keeps the funding data on one stable route.
          </p>
        </SectionCard>
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <ProvenancePanel
            title="Committee provenance"
            backend={backend}
            runId={runSummary?.runId}
            freshness={runSummary?.finishedAt ? `Latest ingest finished ${new Date(runSummary.finishedAt).toLocaleDateString("en-US")}` : "Latest loaded FEC read model"}
            coverage="FEC committee profile, PAC summaries, donor totals, and recipient links when available."
            sourceSystems={["FEC committees", "FEC PAC summaries", "FEC contributions", "candidate-member crosswalk"]}
            notes="Committee labels and issue text come from the loaded public records. Financial totals depend on the latest available filing cycle."
          />
          <CaveatPanel
            title="Claim boundary"
          >
            <p>Committee support is public-record spending or transfers, not proof of coordination unless the filing says so.</p>
            <p>Recipient links depend on candidate and member crosswalks and may be incomplete.</p>
            <p>Independent expenditures are outside-spending records and should be read separately from direct receipts.</p>
          </CaveatPanel>
        </div>

        {fundingProfile && fundingProfile.totalReceipts > 0 ? (
          <SectionCard title="Financial summary" subtitle="Latest read-model totals for the committee.">
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard label="Total receipts" value={money(fundingProfile.totalReceipts)} delta="classified FEC receipts" period="latest cycle" quality="high" />
              <MetricCard label="Disbursements" value={money(fundingProfile.totalDisbursements)} delta="reported committee spending" period="latest cycle" quality="high" />
              <MetricCard label="Cash on hand" value={money(fundingProfile.cashOnHand)} delta="end of period" period="latest cycle" quality="high" />
            </div>
            <div className="mt-4">
              <FundingSourceBreakdown
                sources={[
                  {
                    label: "Individual contributions",
                    value: fundingProfile.totalIndividualContributions,
                    detail: "Receipts attributed to individual donors when the read model can classify them.",
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
                    detail: "Outside spending reported for the committee or linked candidate context.",
                  },
                ]}
              />
            </div>
          </SectionCard>
        ) : (
          <SectionCard title="Financial summary" subtitle="No financial data is available for this committee yet.">
            <p className="pt-muted text-sm">
              This committee may not have filed reports in the current dataset.
            </p>
          </SectionCard>
        )}

        {fundingProfile?.topDonors?.length ? (
          <SectionCard title="Top donors" subtitle="Largest named donors visible in the current read model.">
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

        {recipients.length ? (
          <SectionCard title="Top recipients" subtitle="Candidates and members supported by this committee.">
            <TableExplorer
              columns={["Recipient", "Support", "Route"]}
              rows={recipients.map((recipient) => [
                recipient.label,
                money(recipient.totalSupport),
                recipient.href ? { label: "Open", href: recipient.href } : "—",
              ])}
            />
          </SectionCard>
        ) : null}

        <SectionCard title="Next step" subtitle="Jump back to the committee directory or search for another entity.">
          <div className="flex flex-wrap gap-3">
            <Link
            href="/pacs"
              className="pt-button-secondary px-4 py-2 text-sm"
            >
              Back to PACs
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
    </div>
  );
}
