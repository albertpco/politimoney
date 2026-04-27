import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import type { IngestArtifacts } from "@/lib/ingest/types";
import { states as sampleStates } from "@/lib/site-data";
import { STATE_CODE_TO_NAME } from "@/lib/state-metadata";

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

export type OutcomeRow = {
  stateCode: string;
  stateName: string;
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

function formatPopulation(value: number | undefined): string {
  if (value === undefined) return "N/A";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(Math.round(value));
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return "N/A";
  return `${value.toFixed(1)}%`;
}

function formatPer1k(value: number | undefined): string {
  if (value === undefined) return "N/A";
  return `${value.toFixed(1)}/1k`;
}

function formatPer100k(value: number | undefined): string {
  if (value === undefined) return "N/A";
  return `${value.toFixed(1)}/100k`;
}

function formatGdpTotal(millions: number | undefined): string {
  if (millions === undefined) return "N/A";
  if (millions >= 1_000_000) return `$${(millions / 1_000_000).toFixed(2)}T`;
  if (millions >= 1_000) return `$${(millions / 1_000).toFixed(1)}B`;
  return `$${millions.toFixed(0)}M`;
}

function formatGdpPerCapita(value: number | undefined): string {
  if (value === undefined) return "N/A";
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value)}`;
}

function formatGdpGrowth(value: number | undefined): string {
  if (value === undefined) return "N/A";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function formatUsdRound(value: number | undefined): string {
  if (value === undefined) return "N/A";
  if (Math.abs(value) >= 1_000)
    return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  return `$${Math.round(value)}`;
}

function formatYears(value: number | undefined): string {
  if (value === undefined) return "N/A";
  return `${value.toFixed(1)} yrs`;
}

function formatPercentSimple(value: number | undefined, digits = 1): string {
  if (value === undefined) return "N/A";
  return `${value.toFixed(digits)}%`;
}

function formatSignedUsd(value: number | undefined): string {
  if (value === undefined) return "N/A";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}k`;
  return `${sign}$${Math.round(abs)}`;
}

function parsePercentLabel(value: string): number | undefined {
  const normalized = value.replace("%", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseRateLabel(value: string): number | undefined {
  const normalized = value.replace("/1k", "").replace("/100k", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function fromSampleRows(): StateDashboardRow[] {
  return sampleStates.map((state) => ({
    id: state.id,
    code: state.id.toUpperCase(),
    name: state.name,
    gdp: state.gdp,
    gdpPerCapita: "N/A",
    gdpGrowth: "N/A",
    medianIncome: "N/A",
    medianAge: "N/A",
    bachelorsPlus: "N/A",
    unemployment: "N/A",
    taxBurden: "N/A",
    federalBalance: "N/A",
    pop: state.pop,
    childPoverty: state.childPoverty,
    fertility: state.fertility,
    childMortality: state.childMortality,
    suicideRate: state.suicideRate,
    childPovertyValue: parsePercentLabel(state.childPoverty),
    fertilityValue: parseRateLabel(state.fertility),
    childMortalityValue: parseRateLabel(state.childMortality),
    suicideRateValue: parseRateLabel(state.suicideRate),
  }));
}

export function getStateDashboardRows(
  artifacts: IngestArtifacts | null,
): StateDashboardRow[] {
  const outcomeRows = artifacts?.outcomes.states ?? [];
  return getStateDashboardRowsFromOutcomes(outcomeRows);
}

/**
 * Hot-patch: re-read the outcomes JSON directly from disk to pick up
 * fields (e.g. GDP) that were backfilled outside the ingest pipeline.
 * Falls back to whatever the caller passed in if the disk read fails.
 */
function reloadOutcomesFromDisk(fallback: OutcomeRow[]): OutcomeRow[] {
  try {
    const filePath = path.join(
      process.cwd(),
      "data",
      "ingest",
      "latest",
      "outcomes.states.json",
    );
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as
      | OutcomeRow[]
      | { states?: OutcomeRow[]; outcomes?: OutcomeRow[] };
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed.states ?? parsed.outcomes ?? [];
    if (!arr.length) return fallback;
    // merge with fallback (keep extra fields the caller may have set)
    const byCode = new Map(arr.map((row) => [row.stateCode.toUpperCase(), row]));
    return fallback.map((row) => byCode.get(row.stateCode.toUpperCase()) ?? row);
  } catch {
    return fallback;
  }
}

export function getStateDashboardRowsFromOutcomes(
  outcomeRows: OutcomeRow[],
): StateDashboardRow[] {
  if (!outcomeRows.length) return fromSampleRows();
  const enriched = reloadOutcomesFromDisk(outcomeRows);
  return enriched
    .map((state) => ({
      id: state.stateCode.toLowerCase(),
      code: state.stateCode,
      name: state.stateName || STATE_CODE_TO_NAME.get(state.stateCode) || state.stateCode,
      gdp: formatGdpTotal(state.gdpUsdMillions ?? undefined),
      gdpPerCapita: formatGdpPerCapita(state.gdpPerCapitaUsd ?? undefined),
      gdpGrowth: formatGdpGrowth(state.gdpGrowthPct ?? undefined),
      pop: formatPopulation(state.population ?? undefined),
      childPoverty: formatPercent(state.childPovertyPct ?? undefined),
      fertility: formatPer1k(state.fertilityRatePer1kWomen ?? undefined),
      childMortality: formatPer1k(state.childMortalityPer1k ?? undefined),
      suicideRate: formatPer100k(state.suicideRatePer100k ?? undefined),
      medianIncome: formatUsdRound(state.medianHouseholdIncomeUsd ?? undefined),
      medianAge: formatYears(state.medianAgeYears ?? undefined),
      bachelorsPlus: formatPercentSimple(state.bachelorsOrHigherPct ?? undefined),
      unemployment: formatPercentSimple(state.unemploymentRatePct ?? undefined),
      taxBurden: formatPercentSimple(state.stateLocalTaxBurdenPct ?? undefined),
      federalBalance: formatSignedUsd(state.federalBalancePerCapitaUsd ?? undefined),
      populationValue: state.population ?? undefined,
      gdpUsdMillionsValue: state.gdpUsdMillions ?? undefined,
      gdpPerCapitaValue: state.gdpPerCapitaUsd ?? undefined,
      gdpGrowthPctValue: state.gdpGrowthPct ?? undefined,
      childPovertyValue: state.childPovertyPct ?? undefined,
      fertilityValue: state.fertilityRatePer1kWomen ?? undefined,
      childMortalityValue: state.childMortalityPer1k ?? undefined,
      suicideRateValue: state.suicideRatePer100k ?? undefined,
      medianIncomeValue: state.medianHouseholdIncomeUsd ?? undefined,
      medianAgeValue: state.medianAgeYears ?? undefined,
      bachelorsPlusValue: state.bachelorsOrHigherPct ?? undefined,
      unemploymentValue: state.unemploymentRatePct ?? undefined,
      taxBurdenValue: state.stateLocalTaxBurdenPct ?? undefined,
      federalBalanceValue: state.federalBalancePerCapitaUsd ?? undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
