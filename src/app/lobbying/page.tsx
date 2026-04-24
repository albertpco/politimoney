import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  UtilityRail,
} from "@/components/ui-primitives";
import { readLobbyingClients } from "@/lib/ingest/storage";
import { fmtCompact } from "@/lib/format";

export const revalidate = 3600;

export default async function LobbyingPage() {
  const clients = await readLobbyingClients();
  const sorted = [...clients].sort((a, b) => b.totalSpending - a.totalSpending);

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Lobbying Clients"
          subtitle={`${sorted.length} lobbying clients ranked by total disclosed spending.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
          gapNote="Lobbying data from Senate LDA filings. Not all lobbying activity is captured."
        />

        <SectionCard
          title="Client rankings"
          subtitle="All lobbying clients ranked by total spending across all filings."
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Rank", "Client", "Total Spending", "Filings", "Top Issues", "FEC Link", "Detail"]}
              rows={sorted.map((c, i) => [
                String(i + 1),
                c.clientName,
                fmtCompact(c.totalSpending),
                String(c.filingCount),
                c.topIssues.slice(0, 3).join(", ") || "---",
                c.linkedFecCommittees.length > 0
                  ? c.linkedFecCommittees[0]
                  : "---",
                {
                  label: "Open",
                  href: `/lobbying/${encodeURIComponent(c.clientName)}`,
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
