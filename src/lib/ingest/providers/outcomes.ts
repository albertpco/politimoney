import { fetchJson } from "@/lib/ingest/http";
import type { StateOutcome } from "@/lib/ingest/types";
import {
  STATE_FIPS_TO_CODE,
  STATE_NAME_TO_CODE,
  US_STATES,
} from "@/lib/state-metadata";

type CensusArrayResponse = string[][];

type CdcSuicideRow = {
  state?: string;
  aadr?: string;
};

type CdcMaxYearRow = {
  max_year?: string;
};

type CdcChildMortalityPeriodRow = {
  max_time_period_id?: string;
};

type CdcChildMortalityRow = {
  subgroup?: string;
  state_fips?: string;
  estimate?: string;
};

export type OutcomesIngestResult = {
  states: StateOutcome[];
  warnings: string[];
};

function parseNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const normalized = value.replaceAll(",", "").trim();
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildCensusUrl(path: string, params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `https://api.census.gov${path}?${query.toString()}`;
}

function buildCdcUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `https://data.cdc.gov/resource/bi63-dtpu.json?${query.toString()}`;
}

function buildCdcChildMortalityUrl(params: Record<string, string>) {
  const query = new URLSearchParams(params);
  return `https://data.cdc.gov/resource/pjb2-jvdr.json?${query.toString()}`;
}

export async function ingestStateOutcomes({
  year,
}: {
  year: number;
}): Promise<OutcomesIngestResult> {
  const warnings: string[] = [];

  const populationByCode = new Map<string, number>();
  const childPovertyByCode = new Map<string, number>();
  const fertilityByCode = new Map<string, number>();
  const suicideByCode = new Map<string, number>();
  const childMortalityByCode = new Map<string, number>();

  try {
    const populationRows = await fetchJson<CensusArrayResponse>(
      buildCensusUrl(`/data/${year}/acs/acs1`, {
        get: "NAME,B01003_001E",
        for: "state:*",
      }),
    );

    for (const row of populationRows.slice(1)) {
      const [, populationRaw, fips] = row;
      const stateCode = STATE_FIPS_TO_CODE.get(fips);
      if (!stateCode) continue;
      const population = parseNumber(populationRaw);
      if (population !== undefined) {
        populationByCode.set(stateCode, population);
      }
    }
  } catch (error) {
    warnings.push(
      `Census population pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  try {
    const subjectRows = await fetchJson<CensusArrayResponse>(
      buildCensusUrl(`/data/${year}/acs/acs1/subject`, {
        get: "NAME,S1701_C03_002E,S1301_C04_001E",
        for: "state:*",
      }),
    );

    for (const row of subjectRows.slice(1)) {
      const [, childPovertyRaw, fertilityRaw, fips] = row;
      const stateCode = STATE_FIPS_TO_CODE.get(fips);
      if (!stateCode) continue;

      const childPoverty = parseNumber(childPovertyRaw);
      if (childPoverty !== undefined) {
        childPovertyByCode.set(stateCode, childPoverty);
      }

      const fertilityRate = parseNumber(fertilityRaw);
      if (fertilityRate !== undefined) {
        fertilityByCode.set(stateCode, fertilityRate);
      }
    }
  } catch (error) {
    warnings.push(
      `Census child poverty/fertility pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  let latestSuicideYear: number | undefined;
  try {
    const maxYearRows = await fetchJson<CdcMaxYearRow[]>(
      buildCdcUrl({
        $select: "max(year) as max_year",
      }),
    );
    latestSuicideYear = parseNumber(maxYearRows[0]?.max_year);

    if (!latestSuicideYear) {
      warnings.push("CDC suicide dataset did not return a valid year.");
    } else {
      const suicideRows = await fetchJson<CdcSuicideRow[]>(
        buildCdcUrl({
          $select: "state,aadr",
          $where: `year='${latestSuicideYear}' AND cause_name='Suicide' AND state NOT IN('United States','District of Columbia')`,
          $limit: "80",
        }),
      );

      for (const row of suicideRows) {
        const stateName = row.state;
        if (!stateName) continue;
        const stateCode = STATE_NAME_TO_CODE.get(stateName);
        if (!stateCode) continue;
        const suicideRate = parseNumber(row.aadr);
        if (suicideRate !== undefined) {
          suicideByCode.set(stateCode, suicideRate);
        }
      }
    }
  } catch (error) {
    warnings.push(
      `CDC suicide pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  let childMortalityPeriodId: number | undefined;
  try {
    const maxPeriodRows = await fetchJson<CdcChildMortalityPeriodRow[]>(
      buildCdcChildMortalityUrl({
        $select: "max(time_period_id) as max_time_period_id",
        $where:
          "subtopic='Total' AND classification='Geographic Characteristic' AND estimate_type='Infant deaths per 1,000 live births' AND state_fips != '0'",
      }),
    );
    childMortalityPeriodId = parseNumber(maxPeriodRows[0]?.max_time_period_id);

    if (!childMortalityPeriodId) {
      warnings.push(
        "CDC child mortality dataset did not return a valid latest period ID.",
      );
    } else {
      const childRows = await fetchJson<CdcChildMortalityRow[]>(
        buildCdcChildMortalityUrl({
          $select: "subgroup,state_fips,estimate",
          $where: `subtopic='Total' AND classification='Geographic Characteristic' AND estimate_type='Infant deaths per 1,000 live births' AND state_fips != '0' AND time_period_id='${childMortalityPeriodId}'`,
          $limit: "120",
        }),
      );

      for (const row of childRows) {
        const fromFips = row.state_fips
          ? STATE_FIPS_TO_CODE.get(row.state_fips.padStart(2, "0"))
          : undefined;
        const fromName = row.subgroup
          ? STATE_NAME_TO_CODE.get(row.subgroup)
          : undefined;
        const stateCode = fromFips ?? fromName;
        if (!stateCode) continue;
        const rate = parseNumber(row.estimate);
        if (rate !== undefined) {
          childMortalityByCode.set(stateCode, rate);
        }
      }

      if (!childMortalityByCode.size) {
        warnings.push(
          "CDC child mortality dataset returned no state-level rates for latest period.",
        );
      }
    }
  } catch (error) {
    warnings.push(
      `CDC child mortality pull failed: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
    );
  }

  const states: StateOutcome[] = US_STATES.map((state) => ({
    stateCode: state.code,
    stateName: state.name,
    population: populationByCode.get(state.code),
    childPovertyPct: childPovertyByCode.get(state.code),
    fertilityRatePer1kWomen: fertilityByCode.get(state.code),
    suicideRatePer100k: suicideByCode.get(state.code),
    childMortalityPer1k: childMortalityByCode.get(state.code),
    sourceYears: {
      census: year,
      cdcSuicide: latestSuicideYear,
      cdcChildMortalityPeriodId: childMortalityPeriodId,
    },
  }));

  const statesWithAnyMetric = states.filter(
    (state) =>
      state.population !== undefined ||
      state.childPovertyPct !== undefined ||
      state.fertilityRatePer1kWomen !== undefined ||
      state.suicideRatePer100k !== undefined ||
      state.childMortalityPer1k !== undefined,
  ).length;

  if (statesWithAnyMetric < 50) {
    warnings.push(
      `Only ${statesWithAnyMetric} states have at least one outcome metric in this run.`,
    );
  }

  return { states, warnings };
}
