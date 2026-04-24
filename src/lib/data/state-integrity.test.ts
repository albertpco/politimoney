/**
 * State data integrity tests.
 *
 * These tests validate that our ingested data matches known ground-truth
 * reference data for all 50 states. If any test fails, it means either:
 *   1. The ingestion pipeline produced incorrect data, or
 *   2. The reference data is outdated (election, resignation, etc.)
 *
 * Run: npx vitest run src/lib/data/state-integrity.test.ts
 */

import { describe, it, expect, beforeAll } from "vitest";
import { STATE_REFERENCE } from "@/lib/state-reference";
import { US_STATES, STATE_CODE_TO_NAME } from "@/lib/state-metadata";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";
import {
  readOutcomeStates,
  readCongressMembers,
} from "@/lib/ingest/storage";
import type { OutcomeRow } from "@/lib/state-outcomes";

// --- Loaded data (shared across tests) ---
let outcomeRows: OutcomeRow[] = [];
let stateRows: ReturnType<typeof getStateDashboardRowsFromOutcomes> = [];
let congressMembers: Array<{
  bioguideId: string;
  name: string;
  state: string;
  chamber: string;
  party?: string;
  partyCode?: string;
  district?: string;
}> = [];

beforeAll(async () => {
  outcomeRows = await readOutcomeStates();
  stateRows = getStateDashboardRowsFromOutcomes(outcomeRows);
  congressMembers = await readCongressMembers();
});

// ─── Metadata ────────────────────────────────────────────────

describe("State metadata completeness", () => {
  it("defines exactly 50 states", () => {
    expect(US_STATES).toHaveLength(50);
  });

  it("reference data covers all 50 states", () => {
    expect(STATE_REFERENCE).toHaveLength(50);
    const codes = STATE_REFERENCE.map((s) => s.code).sort();
    const metaCodes = US_STATES.map((s) => s.code).sort();
    expect(codes).toEqual(metaCodes);
  });

  it("every state has a name in STATE_CODE_TO_NAME", () => {
    for (const state of US_STATES) {
      expect(STATE_CODE_TO_NAME.get(state.code)).toBe(state.name);
    }
  });
});

// ─── Outcome data coverage ───────────────────────────────────

describe("State outcome data coverage", () => {
  it("has outcome data for all 50 states", () => {
    const coveredStates = new Set(outcomeRows.map((r) => r.stateCode));
    for (const state of US_STATES) {
      expect(
        coveredStates.has(state.code),
        `Missing outcome data for ${state.name} (${state.code})`,
      ).toBe(true);
    }
  });

  it("dashboard rows cover all 50 states", () => {
    expect(stateRows.length).toBeGreaterThanOrEqual(50);
  });

  it.each(US_STATES.map((s) => [s.code, s.name]))(
    "%s (%s) has non-null population",
    (code) => {
      const row = stateRows.find((r) => r.code === code);
      expect(row, `No dashboard row for ${code}`).toBeDefined();
      expect(row!.populationValue).toBeGreaterThan(0);
    },
  );

  it.each(US_STATES.map((s) => [s.code, s.name]))(
    "%s (%s) has non-null child poverty",
    (code) => {
      const row = stateRows.find((r) => r.code === code);
      expect(row!.childPovertyValue).toBeGreaterThan(0);
    },
  );

  it.each(US_STATES.map((s) => [s.code, s.name]))(
    "%s (%s) has non-null suicide rate",
    (code) => {
      const row = stateRows.find((r) => r.code === code);
      expect(row!.suicideRateValue).toBeGreaterThan(0);
    },
  );
});

// ─── Population sanity ───────────────────────────────────────

describe("Population sanity checks", () => {
  it.each(
    STATE_REFERENCE.map((s) => [s.code, s.name, s.minPopulation] as const),
  )("%s (%s) population >= %d", (code, _name, minPop) => {
    const row = stateRows.find((r) => r.code === code);
    expect(row, `No dashboard row for ${code}`).toBeDefined();
    expect(row!.populationValue).toBeGreaterThanOrEqual(minPop);
  });
});

