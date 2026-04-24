import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  CompareStrip,
  StateValueMap,
} from "@/components/ui-primitives";
import {
  getLatestSenatorEntitiesRepository,
  getLatestStateOutcomesRepository,
  getLatestCountryInfluenceEntitiesRepository,
} from "@/lib/data/repository";
import { readFecContributions } from "@/lib/ingest/storage";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";

export const revalidate = 3600;

function PageLayout({
  title,
  subtitle,
  children,
  quality = "medium",
  freshness = "Updated from FEC filings",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  quality?: "high" | "medium" | "partial";
  freshness?: string;
}) {
  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle title={title} subtitle={subtitle} />
        <CoverageStatusBar freshness={freshness} quality={quality} />
        {children}
      </main>
      <UtilityRail />
    </div>
  );
}

function CompareHub() {
  return (
    <PageLayout
      title="Compare Landing"
      subtitle="Run side-by-side accountability comparisons for senators, states, and countries."
    >
      <SectionCard
        title="Choose comparison view"
        subtitle="Compare different topics with consistent metrics."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/compare/senators"
          >
            Compare senators
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/compare/states"
          >
            Compare states
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/compare/countries"
          >
            Compare countries
          </Link>
        </div>
      </SectionCard>
    </PageLayout>
  );
}

async function CompareSenators() {
  const [latestOutcomeRows, senatorEntities, contributions] = await Promise.all(
    [
      getLatestStateOutcomesRepository(),
      getLatestSenatorEntitiesRepository(),
      readFecContributions(),
    ],
  );
  const stateRows = getStateDashboardRowsFromOutcomes(latestOutcomeRows);

  const ranked = senatorEntities
    .map((senator) => {
      const committeeSet = new Set(senator.principalCommittees);
      const rows = contributions.filter((row) =>
        committeeSet.has(row.committeeId),
      );
      const total = rows.reduce((sum, row) => sum + row.amount, 0);
      return {
        senator,
        contributionRows: rows.length,
        sampledContributionTotal: total,
      };
    })
    .sort(
      (left, right) =>
        right.sampledContributionTotal - left.sampledContributionTotal,
    );

  const left = ranked[0];
  const right = ranked[1];
  const leftState = stateRows.find(
    (entry) => entry.id === left?.senator.state.toLowerCase(),
  );
  const rightState = stateRows.find(
    (entry) => entry.id === right?.senator.state.toLowerCase(),
  );

  return (
    <PageLayout
      title="Senator Compare"
      subtitle="Normalized comparison for policy movement and state-outcome context."
    >
      <CompareStrip
        items={[
          {
            label: "Principal committees",
            left: `${left?.senator.name ?? "N/A"}: ${left?.senator.principalCommittees.length ?? 0}`,
            right: `${right?.senator.name ?? "N/A"}: ${right?.senator.principalCommittees.length ?? 0}`,
            diff:
              left && right
                ? `${left.senator.principalCommittees.length - right.senator.principalCommittees.length}`
                : "N/A",
          },
          {
            label: "Sampled contribution total",
            left: `$${Math.round(left?.sampledContributionTotal ?? 0).toLocaleString()}`,
            right: `$${Math.round(right?.sampledContributionTotal ?? 0).toLocaleString()}`,
            diff:
              left && right
                ? `$${Math.round(left.sampledContributionTotal - right.sampledContributionTotal).toLocaleString()}`
                : "N/A",
          },
          {
            label: "State child poverty",
            left: leftState?.childPoverty ?? "N/A",
            right: rightState?.childPoverty ?? "N/A",
            diff:
              leftState?.childPovertyValue !== undefined &&
              rightState?.childPovertyValue !== undefined
                ? `${(leftState.childPovertyValue - rightState.childPovertyValue).toFixed(1)} pts`
                : "N/A",
          },
        ]}
      />
    </PageLayout>
  );
}

async function CompareStates() {
  const latestOutcomeRows = await getLatestStateOutcomesRepository();
  const stateRows = getStateDashboardRowsFromOutcomes(latestOutcomeRows);

  const orderedByPopulation = [...stateRows].sort(
    (left, right) => (right.populationValue ?? 0) - (left.populationValue ?? 0),
  );
  const left = orderedByPopulation[0];
  const right = orderedByPopulation[1];

  return (
    <PageLayout
      title="State Compare"
      subtitle="Side-by-side population outcomes with trend overlays and caveat notes."
    >
      <CompareStrip
        items={[
          {
            label: "Population",
            left: `${left?.name ?? "N/A"}: ${left?.pop ?? "N/A"}`,
            right: `${right?.name ?? "N/A"}: ${right?.pop ?? "N/A"}`,
            diff:
              left?.populationValue !== undefined &&
              right?.populationValue !== undefined
                ? `${((left.populationValue - right.populationValue) / 1_000_000).toFixed(1)}M`
                : "N/A",
          },
          {
            label: "Child poverty",
            left: left?.childPoverty ?? "N/A",
            right: right?.childPoverty ?? "N/A",
            diff:
              left?.childPovertyValue !== undefined &&
              right?.childPovertyValue !== undefined
                ? `${(left.childPovertyValue - right.childPovertyValue).toFixed(1)} pts`
                : "N/A",
          },
          {
            label: "Suicide rate",
            left: left?.suicideRate ?? "N/A",
            right: right?.suicideRate ?? "N/A",
            diff:
              left?.suicideRateValue !== undefined &&
              right?.suicideRateValue !== undefined
                ? `${(left.suicideRateValue - right.suicideRateValue).toFixed(1)}/100k`
                : "N/A",
          },
        ]}
      />
      <StateValueMap
        title="State map: suicide rate"
        metricLabel="Age-adjusted deaths per 100k"
        items={stateRows.map((stateEntity) => ({
          code: stateEntity.code,
          value: stateEntity.suicideRateValue,
          href: `/explore/states/${stateEntity.id}`,
        }))}
      />
    </PageLayout>
  );
}

async function CompareCountries() {
  const countryEntities = await getLatestCountryInfluenceEntitiesRepository();
  const left = countryEntities[0];
  const right = countryEntities[1];

  return (
    <PageLayout
      title="Country Compare"
      subtitle="Registered influence channels compared with legal-context annotations."
    >
      <CompareStrip
        items={[
          {
            label: "Principal rows",
            left: `${left?.name ?? "N/A"}: ${left?.principalCount ?? 0}`,
            right: `${right?.name ?? "N/A"}: ${right?.principalCount ?? 0}`,
            diff:
              left && right
                ? `${left.principalCount - right.principalCount}`
                : "N/A",
          },
          {
            label: "Registrants",
            left: String(left?.registrantCount ?? 0),
            right: String(right?.registrantCount ?? 0),
            diff:
              left && right
                ? `${left.registrantCount - right.registrantCount}`
                : "N/A",
          },
          {
            label: "Top principals tracked",
            left: String(left?.topPrincipals.length ?? 0),
            right: String(right?.topPrincipals.length ?? 0),
            diff:
              left && right
                ? `${left.topPrincipals.length - right.topPrincipals.length}`
                : "N/A",
          },
        ]}
      />
    </PageLayout>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <CompareHub />;
  if (subsection === "senators") return <CompareSenators />;
  if (subsection === "states") return <CompareStates />;
  if (subsection === "countries") return <CompareCountries />;

  notFound();
}
