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
import {
  readLobbyingClients,
  readLobbyingFilings,
  readLobbyistContributions,
  readTopContractors,
} from "@/lib/ingest/storage";
import { fmtCompact, fmtMoney } from "@/lib/format";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

async function findClient(id: string) {
  const decoded = decodeURIComponent(id);
  const clients = await readLobbyingClients();
  return clients.find(
    (c) => c.clientName === decoded || c.clientName.toLowerCase() === decoded.toLowerCase(),
  ) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const client = await findClient(id);
  if (!client) return { title: "Lobbying client not found | Politired" };
  return {
    title: `${client.clientName} | Politired`,
    description: `Lobbying profile for ${client.clientName}. Total spending: ${fmtCompact(client.totalSpending)}, ${client.filingCount} filings.`,
  };
}

export default async function LobbyingDetailPage({ params }: Props) {
  const { id } = await params;
  const client = await findClient(id);
  if (!client) notFound();

  const [allFilings, allContributions, allContractors] = await Promise.all([
    readLobbyingFilings(),
    readLobbyistContributions(),
    readTopContractors(),
  ]);

  const clientFilings = allFilings.filter(
    (f) => f.clientName.toLowerCase() === client.clientName.toLowerCase(),
  );

  const linkedContributions = allContributions.filter((c) =>
    client.linkedFecCommittees.some(
      (cmte) => c.payeeName.toLowerCase().includes(cmte.toLowerCase()),
    ),
  );

  const linkedContractor = client.linkedContractorName
    ? allContractors.find(
        (ct) => ct.recipientName.toLowerCase() === client.linkedContractorName!.toLowerCase(),
      )
    : null;

  // Group filings by period
  const periodMap = new Map<string, { income: number; expenses: number; filings: number }>();
  for (const f of clientFilings) {
    const key = `${f.filingYear} ${f.filingPeriod}`;
    const existing = periodMap.get(key) ?? { income: 0, expenses: 0, filings: 0 };
    existing.income += f.income;
    existing.expenses += f.expenses;
    existing.filings += 1;
    periodMap.set(key, existing);
  }

  // Collect unique issues and bills
  const issueSet = new Set<string>();
  const billSet = new Set<string>();
  for (const f of clientFilings) {
    for (const a of f.lobbyingActivities) {
      issueSet.add(a.issueCode);
      for (const b of a.billNumbers) billSet.add(b);
    }
  }

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title={client.clientName}
          subtitle={`Lobbying client with ${client.filingCount} filings.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
        />
        <ClaimCard
          claim="This page combines LDA lobbying disclosures with linked FEC committee and federal contract records when matches exist."
          level="medium"
          evidenceCount={Math.max(clientFilings.length, 1)}
          nonClaim="Lobbying disclosures show registered advocacy activity. They do not prove that a donation, contract, or policy outcome was caused by the lobbying spend."
          sourceLinks={[
            { label: "Senate LDA", href: "https://lda.senate.gov/" },
            { label: "Data coverage", href: "/data-coverage/sources" },
          ]}
        />

        <SectionCard title="Spending overview" subtitle="Aggregate lobbying expenditure data.">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Total spending"
              value={fmtCompact(client.totalSpending)}
              delta="income + expenses"
              period="all filings"
              quality="medium"
            />
            <MetricCard
              label="Filings"
              value={String(client.filingCount)}
              delta="LDA filings"
              period="all periods"
              quality="medium"
            />
            <MetricCard
              label="Issue areas"
              value={String(issueSet.size)}
              delta="unique codes"
              period="all filings"
              quality="medium"
            />
          </div>
        </SectionCard>

        {periodMap.size > 0 && (
          <SectionCard title="Spending by period" subtitle="Disclosed income and expenses per filing period.">
            <TableExplorer
              columns={["Period", "Income", "Expenses", "Filings"]}
              rows={[...periodMap.entries()]
                .sort((a, b) => b[0].localeCompare(a[0]))
                .map(([period, data]) => [
                  period,
                  fmtMoney(data.income),
                  fmtMoney(data.expenses),
                  String(data.filings),
                ])}
            />
          </SectionCard>
        )}

        {issueSet.size > 0 && (
          <SectionCard title="Issue areas" subtitle="Lobbying issue codes disclosed in filings.">
            <div className="flex flex-wrap gap-2">
              {[...issueSet].sort().map((issue) => (
                <span
                  key={issue}
                  className="pt-badge px-3 py-1 text-xs text-slate-700"
                >
                  {issue}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {billSet.size > 0 && (
          <SectionCard title="Bills lobbied" subtitle="Bill numbers referenced in lobbying activities.">
            <div className="flex flex-wrap gap-2">
              {[...billSet].sort().map((bill) => (
                <span
                  key={bill}
                  className="pt-badge px-3 py-1 text-xs text-slate-700"
                >
                  {bill}
                </span>
              ))}
            </div>
          </SectionCard>
        )}

        {client.linkedFecCommittees.length > 0 && (
          <SectionCard title="Linked FEC committees" subtitle="Committees associated with this lobbying client.">
            <ul className="space-y-1">
              {client.linkedFecCommittees.map((cmte) => (
                <li key={cmte} className="pt-muted text-sm">{cmte}</li>
              ))}
            </ul>
          </SectionCard>
        )}

        {linkedContributions.length > 0 && (
          <SectionCard
            title="Linked PAC contributions"
            subtitle={`${linkedContributions.length} lobbyist contribution records linked to this client's FEC committees.`}
          >
            <TableExplorer
              columns={["Contributor", "Payee", "Amount", "Date", "Type"]}
              rows={linkedContributions.slice(0, 50).map((c) => [
                c.contributorName,
                c.payeeName,
                fmtMoney(c.amount),
                c.date,
                c.contributionType,
              ])}
            />
          </SectionCard>
        )}

        {linkedContractor && (
          <SectionCard
            title="Linked government contracts"
            subtitle={`${linkedContractor.recipientName} has ${linkedContractor.contractCount} federal contracts.`}
          >
            <div className="grid gap-3 md:grid-cols-2">
              <MetricCard
                label="Total obligated"
                value={fmtCompact(linkedContractor.totalObligatedAmount)}
                delta="federal contracts"
                period="available data"
                quality="medium"
              />
              <MetricCard
                label="Contracts"
                value={String(linkedContractor.contractCount)}
                delta="awards"
                period="available data"
                quality="medium"
              />
            </div>
          </SectionCard>
        )}

        {clientFilings.length > 0 && (
          <SectionCard
            title="Filings detail"
            subtitle={`${clientFilings.length} individual filings for this client.`}
          >
            <TableExplorer
              columns={["Registrant", "Year", "Period", "Income", "Expenses"]}
              rows={clientFilings
                .sort((a, b) => b.filingYear - a.filingYear || b.filingPeriod.localeCompare(a.filingPeriod))
                .slice(0, 100)
                .map((f) => [
                  f.registrantName,
                  String(f.filingYear),
                  f.filingPeriod,
                  fmtMoney(f.income),
                  fmtMoney(f.expenses),
                ])}
            />
          </SectionCard>
        )}

        <ClaimCard
          claim={`${client.clientName} has ${client.filingCount} lobbying filings with total disclosed spending of ${fmtCompact(client.totalSpending)}.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="Lobbying disclosures show legal advocacy activity. They do not establish that any specific policy outcome was caused by this spending."
          sourceLinks={evidenceLinks}
        />
      </main>
      <UtilityRail />
    </div>
  );
}