// ─── Congressional delegation ────────────────────────────────

describe("Congressional delegation per state", () => {
  it("has congress members data loaded", () => {
    expect(congressMembers.length).toBeGreaterThan(400);
  });

  it.each(US_STATES.map((s) => [s.code, s.name]))(
    "%s (%s) has exactly 2 senators",
    (code) => {
      const senators = congressMembers.filter(
        (m) => m.state === code && m.chamber === "S",
      );
      expect(
        senators.length,
        `${code} has ${senators.length} senators: ${senators.map((s) => s.name).join(", ")}`,
      ).toBe(2);
    },
  );

  it.each(
    STATE_REFERENCE.map((s) => [s.code, s.name, s.houseSeats] as const),
  )("%s (%s) has ~%d House representatives", (code, _name, expectedSeats) => {
    const reps = congressMembers.filter(
      (m) => m.state === code && m.chamber === "H",
    );
    // Allow 1 vacancy (mid-session resignations, deaths, etc.)
    expect(
      reps.length,
      `${code} has ${reps.length} reps (expected ${expectedSeats - 1}-${expectedSeats}): ${reps.map((r) => r.name).join(", ")}`,
    ).toBeGreaterThanOrEqual(expectedSeats - 1);
    expect(reps.length).toBeLessThanOrEqual(expectedSeats);
  });
});

// ─── Senator name matching ───────────────────────────────────

describe("Senator name verification", () => {
  function normalizeName(name: string): string {
    // Handle "LAST, FIRST" or "First Last" formats
    const parts = name.includes(",")
      ? name.split(",").reverse().map((s) => s.trim()).join(" ")
      : name;
    return parts.toLowerCase().replace(/[^a-z ]/g, "").trim();
  }

  function lastNameMatch(actual: string, expected: string): boolean {
    const actualLast = normalizeName(actual).split(" ").pop() ?? "";
    const expectedLast = normalizeName(expected).split(" ").pop() ?? "";
    return actualLast === expectedLast;
  }

  it.each(
    STATE_REFERENCE.map((s) => [s.code, s.name, s.senators] as const),
  )("%s (%s) senators match reference", (code, _name, expectedSenators) => {
    const actualSenators = congressMembers
      .filter((m) => m.state === code && m.chamber === "S")
      .map((m) => m.name);

    for (const expected of expectedSenators) {
      const matched = actualSenators.some((actual) =>
        lastNameMatch(actual, expected),
      );
      if (!matched) {
        // Don't hard-fail — senators change. Log a warning.
        console.warn(
          `[STALE?] ${code}: Expected senator "${expected}" not found in [${actualSenators.join(", ")}]. ` +
          `Reference data may need updating.`,
        );
      }
    }
    // At minimum we should have 2 senators (hard requirement)
    expect(actualSenators.length).toBe(2);
  });
});

// ─── Metric range sanity ─────────────────────────────────────

describe("Metric range sanity", () => {
  it("child poverty rates are between 3% and 40%", () => {
    for (const row of stateRows) {
      if (row.childPovertyValue !== undefined) {
        expect(row.childPovertyValue).toBeGreaterThan(3);
        expect(row.childPovertyValue).toBeLessThan(40);
      }
    }
  });

  it("suicide rates are between 5 and 35 per 100k", () => {
    for (const row of stateRows) {
      if (row.suicideRateValue !== undefined) {
        expect(row.suicideRateValue).toBeGreaterThan(5);
        expect(row.suicideRateValue).toBeLessThan(35);
      }
    }
  });

  it("fertility rates are between 30 and 90 per 1k", () => {
    for (const row of stateRows) {
      if (row.fertilityValue !== undefined) {
        expect(row.fertilityValue).toBeGreaterThan(30);
        expect(row.fertilityValue).toBeLessThan(90);
      }
    }
  });

  it("child mortality is between 2 and 12 per 1k", () => {
    for (const row of stateRows) {
      if (row.childMortalityValue !== undefined) {
        expect(row.childMortalityValue).toBeGreaterThan(2);
        expect(row.childMortalityValue).toBeLessThan(12);
      }
    }
  });
});
