import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  UtilityRail,
} from "@/components/ui-primitives";
import { readTopContractors } from "@/lib/ingest/storage";
import { fmtCompact } from "@/lib/format";

export const revalidate = 3600;

export default async function ContractsPage() {
  const contractors = await readTopContractors();
  const sorted = [...contractors].sort(
    (a, b) => b.totalObligatedAmount - a.totalObligatedAmount,
  );

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Federal Contractors"
          subtitle={`${sorted.length} contractors ranked by total obligated amount from USASpending.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
          gapNote="Contract data from USASpending.gov. Coverage depends on agency reporting."
        />

        <SectionCard
          title="Contractor rankings"
          subtitle="All contractors ranked by total obligated amount. Open a profile for contract and political contribution details."
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Rank", "Contractor", "Total Obligated", "Contracts", "FEC PAC", "Profile"]}
              rows={sorted.map((c, i) => [
                String(i + 1),
                c.recipientName,
                fmtCompact(c.totalObligatedAmount),
                String(c.contractCount),
                c.fecCommitteeName ?? "---",
                {
                  label: "Open",
                  href: `/contracts/${encodeURIComponent(c.recipientName)}`,
                },
              ])}
            />
          </div>
        </SectionCard>
      </main>
      <UtilityRail />
    </div>
  );
}
