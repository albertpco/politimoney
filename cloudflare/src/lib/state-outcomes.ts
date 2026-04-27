/**
 * State outcomes formatting — light port of src/lib/state-outcomes.ts that
 * works from JSON without disk reads. Maps a list of outcome rows to a
 * dashboard-ready row used by the home-page state cartogram and the state
 * detail page.
 */

export type OutcomeRow = {
  stateCode: string;
  stateName?: string;
  population?: number | null;
  childPovertyPct?: number | null;
  fertilityRatePer1kWomen?: number | null;
  suicideRatePer100k?: number | null;
  childMortalityPer1k?: number | null;
  gdpUsdMillions?: number | null;
  gdpPerCapitaUsd?: number | null;
  gdpGrowthPct?: number | null;
  medianHouseholdIncomeUsd?: number | null;
  medianAgeYears?: number | null;
  bachelorsOrHigherPct?: number | null;
  unemploymentRatePct?: number | null;
  stateLocalTaxBurdenPct?: number | null;
  federalBalancePerCapitaUsd?: number | null;
};

export type StateDashboardRow = {
  id: string;
  code: string;
  name: string;
  gdp: string;
  gdpPerCapita: string;
  gdpGrowth: string;
  pop: string;
  childPoverty: string;
  fertility: string;
  childMortality: string;
  suicideRate: string;
  medianIncome: string;
  medianAge: string;
  bachelorsPlus: string;
  unemployment: string;
  taxBurden: string;
  federalBalance: string;
  populationValue?: number;
  gdpUsdMillionsValue?: number;
  gdpPerCapitaValue?: number;
  gdpGrowthPctValue?: number;
  childPovertyValue?: number;
  fertilityValue?: number;
  childMortalityValue?: number;
  suicideRateValue?: number;
  medianIncomeValue?: number;
  medianAgeValue?: number;
  bachelorsPlusValue?: number;
  unemploymentValue?: number;
  taxBurdenValue?: number;
  federalBalanceValue?: number;
};

const fmtUsd = (n?: number | null, max = 0) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: max,
      }).format(n as number)
    : "—";

const fmtSignedUsd = (n?: number | null) => {
  if (!Number.isFinite(n)) return "—";
  const v = n as number;
  const sign = v >= 0 ? "+" : "−";
  return `${sign}${fmtUsd(Math.abs(v))}`;
};

const fmtPct = (n?: number | null, frac = 1) =>
  Number.isFinite(n) ? `${(n as number).toFixed(frac)}%` : "—";

const fmtCompact = (n?: number | null) =>
  Number.isFinite(n)
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n as number)
    : "—";

export function getStateDashboardRowsFromOutcomes(outcomeRows: OutcomeRow[]): StateDashboardRow[] {
  if (!outcomeRows?.length) return [];
  return outcomeRows
    .map((s) => ({
      id: s.stateCode.toLowerCase(),
      code: s.stateCode,
      name: s.stateName ?? s.stateCode,
      gdp: s.gdpUsdMillions != null ? fmtUsd(s.gdpUsdMillions * 1_000_000) : "—",
      gdpPerCapita: fmtUsd(s.gdpPerCapitaUsd ?? null),
      gdpGrowth: fmtPct(s.gdpGrowthPct ?? null, 1),
      pop: fmtCompact(s.population ?? null),
      childPoverty: fmtPct(s.childPovertyPct ?? null, 1),
      fertility: Number.isFinite(s.fertilityRatePer1kWomen) ? `${(s.fertilityRatePer1kWomen as number).toFixed(0)} / 1k` : "—",
      childMortality: Number.isFinite(s.childMortalityPer1k) ? `${(s.childMortalityPer1k as number).toFixed(1)} / 1k` : "—",
      suicideRate: Number.isFinite(s.suicideRatePer100k) ? `${(s.suicideRatePer100k as number).toFixed(1)} / 100k` : "—",
      medianIncome: fmtUsd(s.medianHouseholdIncomeUsd ?? null),
      medianAge: Number.isFinite(s.medianAgeYears) ? `${(s.medianAgeYears as number).toFixed(1)} yrs` : "—",
      bachelorsPlus: fmtPct(s.bachelorsOrHigherPct ?? null, 0),
      unemployment: fmtPct(s.unemploymentRatePct ?? null, 1),
      taxBurden: fmtPct(s.stateLocalTaxBurdenPct ?? null, 1),
      federalBalance: fmtSignedUsd(s.federalBalancePerCapitaUsd ?? null),
      populationValue: s.population ?? undefined,
      gdpUsdMillionsValue: s.gdpUsdMillions ?? undefined,
      gdpPerCapitaValue: s.gdpPerCapitaUsd ?? undefined,
      gdpGrowthPctValue: s.gdpGrowthPct ?? undefined,
      childPovertyValue: s.childPovertyPct ?? undefined,
      fertilityValue: s.fertilityRatePer1kWomen ?? undefined,
      childMortalityValue: s.childMortalityPer1k ?? undefined,
      suicideRateValue: s.suicideRatePer100k ?? undefined,
      medianIncomeValue: s.medianHouseholdIncomeUsd ?? undefined,
      medianAgeValue: s.medianAgeYears ?? undefined,
      bachelorsPlusValue: s.bachelorsOrHigherPct ?? undefined,
      unemploymentValue: s.unemploymentRatePct ?? undefined,
      taxBurdenValue: s.stateLocalTaxBurdenPct ?? undefined,
      federalBalanceValue: s.federalBalancePerCapitaUsd ?? undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
