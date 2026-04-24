import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  MetricCard,
  FundingSourceBreakdown,
  TableExplorer,
  ClaimCard,
  UtilityRail,
} from "@/components/ui-primitives";
import { readTopContractors, readContracts } from "@/lib/ingest/storage";
import { getFundingProfileRepository } from "@/lib/data/repository";
import { fmtCompact, fmtMoney } from "@/lib/format";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

async function findContractor(id: string) {
  const decoded = decodeURIComponent(id);
  const contractors = await readTopContractors();
  return contractors.find(
    (c) =>
      c.recipientName === decoded ||
      c.recipientName.toLowerCase() === decoded.toLowerCase(),
  ) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contractor = await findContractor(id);
  if (!contractor) return { title: "Contractor not found | Politired" };
  return {
    title: `${contractor.recipientName} | Politired`,
    description: `Federal contractor profile for ${contractor.recipientName}. Total obligated: ${fmtCompact(contractor.totalObligatedAmount)}, ${contractor.contractCount} contracts.`,
  };
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const contractor = await findContractor(id);
  if (!contractor) notFound();

  const allContracts = await readContracts();
  const contractorContracts = allContracts
    .filter(
      (c) => c.recipientName.toLowerCase() === contractor.recipientName.toLowerCase(),
    )
    .sort((a, b) => {
      const dateA = a.awardDate ?? a.startDate ?? "";
      const dateB = b.awardDate ?? b.startDate ?? "";
      return dateB.localeCompare(dateA);
    });

  const fundingProfile = contractor.fecCommitteeId
    ? await getFundingProfileRepository(contractor.fecCommitteeId)
    : null;

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title={contractor.recipientName}
          subtitle={`Federal contractor with ${contractor.contractCount} contracts.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
        />

        <SectionCard title="Contract overview" subtitle="Aggregate federal contract data.">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Total obligated"
              value={fmtCompact(contractor.totalObligatedAmount)}
              delta="all contracts"
              period="available data"
              quality="medium"
            />
            <MetricCard
              label="Contracts"
              value={String(contractor.contractCount)}
              delta="award count"
              period="available data"
              quality="medium"
            />
            <MetricCard
              label="FEC PAC"
              value={contractor.fecCommitteeName ?? "None linked"}
              delta={contractor.fecCommitteeId ?? "no match"}
              period="latest cycle"
              quality={contractor.fecCommitteeId ? "medium" : "partial"}
            />
          </div>
        </SectionCard>

        {contractor.topAgencies.length > 0 && (
          <SectionCard title="Top agencies" subtitle="Agencies awarding contracts to this contractor.">
            <TableExplorer
              columns={["Agency", "Amount"]}
              rows={contractor.topAgencies.map((a) => [
                a.agency,
                fmtCompact(a.amount),
              ])}
            />
          </SectionCard>
        )}

        {contractor.topNaics.length > 0 && (
          <SectionCard title="Top NAICS" subtitle="Industry classifications for awarded contracts.">
            <TableExplorer
              columns={["Code", "Description", "Amount"]}
              rows={contractor.topNaics.map((n) => [
                n.code,
                n.description,
                fmtCompact(n.amount),
              ])}
            />
          </SectionCard>
        )}

        {fundingProfile && fundingProfile.totalReceipts > 0 && (
          <SectionCard
            title="Political contributions"
            subtitle={`Funding profile for linked PAC: ${contractor.fecCommitteeName}.`}
          >
            <div className="grid gap-3 md:grid-cols-3">
              <MetricCard
                label="Total receipts"
                value={fmtCompact(fundingProfile.totalReceipts)}
                delta="classified FEC receipts"
                period="latest cycle"
                quality="medium"
              />
              <MetricCard
                label="Disbursements"
                value={fmtCompact(fundingProfile.totalDisbursements ?? 0)}
                delta="reported committee spending"
                period="latest cycle"
                quality="medium"
              />
              <MetricCard
                label="Unique donors"
                value={String(fundingProfile.uniqueDonors)}
                delta="contributor count"
                period="latest cycle"
                quality="medium"
              />
            </div>
            <div className="mt-4">
              <FundingSourceBreakdown
                sources={[
                  { label: "Individual contributions", value: fundingProfile.totalIndividualContributions },
                  { label: "Other committee contributions", value: fundingProfile.otherCommitteeContributions },
                  { label: "Party contributions", value: fundingProfile.partyContributions },
                  { label: "Independent expenditures", value: fundingProfile.independentExpenditures },
                ]}
              />
            </div>
          </SectionCard>
        )}

        {contractorContracts.length > 0 && (
          <SectionCard
            title="Recent contracts"
            subtitle={`${contractorContracts.length} individual contract awards.`}
          >
            <TableExplorer
              columns={["Award ID", "Agency", "Amount", "Date", "Description"]}
              rows={contractorContracts.slice(0, 100).map((c) => [
                c.awardId,
                c.awardingAgency ?? "---",
                fmtMoney(c.totalObligatedAmount ?? c.awardAmount),
                c.awardDate ?? c.startDate ?? "---",
                c.contractDescription?.slice(0, 80) ?? "---",
              ])}
            />
          </SectionCard>
        )}

        <ClaimCard
          claim={`${contractor.recipientName} has ${contractor.contractCount} federal contracts totaling ${fmtCompact(contractor.totalObligatedAmount)} in obligated funds.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="Contract data shows federal spending awarded to this entity. It does not establish improper procurement or political favoritism."
          sourceLinks={[
            { label: "USASpending.gov", href: "https://www.usaspending.gov/" },
            ...evidenceLinks,
          ]}
        />
      </main>
      <UtilityRail />
    </div>
  );
}
