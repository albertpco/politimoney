import { describe, expect, it } from "vitest";
import { parseScreenState } from "./screen-state";
import { STATE_CODE_TO_NAME, STATE_FIPS_TO_CODE, STATE_NAME_TO_CODE, US_STATES } from "./state-metadata";
import { buildVoteSegments } from "./vote-segments";

describe("parseScreenState", () => {
  it("accepts known screen states", () => {
    expect(parseScreenState("loading")).toBe("loading");
    expect(parseScreenState("partial-coverage")).toBe("partial-coverage");
    expect(parseScreenState("blocking-error")).toBe("blocking-error");
  });

  it("uses the first value when query params provide an array", () => {
    expect(parseScreenState(["stale-data", "loading"])).toBe("stale-data");
  });

  it("rejects absent and unknown states", () => {
    expect(parseScreenState(undefined)).toBeNull();
    expect(parseScreenState("unknown")).toBeNull();
    expect(parseScreenState(["unknown", "loading"])).toBeNull();
  });
});

describe("buildVoteSegments", () => {
  it("orders common vote casts before uncommon values", () => {
    const segments = buildVoteSegments({
      Paired: 1,
      "Not Voting": 3,
      Nay: 4,
      Yea: 5,
      Present: 2,
    });

    expect(segments.map((segment) => segment.label)).toEqual([
      "Yea",
      "Nay",
      "Not Voting",
      "Present",
      "Paired",
    ]);
  });

  it("assigns stable colors and falls back for unknown vote casts", () => {
    const segments = buildVoteSegments({ Yes: 10, No: 8, Other: 1 });

    expect(segments).toContainEqual({
      label: "Yes",
      count: 10,
      color: "bg-emerald-600",
    });
    expect(segments).toContainEqual({
      label: "No",
      count: 8,
      color: "bg-rose-600",
    });
    expect(segments).toContainEqual({
      label: "Other",
      count: 1,
      color: "bg-stone-500",
    });
  });
});

describe("state metadata", () => {
  it("contains the 50 states with unique codes and FIPS values", () => {
    expect(US_STATES).toHaveLength(50);
    expect(new Set(US_STATES.map((state) => state.code))).toHaveLength(50);
    expect(new Set(US_STATES.map((state) => state.fips))).toHaveLength(50);
  });

  it("keeps lookup maps aligned with the state list", () => {
    for (const state of US_STATES) {
      expect(STATE_CODE_TO_NAME.get(state.code)).toBe(state.name);
      expect(STATE_NAME_TO_CODE.get(state.name)).toBe(state.code);
      expect(STATE_FIPS_TO_CODE.get(state.fips)).toBe(state.code);
    }
  });
});
