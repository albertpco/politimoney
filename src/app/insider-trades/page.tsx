import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  UtilityRail,
} from "@/components/ui-primitives";
import { readInsiderTradeSummaries } from "@/lib/ingest/storage";
import { fmtCompact } from "@/lib/format";

export const revalidate = 3600;

export default async function InsiderTradesPage() {
  const summaries = await readInsiderTradeSummaries();
  const sorted = [...summaries].sort(
    (a, b) => Math.abs(b.netValue) - Math.abs(a.netValue),
  );

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Insider Trades"
          subtitle={`${sorted.length} companies ranked by absolute net insider trading value from SEC Form 4 filings.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
          gapNote="Insider trade data from SEC EDGAR Form 4 filings. Coverage limited to electronically filed forms."
        />

        <SectionCard
          title="Company rankings"
          subtitle="All companies ranked by net insider trading value. Open a detail page for trade history."
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Rank", "Ticker", "Company", "Net Value", "Buys", "Sells", "FEC PAC", "Contractor", "Detail"]}
              rows={sorted.map((s, i) => [
                String(i + 1),
                s.ticker,
                s.companyName,
                fmtCompact(Math.abs(s.netValue)),
                String(s.totalBuys),
                String(s.totalSells),
                s.fecCommitteeName ?? "---",
                s.contractorName ?? "---",
                {
                  label: "Open",
                  href: `/insider-trades/${encodeURIComponent(s.ticker)}`,
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
