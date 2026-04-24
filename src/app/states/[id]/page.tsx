import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageScaffold } from "@/components/page-templates";
import { SectionCard, MetricCard, TableExplorer } from "@/components/ui-primitives";
import {
  StateMetricTrendPanel,
  type StateMetricControl,
} from "@/components/state-metric-trend-panel";
import {
  getLatestMembersRepository,
  getLatestSenatorsRepository,
} from "@/lib/data/member-repository";
import { getLatestStatesRepository } from "@/lib/data/state-repository";
import { STATE_CODE_TO_NAME, STATE_NAME_TO_CODE } from "@/lib/state-metadata";
import { STATE_REFERENCE_MAP } from "@/lib/state-reference";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";

export const revalidate = 3600;

export async function generateMetadata({ params }: StateDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const stateCode = normalizeStateId(id);
  if (!stateCode) return { title: "State not found | Politired" };
  const stateName = STATE_CODE_TO_NAME.get(stateCode) ?? stateCode;
  return {
    title: `${stateName} | Politired`,
    description: `${stateName} outcome dashboard: GDP, population, child poverty, fertility, child mortality, and suicide rate with federal delegation context.`,
  };
}

type StateDetailPageProps = {
  params: Promise<{ id: string }>;
};

function normalizeStateId(rawId: string): string | null {
  const trimmed = rawId.trim();
  if (!trimmed) return null;

  const upper = trimmed.toUpperCase();
  if (STATE_CODE_TO_NAME.has(upper)) return upper;

  const title = trimmed
    .replace(/-/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word[0]?.toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");

  return STATE_NAME_TO_CODE.get(title) ?? null;
}

function parseGdpToTrillions(value: string): number | undefined {
  const normalized = value.replace("$", "").replaceAll(",", "").trim().toUpperCase();
  if (!normalized || normalized === "N/A") return undefined;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  if (normalized.endsWith("T")) return parsed;
  if (normalized.endsWith("B")) return parsed / 1_000;
  if (normalized.endsWith("M")) return parsed / 1_000_000;
  return parsed / 1_000_000_000_000;
}

function percentileFromSorted(values: number[], percentile: number): number {
  if (!values.length) return 0;
  const index = (values.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return values[lower] ?? 0;
  const weight = index - lower;
  return (values[lower] ?? 0) * (1 - weight) + (values[upper] ?? 0) * weight;
}

function buildBenchmarkPoints({
  allValues,
  currentValue,
  stateCode,
}: {
  allValues: Array<number | undefined>;
  currentValue: number | undefined;
  stateCode: string;
}): { label: string; value: number }[] {
  const finiteValues = allValues.filter(
    (value): value is number => value !== undefined && Number.isFinite(value),
  );
  const points: { label: string; value: number }[] = [];

  if (finiteValues.length) {
    const sorted = [...finiteValues].sort((left, right) => left - right);
    points.push(
      { label: "P25", value: Number(percentileFromSorted(sorted, 0.25).toFixed(1)) },
      { label: "Median", value: Number(percentileFromSorted(sorted, 0.5).toFixed(1)) },
      { label: "P75", value: Number(percentileFromSorted(sorted, 0.75).toFixed(1)) },
    );
  }

  if (currentValue !== undefined && Number.isFinite(currentValue)) {
    points.push({
      label: `${stateCode} current`,
      value: Number(currentValue.toFixed(1)),
    });
  }

  return points;
}

function formatPeople(
  people: Array<{ name: string; party?: string; href: string }>,
  emptyLabel: string,
) {
  if (!people.length) return emptyLabel;
  const rendered = people.slice(0, 4).map((person) => ({
    label: `${person.name}${person.party ? ` (${person.party})` : ""}`,
    href: person.href,
  }));
  return people.length > 4 ? [...rendered, `+${people.length - 4} more`] : rendered;
}

export default async function StateDetailPage({ params }: StateDetailPageProps) {
  const { id } = await params;
  const stateCode = normalizeStateId(id);
  if (!stateCode) notFound();

  const [outcomes, congressMembers, senatorEntities] = await Promise.all([
    getLatestStatesRepository(),
    getLatestMembersRepository(),
    getLatestSenatorsRepository(),
  ]);

  const stateRows = getStateDashboardRowsFromOutcomes(outcomes);
  const stateEntity = stateRows.find(
    (row) => row.id.toLowerCase() === stateCode.toLowerCase() || row.code.toUpperCase() === stateCode,
  );
  if (!stateEntity) notFound();

  const currentMembers = congressMembers.filter(
    (member) => member.state.toUpperCase() === stateCode,
  );
  const currentSenators = currentMembers.filter((member) => member.chamber === "S");
  const currentRepresentatives = currentMembers.filter((member) => member.chamber === "H");
  const fallbackSenators = senatorEntities.filter(
    (senator) => senator.state.toUpperCase() === stateCode,
  );

  const stateRef = STATE_REFERENCE_MAP.get(stateCode);

  const senators = formatPeople(
    currentSenators.length
      ? currentSenators.map((member) => ({
          name: member.name,
          party: member.partyCode ?? member.party,
          href: `/members/${member.bioguideId.toLowerCase()}`,
        }))
      : fallbackSenators.map((senator) => ({
          name: senator.name,
          party: senator.party,
          href: `/members/${senator.id}`,
        })),
    currentMembers.length ? "No senators identified" : "No Senate candidates identified",
  );

  const representatives = formatPeople(
    currentRepresentatives.map((member) => ({
      name: member.name,
      party: member.partyCode ?? member.party,
      href: `/members/${member.bioguideId.toLowerCase()}`,
    })),
    currentMembers.length ? "No representatives identified" : "No House members identified",
  );

  const metricControls: StateMetricControl[] = [
    {
      key: "gdp",
      label: "GDP",
      value: stateEntity.gdp,
      delta: "state economic feed pending",
      period: "latest",
      quality: stateEntity.gdp === "N/A" ? "partial" : "medium",
      chartTitle: `${stateEntity.name} GDP benchmark trend`,
      chartUnit: "trillions USD",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) => parseGdpToTrillions(entry.gdp)),
        currentValue: parseGdpToTrillions(stateEntity.gdp),
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "population",
      label: "Population",
      value: stateEntity.pop,
      delta: "ACS",
      period: "latest",
      quality: "medium",
      chartTitle: `${stateEntity.name} population benchmark trend`,
      chartUnit: "millions of residents",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) =>
          entry.populationValue !== undefined ? entry.populationValue / 1_000_000 : undefined,
        ),
        currentValue:
          stateEntity.populationValue !== undefined ? stateEntity.populationValue / 1_000_000 : undefined,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "childPoverty",
      label: "Child poverty",
      value: stateEntity.childPoverty,
      delta: "ACS",
      period: "latest",
      quality: "medium",
      chartTitle: `${stateEntity.name} child poverty benchmark trend`,
      chartUnit: "percent",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) => entry.childPovertyValue),
        currentValue: stateEntity.childPovertyValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "fertility",
      label: "Birth/fertility",
      value: stateEntity.fertility,
      delta: "ACS rate per 1k women",
      period: "latest",
      quality: "medium",
      chartTitle: `${stateEntity.name} fertility benchmark trend`,
      chartUnit: "births per 1k women",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) => entry.fertilityValue),
        currentValue: stateEntity.fertilityValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "childMortality",
      label: "Child mortality",
      value: stateEntity.childMortality,
      delta: "CDC infant mortality baseline",
      period: "latest available period",
      quality: "medium",
      chartTitle: `${stateEntity.name} child mortality benchmark trend`,
      chartUnit: "deaths per 1k live births",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) => entry.childMortalityValue),
        currentValue: stateEntity.childMortalityValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "suicideRate",
      label: "Suicide rate",
      value: stateEntity.suicideRate,
      delta: "CDC age-adjusted rate",
      period: "latest",
      quality: "medium",
      chartTitle: `${stateEntity.name} suicide-rate benchmark trend`,
      chartUnit: "deaths per 100k",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((entry) => entry.suicideRateValue),
        currentValue: stateEntity.suicideRateValue,
        stateCode: stateEntity.code,
      }),
    },
  ];

  return (
    <PageScaffold
      eyebrow="States"
      title={stateEntity.name}
      subtitle="Outcome trends with federal delegation context and explicit limitations."
      sidebar={
        <SectionCard title="State at a glance" subtitle="Quick links and interpretation context.">
          <div className="space-y-3 text-sm text-stone-700">
            {stateRef ? (
              <p>Governor: {stateRef.governor} ({stateRef.governorParty})</p>
            ) : null}
            <p>State code: {stateEntity.code}</p>
            <p>Population: {stateEntity.pop}</p>
            <p>Child poverty: {stateEntity.childPoverty}</p>
            <p>Fertility: {stateEntity.fertility}</p>
            <p>Child mortality: {stateEntity.childMortality}</p>
            <p>Suicide rate: {stateEntity.suicideRate}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/states" className="text-sm font-semibold text-amber-800 underline">
                Back to states
              </Link>
              <Link href="/search" className="text-sm font-semibold text-amber-800 underline">
                Search
              </Link>
            </div>
          </div>
        </SectionCard>
      }
    >
      <SectionCard title="Headline metrics" subtitle="Current values versus the state snapshot.">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard
            label="GDP"
            value={stateEntity.gdp}
            delta=""
            period="latest"
            quality={stateEntity.gdp === "N/A" ? "partial" : "medium"}
          />
          <MetricCard label="Population" value={stateEntity.pop} delta="ACS" period="latest" />
          <MetricCard
            label="Child poverty"
            value={stateEntity.childPoverty}
            delta="ACS"
            period="latest"
          />
          <MetricCard
            label="Birth/fertility"
            value={stateEntity.fertility}
            delta="ACS rate per 1k women"
            period="latest"
          />
          <MetricCard
            label="Child mortality"
            value={stateEntity.childMortality}
            delta="CDC infant mortality baseline"
            period="latest available period"
          />
          <MetricCard
            label="Suicide rate"
            value={stateEntity.suicideRate}
            delta="CDC age-adjusted rate"
            period="latest"
          />
        </div>
      </SectionCard>

      <SectionCard title="State leadership and federal delegation" subtitle="Governor, senators, and House members for this state.">
        <TableExplorer
          columns={["Role", "Listing"]}
          rows={[
            ...(stateRef ? [["Governor" as const, `${stateRef.governor} (${stateRef.governorParty})`]] : []),
            ["Senators", senators],
            ["Representatives", representatives],
            [
              "State lookup",
              {
                label: `Search ${stateEntity.name} policy context`,
                href: `/search?q=${encodeURIComponent(stateEntity.name)}`,
              },
            ],
          ]}
        />
      </SectionCard>

      <SectionCard title="Outcome trends" subtitle="Compare the state against the current snapshot.">
        <StateMetricTrendPanel metrics={metricControls} />
      </SectionCard>

      <SectionCard title="Policy timeline" subtitle="Policy timeline data is not yet available for this state.">
        <p className="text-sm text-stone-500">
          When policy event data is ingested, this section will show legislative and budget actions relevant to this state.
        </p>
      </SectionCard>
    </PageScaffold>
  );
}
