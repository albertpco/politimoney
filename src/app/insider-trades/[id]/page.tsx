import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  MetricCard,
  TableExplorer,
  ClaimCard,
  UtilityRail,
} from "@/components/ui-primitives";
import { getInsiderTradesByCompanyRepository } from "@/lib/data/repository";
import type { InsiderTransactionType } from "@/lib/ingest/types";
import { fmtCompact, fmtMoney } from "@/lib/format";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

function formatTransactionType(type: InsiderTransactionType): string {
  switch (type) {
    case "P":
      return "Purchase";
    case "S":
      return "Sale";
    case "S-OE":
      return "Sale (OE)";
    case "M":
      return "Exercise";
    case "A":
      return "Award";
    case "D":
      return "Disposition";
    case "F":
      return "Tax withholding";
    case "G":
      return "Gift";
    case "I":
      return "Discretionary";
    case "J":
      return "Other acquisition";
    case "X":
      return "Option exercise";
    case "C":
      return "Conversion";
    case "V":
      return "Voluntary report";
    case "OE":
      return "Option expiration";
    default:
      return "Other";
  }
}

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const ticker = decodeURIComponent(id).toUpperCase();
  const result = await getInsiderTradesByCompanyRepository(ticker, 100);
  if (!result.summary) return { title: `${ticker} insider trades | Politired` };
  return {
    title: `${result.summary.ticker} - ${result.summary.companyName} | Politired`,
    description: `Insider trading activity for ${result.summary.companyName} (${result.summary.ticker}). ${result.summary.tradeCount} trades with net value ${fmtCompact(Math.abs(result.summary.netValue))}.`,
  };
}

export default async function InsiderTradeDetailPage({ params }: Props) {
  const { id } = await params;
  const ticker = decodeURIComponent(id).toUpperCase();
  const result = await getInsiderTradesByCompanyRepository(ticker, 100);
  if (!result.summary && result.trades.length === 0) notFound();

  const summary = result.summary;
  const trades = result.trades;

  const companyName = summary?.companyName ?? trades[0]?.companyName ?? ticker;

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title={`${ticker} - ${companyName}`}
          subtitle="SEC Form 4 insider trading activity."
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
        />

        {summary && (
          <SectionCard title="Insider trading summary" subtitle="Aggregate Form 4 filing data.">
            <div className="grid gap-3 md:grid-cols-4">
              <MetricCard
                label="Net value"
                value={fmtCompact(Math.abs(summary.netValue))}
                delta={summary.netValue >= 0 ? "net buying" : "net selling"}
                period="all filings"
                quality="medium"
              />
              <MetricCard
                label="Buy value"
                value={fmtCompact(summary.buyValue)}
                delta={`${summary.totalBuys} purchases`}
                period="all filings"
                quality="medium"
              />
              <MetricCard
                label="Sell value"
                value={fmtCompact(summary.sellValue)}
                delta={`${summary.totalSells} sales`}
                period="all filings"
                quality="medium"
              />
              <MetricCard
                label="Total trades"
                value={String(summary.tradeCount)}
                delta="Form 4 transactions"
                period="all filings"
                quality="medium"
              />
            </div>
          </SectionCard>
        )}

        {trades.length > 0 && (
          <SectionCard
            title="Trade history"
            subtitle={`${trades.length} individual insider transactions.`}
          >
            <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
              <TableExplorer
                columns={["Date", "Insider", "Title", "Type", "Shares", "Price", "Value"]}
                rows={trades.map((t) => [
                  t.transactionDate,
                  t.insiderName,
                  t.insiderTitle ?? "---",
                  formatTransactionType(t.transactionType),
                  t.shares.toLocaleString(),
                  fmtMoney(t.pricePerShare),
                  fmtCompact(t.totalValue),
                ])}
              />
            </div>
          </SectionCard>
        )}

        <ClaimCard
          claim={`${companyName} (${ticker}) has ${summary?.tradeCount ?? trades.length} insider transactions on file with the SEC.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="Insider trading filings are routine corporate disclosures. They do not indicate illegal activity or market manipulation."
          sourceLinks={[
            { label: "SEC EDGAR", href: "https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&type=4" },
            ...evidenceLinks,
          ]}
        />
      </main>
      <UtilityRail />
    </div>
  );
}
