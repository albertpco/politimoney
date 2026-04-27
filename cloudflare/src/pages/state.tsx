import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { PageScaffold } from "../components/page-templates";
import { SectionCard, MetricCard, TableExplorer } from "../components/ui-primitives";
import {
  StateMetricTrendPanel,
  type StateMetricControl,
} from "../components/state-metric-trend-panel";
import { STATE_CODE_TO_NAME, STATE_NAME_TO_CODE } from "../lib/state-metadata";
import { STATE_REFERENCE_MAP } from "../lib/state-reference";
import {
  getStateDashboardRowsFromOutcomes,
  type OutcomeRow,
  type StateDashboardRow,
} from "../lib/state-outcomes";
import { fetchJson, type MemberRecord } from "../lib/feed";

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
  if (!normalized || normalized === "N/A" || normalized === "—") return undefined;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed)) return undefined;
  if (normalized.endsWith("T")) return parsed;
  if (normalized.endsWith("B")) return parsed / 1_000;
  if (normalized.endsWith("M")) return parsed / 1_000_000;
  return parsed / 1_000_000_000_000;
}

function percentileFromSorted(values: number[], p: number): number {
  if (!values.length) return 0;
  const i = (values.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return values[lo] ?? 0;
  const w = i - lo;
  return (values[lo] ?? 0) * (1 - w) + (values[hi] ?? 0) * w;
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
  const finite = allValues.filter((v): v is number => v !== undefined && Number.isFinite(v));
  const points: { label: string; value: number }[] = [];
  if (finite.length) {
    const sorted = [...finite].sort((a, b) => a - b);
    points.push(
      { label: "P25", value: Number(percentileFromSorted(sorted, 0.25).toFixed(1)) },
      { label: "Median", value: Number(percentileFromSorted(sorted, 0.5).toFixed(1)) },
      { label: "P75", value: Number(percentileFromSorted(sorted, 0.75).toFixed(1)) },
    );
  }
  if (currentValue !== undefined && Number.isFinite(currentValue)) {
    points.push({ label: `${stateCode} current`, value: Number(currentValue.toFixed(1)) });
  }
  return points;
}

function formatPeople(
  people: Array<{ name: string; party?: string; href: string }>,
  emptyLabel: string,
) {
  if (!people.length) return emptyLabel;
  const rendered = people.slice(0, 4).map((p) => ({
    label: `${p.name}${p.party ? ` (${p.party})` : ""}`,
    href: p.href,
  }));
  return people.length > 4 ? [...rendered, `+${people.length - 4} more`] : rendered;
}

export function StateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const stateCode = id ? normalizeStateId(id) : null;
  const [outcomes, setOutcomes] = useState<OutcomeRow[]>([]);
  const [members, setMembers] = useState<MemberRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [out, mems] = await Promise.all([
        fetchJson<OutcomeRow[]>("state-outcomes.json").catch(() => [] as OutcomeRow[]),
        fetchJson<MemberRecord[]>("members.json").catch(() => [] as MemberRecord[]),
      ]);
      if (cancelled) return;
      setOutcomes(out);
      setMembers(mems);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stateCode) {
    return (
      <main>
        <SectionCard title="State not found" subtitle={`No state matches "${id}".`}>
          <Link className="pt-link" href="/states">Back to states</Link>
        </SectionCard>
      </main>
    );
  }
  if (loading) return <p className="pt-muted">Loading state record…</p>;

  const stateRows = getStateDashboardRowsFromOutcomes(outcomes);
  const stateEntity: StateDashboardRow | undefined = stateRows.find(
    (r) => r.code.toUpperCase() === stateCode,
  );
  if (!stateEntity) {
    return (
      <main>
        <SectionCard title="State not available" subtitle="Outcome data is not available for this state yet.">
          <Link className="pt-link" href="/states">Back to states</Link>
        </SectionCard>
      </main>
    );
  }

  const stateMembers = members.filter((m) => (m.state ?? "").toUpperCase() === stateCode);
  const stateRef = STATE_REFERENCE_MAP.get(stateCode);

  const senators = formatPeople(
    stateMembers
      .filter((m) => m.chamber === "S")
      .map((m) => ({
        name: m.name,
        party: m.partyCode ?? m.party,
        href: `/members/${m.bioguideId.toLowerCase()}`,
      })),
    "No senators identified",
  );
  const representatives = formatPeople(
    stateMembers
      .filter((m) => m.chamber === "H")
      .map((m) => ({
        name: m.name,
        party: m.partyCode ?? m.party,
        href: `/members/${m.bioguideId.toLowerCase()}`,
      })),
    "No representatives identified",
  );

  const metricControls: StateMetricControl[] = [
    {
      key: "gdp", label: "GDP", value: stateEntity.gdp,
      delta: stateEntity.gdpGrowth && stateEntity.gdpGrowth !== "—" ? `${stateEntity.gdpGrowth} y/y real` : "BEA",
      period: "2023",
      quality: stateEntity.gdp === "—" ? "partial" : "high",
      chartTitle: `${stateEntity.name} GDP benchmark trend`,
      chartUnit: "trillions USD",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => parseGdpToTrillions(e.gdp)),
        currentValue: parseGdpToTrillions(stateEntity.gdp),
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "gdpPerCapita", label: "GDP per capita", value: stateEntity.gdpPerCapita,
      delta: "BEA / ACS", period: "2023",
      quality: stateEntity.gdpPerCapita === "—" ? "partial" : "high",
      chartTitle: `${stateEntity.name} GDP per capita`, chartUnit: "USD per resident",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.gdpPerCapitaValue),
        currentValue: stateEntity.gdpPerCapitaValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "population", label: "Population", value: stateEntity.pop, delta: "ACS", period: "latest", quality: "medium",
      chartTitle: `${stateEntity.name} population`, chartUnit: "millions of residents",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.populationValue !== undefined ? e.populationValue / 1_000_000 : undefined),
        currentValue: stateEntity.populationValue !== undefined ? stateEntity.populationValue / 1_000_000 : undefined,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "medianIncome", label: "Median household income", value: stateEntity.medianIncome,
      delta: "ACS S1903", period: "2023",
      quality: stateEntity.medianIncome === "—" ? "partial" : "high",
      chartTitle: `${stateEntity.name} median household income`, chartUnit: "USD",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.medianIncomeValue),
        currentValue: stateEntity.medianIncomeValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "bachelorsPlus", label: "Bachelor's+", value: stateEntity.bachelorsPlus,
      delta: "ACS S1501, age 25+", period: "2023",
      quality: stateEntity.bachelorsPlus === "—" ? "partial" : "high",
      chartTitle: `${stateEntity.name} bachelor's+`, chartUnit: "percent of pop. age 25+",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.bachelorsPlusValue),
        currentValue: stateEntity.bachelorsPlusValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "unemployment", label: "Unemployment", value: stateEntity.unemployment,
      delta: "BLS LAUS", period: "2024",
      quality: stateEntity.unemployment === "—" ? "partial" : "high",
      chartTitle: `${stateEntity.name} unemployment rate`, chartUnit: "percent",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.unemploymentValue),
        currentValue: stateEntity.unemploymentValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "taxBurden", label: "Tax burden", value: stateEntity.taxBurden,
      delta: "Tax Foundation", period: "2022",
      quality: stateEntity.taxBurden === "—" ? "partial" : "medium",
      chartTitle: `${stateEntity.name} state+local tax burden`, chartUnit: "percent of state net product",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.taxBurdenValue),
        currentValue: stateEntity.taxBurdenValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "federalBalance", label: "Federal balance / capita", value: stateEntity.federalBalance,
      delta: "Rockefeller Institute", period: "2022",
      quality: stateEntity.federalBalance === "—" ? "partial" : "medium",
      chartTitle: `${stateEntity.name} federal balance`, chartUnit: "USD per resident",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.federalBalanceValue),
        currentValue: stateEntity.federalBalanceValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "childPoverty", label: "Child poverty", value: stateEntity.childPoverty,
      delta: "ACS", period: "latest", quality: "medium",
      chartTitle: `${stateEntity.name} child poverty`, chartUnit: "percent",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.childPovertyValue),
        currentValue: stateEntity.childPovertyValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "fertility", label: "Birth/fertility", value: stateEntity.fertility,
      delta: "ACS rate per 1k women", period: "latest", quality: "medium",
      chartTitle: `${stateEntity.name} fertility`, chartUnit: "births per 1k women",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.fertilityValue),
        currentValue: stateEntity.fertilityValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "childMortality", label: "Child mortality", value: stateEntity.childMortality,
      delta: "CDC infant mortality baseline", period: "latest", quality: "medium",
      chartTitle: `${stateEntity.name} child mortality`, chartUnit: "deaths per 1k live births",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.childMortalityValue),
        currentValue: stateEntity.childMortalityValue,
        stateCode: stateEntity.code,
      }),
    },
    {
      key: "suicideRate", label: "Suicide rate", value: stateEntity.suicideRate,
      delta: "CDC age-adjusted rate", period: "latest", quality: "medium",
      chartTitle: `${stateEntity.name} suicide rate`, chartUnit: "deaths per 100k",
      chartPoints: buildBenchmarkPoints({
        allValues: stateRows.map((e) => e.suicideRateValue),
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
            {stateRef ? <p>Governor: {stateRef.governor} ({stateRef.governorParty})</p> : null}
            <p>State code: {stateEntity.code}</p>
            <p>Population: {stateEntity.pop}</p>
            <p>Child poverty: {stateEntity.childPoverty}</p>
            <p>Fertility: {stateEntity.fertility}</p>
            <p>Child mortality: {stateEntity.childMortality}</p>
            <p>Suicide rate: {stateEntity.suicideRate}</p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link href="/states" className="text-sm font-semibold text-amber-800 underline">Back to states</Link>
              <Link href="/search" className="text-sm font-semibold text-amber-800 underline">Search</Link>
            </div>
          </div>
        </SectionCard>
      }
    >
      <SectionCard title="Headline metrics" subtitle="Current values versus the state snapshot.">
        <div className="grid gap-3 md:grid-cols-3">
          <MetricCard label="GDP" value={stateEntity.gdp} delta={stateEntity.gdpGrowth ? `${stateEntity.gdpGrowth} y/y real` : "BEA"} period="2023" quality={stateEntity.gdp === "—" ? "partial" : "high"} />
          <MetricCard label="GDP per capita" value={stateEntity.gdpPerCapita} delta="BEA / ACS" period="2023" quality={stateEntity.gdpPerCapita === "—" ? "partial" : "high"} />
          <MetricCard label="Population" value={stateEntity.pop} delta="ACS" period="latest" />
          <MetricCard label="Child poverty" value={stateEntity.childPoverty} delta="ACS" period="latest" />
          <MetricCard label="Birth/fertility" value={stateEntity.fertility} delta="ACS rate per 1k women" period="latest" />
          <MetricCard label="Child mortality" value={stateEntity.childMortality} delta="CDC" period="latest" />
          <MetricCard label="Suicide rate" value={stateEntity.suicideRate} delta="CDC age-adjusted" period="latest" />
          <MetricCard label="Median household income" value={stateEntity.medianIncome} delta="ACS S1903" period="2023" quality={stateEntity.medianIncome === "—" ? "partial" : "high"} />
          <MetricCard label="Median age" value={stateEntity.medianAge} delta="ACS S0101" period="2023" quality={stateEntity.medianAge === "—" ? "partial" : "high"} />
          <MetricCard label="Bachelor's+ (age 25+)" value={stateEntity.bachelorsPlus} delta="ACS S1501" period="2023" quality={stateEntity.bachelorsPlus === "—" ? "partial" : "high"} />
          <MetricCard label="Unemployment" value={stateEntity.unemployment} delta="BLS LAUS" period="2024" quality={stateEntity.unemployment === "—" ? "partial" : "high"} />
          <MetricCard label="State+local tax burden" value={stateEntity.taxBurden} delta="Tax Foundation" period="2022" quality={stateEntity.taxBurden === "—" ? "partial" : "medium"} />
          <MetricCard label="Federal balance / capita" value={stateEntity.federalBalance} delta="Rockefeller Institute" period="2022" quality={stateEntity.federalBalance === "—" ? "partial" : "medium"} />
        </div>
      </SectionCard>

      <SectionCard title="State leadership and federal delegation" subtitle="Governor, senators, and House members for this state.">
        <TableExplorer
          columns={["Role", "Listing"]}
          rows={[
            ...(stateRef ? [["Governor" as const, `${stateRef.governor} (${stateRef.governorParty})`]] : []),
            ["Senators", senators],
            ["Representatives", representatives],
            ["State lookup", { label: `Search ${stateEntity.name} policy context`, href: `/search?q=${encodeURIComponent(stateEntity.name)}` }],
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

export default StateDetailPage;
