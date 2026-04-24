import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  ClaimCard,
  UtilityRail,
} from "@/components/ui-primitives";
import { readCongressTradeDisclosures } from "@/lib/ingest/storage";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

function chamberLabel(chamber: "H" | "S"): string {
  return chamber === "S" ? "Senate" : "House";
}

export default async function CongressTradesPage() {
  const disclosures = await readCongressTradeDisclosures();

  // Build most-active traders ranking by filing count
  const traderMap = new Map<
    string,
    { memberName: string; chamber: "H" | "S"; state: string; filingCount: number }
  >();
  for (const d of disclosures) {
    const key = d.bioguideId ?? d.memberName;
    const existing = traderMap.get(key);
    if (existing) {
      existing.filingCount += 1;
    } else {
      traderMap.set(key, {
        memberName: d.memberName,
        chamber: d.chamber,
        state: d.state,
        filingCount: 1,
      });
    }
  }
  const mostActive = [...traderMap.values()].sort(
    (a, b) => b.filingCount - a.filingCount,
  );

  // All filings sorted by date descending
  const sortedFilings = [...disclosures].sort((a, b) =>
    b.filingDate.localeCompare(a.filingDate),
  );

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Congressional Trade Disclosures"
          subtitle={`${disclosures.length} STOCK Act financial disclosure filings from ${traderMap.size} members.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="partial"
          gapNote="STOCK Act disclosures are self-reported. Not all transactions may be captured."
        />

        <SectionCard
          title="Most active traders"
          subtitle={`${mostActive.length} members ranked by number of financial disclosure filings.`}
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Rank", "Member", "Chamber", "State", "Filings"]}
              rows={mostActive.map((t, i) => [
                String(i + 1),
                t.memberName,
                chamberLabel(t.chamber),
                t.state,
                String(t.filingCount),
              ])}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="All filings"
          subtitle={`${sortedFilings.length} disclosure filings sorted by date.`}
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Date", "Member", "Chamber", "State", "Type", "Year", "Document"]}
              rows={sortedFilings.slice(0, 200).map((d) => [
                d.filingDate,
                d.memberName,
                chamberLabel(d.chamber),
                d.state,
                d.filingType,
                String(d.year),
                d.documentUrl
                  ? { label: "View", href: d.documentUrl }
                  : "---",
              ])}
            />
          </div>
        </SectionCard>

        <ClaimCard
          claim={`${disclosures.length} STOCK Act financial disclosure filings are on record from ${traderMap.size} congressional members.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="Disclosure filings show reported financial transactions. They do not establish insider trading, conflicts of interest, or illegal activity."
          sourceLinks={[
            { label: "House STOCK Act disclosures", href: "https://disclosures-clerk.house.gov/FinancialDisclosure" },
            ...evidenceLinks,
          ]}
        />
      </main>
      <UtilityRail />
    </div>
  );
}
