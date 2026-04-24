import type { IngestArtifacts } from "@/lib/ingest/types";
import { states as sampleStates } from "@/lib/site-data";
import { STATE_CODE_TO_NAME } from "@/lib/state-metadata";

export type StateDashboardRow = {
  id: string;
  code: string;
  name: string;
  gdp: string;
  pop: string;
  childPoverty: string;
  fertility: string;
  childMortality: string;
  suicideRate: string;
  populationValue?: number;
  childPovertyValue?: number;
  fertilityValue?: number;
  childMortalityValue?: number;
  suicideRateValue?: number;
};

export type OutcomeRow = {
  stateCode: string;
  stateName: string;
  population?: number | null;
  childPovertyPct?: number | null;
  fertilityRatePer1kWomen?: number | null;
  suicideRatePer100k?: number | null;
  childMortalityPer1k?: number | null;
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

export function getStateDashboardRowsFromOutcomes(
  outcomeRows: OutcomeRow[],
): StateDashboardRow[] {
  if (!outcomeRows.length) return fromSampleRows();
  return outcomeRows
    .map((state) => ({
      id: state.stateCode.toLowerCase(),
      code: state.stateCode,
      name: state.stateName || STATE_CODE_TO_NAME.get(state.stateCode) || state.stateCode,
      gdp: "N/A",
      pop: formatPopulation(state.population ?? undefined),
      childPoverty: formatPercent(state.childPovertyPct ?? undefined),
      fertility: formatPer1k(state.fertilityRatePer1kWomen ?? undefined),
      childMortality: formatPer1k(state.childMortalityPer1k ?? undefined),
      suicideRate: formatPer100k(state.suicideRatePer100k ?? undefined),
      populationValue: state.population ?? undefined,
      childPovertyValue: state.childPovertyPct ?? undefined,
      fertilityValue: state.fertilityRatePer1kWomen ?? undefined,
      childMortalityValue: state.childMortalityPer1k ?? undefined,
      suicideRateValue: state.suicideRatePer100k ?? undefined,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}
