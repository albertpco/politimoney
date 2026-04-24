import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
  TrendChart,
} from "@/components/ui-primitives";
import { getLatestStateOutcomesRepository } from "@/lib/data/repository";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";

export const revalidate = 3600;

function PageLayout({
  title,
  subtitle,
  children,
  quality = "medium",
  freshness = "Updated from FEC filings",
  gapNote,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  quality?: "high" | "medium" | "partial";
  freshness?: string;
  gapNote?: string;
}) {
  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle title={title} subtitle={subtitle} />
        <CoverageStatusBar freshness={freshness} quality={quality} gapNote={gapNote} />
        {children}
      </main>
      <UtilityRail />
    </div>
  );
}

function OutcomesHub() {
  return (
    <PageLayout
      title="Outcomes Hub"
      subtitle="Population and quality-of-life indicators across states and time."
    >
      <SectionCard
        title="Outcome routes"
        subtitle="Metrics library and trend explorer for civic interpretation."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/outcomes/metrics"
          >
            Metrics library
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/outcomes/trends"
          >
            Trend explorer
          </Link>
        </div>
      </SectionCard>
    </PageLayout>
  );
}

function MetricsPage() {
  return (
    <PageLayout
      title="Metrics Library"
      subtitle="Definitions, caveats, and source authority for each tracked indicator."
    >
      <TableExplorer
        columns={["Metric", "Definition", "Primary source", "Lag profile"]}
        rows={[
          [
            "GDP",
            "State-level economic output",
            "Bureau datasets",
            "Low lag",
          ],
          [
            "Child poverty",
            "Share of under-18 population below poverty threshold",
            "ACS S1701",
            "Moderate lag",
          ],
          [
            "Birth/fertility",
            "Births in past 12 months per 1,000 women (15-50)",
            "ACS S1301",
            "Moderate lag",
          ],
          [
            "Child mortality",
            "Infant deaths per 1,000 live births",
            "CDC DQS archived state rates",
            "Older baseline period",
          ],
          [
            "Suicide rate",
            "Age-adjusted deaths per 100k residents",
            "CDC NCHS leading causes",
            "Older baseline",
          ],
        ]}
      />
    </PageLayout>
  );
}

async function TrendsPage() {
  const latestOutcomeRows = await getLatestStateOutcomesRepository();
  const stateRows = getStateDashboardRowsFromOutcomes(latestOutcomeRows);

  const highestChildPoverty = [...stateRows]
    .filter((entry) => entry.childPovertyValue !== undefined)
    .sort(
      (left, right) =>
        (right.childPovertyValue ?? 0) - (left.childPovertyValue ?? 0),
    )
    .slice(0, 10)
    .map((entry) => ({
      label: entry.code,
      value: entry.childPovertyValue ?? 0,
    }));

  const highestSuicide = [...stateRows]
    .filter((entry) => entry.suicideRateValue !== undefined)
    .sort(
      (left, right) =>
        (right.suicideRateValue ?? 0) - (left.suicideRateValue ?? 0),
    )
    .slice(0, 10)
    .map((entry) => ({
      label: entry.code,
      value: entry.suicideRateValue ?? 0,
    }));

  return (
    <PageLayout
      title="Trend Explorer"
      subtitle="Cross-metric trend exploration with timeline overlays and caveat labels."
      gapNote="Birth/fertility and mortality feeds can lag by one or more reporting windows."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <TrendChart
          title="Highest child-poverty states (latest snapshot)"
          points={
            highestChildPoverty.length
              ? highestChildPoverty
              : [{ label: "N/A", value: 0 }]
          }
        />
        <TrendChart
          title="Highest suicide-rate states (latest snapshot)"
          points={
            highestSuicide.length
              ? highestSuicide
              : [{ label: "N/A", value: 0 }]
          }
        />
      </div>
    </PageLayout>
  );
}

export default async function OutcomesPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <OutcomesHub />;
  if (subsection === "metrics") return <MetricsPage />;
  if (subsection === "trends") return <TrendsPage />;

  notFound();
}
