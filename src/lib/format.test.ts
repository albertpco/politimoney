import { describe, it, expect } from "vitest";
import {
  fmtCompact,
  fmtMoney,
  toProperCase,
  normalizeParty,
  donorTypeLabel,
  formatCycleLabel,
} from "./format";

describe("fmtCompact", () => {
  it("formats positive numbers as compact USD", () => {
    expect(fmtCompact(1_000_000)).toMatch(/\$1(\.0)?M/);
  });
  it("formats billions", () => {
    expect(fmtCompact(2_500_000_000)).toMatch(/\$2\.5B/);
  });
  it("formats thousands", () => {
    expect(fmtCompact(50_000)).toMatch(/\$50(\.0)?K/);
  });
  it("formats small positive numbers", () => {
    expect(fmtCompact(1)).toMatch(/\$1/);
  });
  it("returns dash for zero", () => {
    expect(fmtCompact(0)).toBe("—");
  });
  it("returns dash for negative", () => {
    expect(fmtCompact(-100)).toBe("—");
  });
  it("returns dash for NaN", () => {
    expect(fmtCompact(NaN)).toBe("—");
  });
});

describe("fmtMoney", () => {
  it("formats positive numbers as full USD", () => {
    expect(fmtMoney(1234567)).toBe("$1,234,567");
  });
  it("returns $0 for undefined", () => {
    expect(fmtMoney(undefined)).toBe("$0");
  });
  it("returns $0 for zero", () => {
    expect(fmtMoney(0)).toBe("$0");
  });
  it("returns $0 for NaN", () => {
    expect(fmtMoney(NaN)).toBe("$0");
  });
  it("returns $0 for Infinity", () => {
    expect(fmtMoney(Infinity)).toBe("$0");
  });
  it("returns $0 for negative Infinity", () => {
    expect(fmtMoney(-Infinity)).toBe("$0");
  });
  it("formats small positive numbers", () => {
    expect(fmtMoney(42)).toBe("$42");
  });
});

describe("toProperCase", () => {
  it("converts LAST, FIRST format", () => {
    expect(toProperCase("CRUZ, RAFAEL EDWARD TED")).toBe("Rafael Edward Ted Cruz");
  });
  it("handles simple names", () => {
    expect(toProperCase("JOHN SMITH")).toBe("John Smith");
  });
  it("preserves short uppercase (II, JR)", () => {
    expect(toProperCase("SMITH, JOHN JR")).toBe("John JR Smith");
  });
  it("handles empty string", () => {
    expect(toProperCase("")).toBe("");
  });
  it("handles single word names", () => {
    expect(toProperCase("MADONNA")).toBe("Madonna");
  });
  it("handles names with multiple commas", () => {
    expect(toProperCase("SMITH, JOHN, III")).toBe("John, Iii Smith");
  });
  it("handles already proper-cased names", () => {
    expect(toProperCase("John Smith")).toBe("John Smith");
  });
  it("handles hyphenated names", () => {
    expect(toProperCase("GARCIA-LOPEZ, MARIA")).toBe("Maria Garcia-Lopez");
  });
});

describe("normalizeParty", () => {
  it("normalizes Democratic", () => {
    expect(normalizeParty("DEMOCRATIC PARTY")).toBe("D");
  });
  it("normalizes Republican", () => {
    expect(normalizeParty("REPUBLICAN PARTY")).toBe("R");
  });
  it("normalizes Libertarian", () => {
    expect(normalizeParty("LIBERTARIAN")).toBe("L");
  });
  it("normalizes Independent", () => {
    expect(normalizeParty("INDEPENDENT")).toBe("I");
  });
  it("passes through short codes", () => {
    expect(normalizeParty("D")).toBe("D");
    expect(normalizeParty("R")).toBe("R");
  });
  it("passes through ID (Independent Democrat)", () => {
    expect(normalizeParty("ID")).toBe("ID");
  });
  it("returns dash for null", () => {
    expect(normalizeParty(null)).toBe("—");
  });
  it("returns dash for undefined", () => {
    expect(normalizeParty(undefined)).toBe("—");
  });
  it("returns dash for empty string", () => {
    expect(normalizeParty("")).toBe("—");
  });
  it("handles lowercase input", () => {
    expect(normalizeParty("democratic")).toBe("D");
  });
  it("handles whitespace", () => {
    expect(normalizeParty("  REPUBLICAN  ")).toBe("R");
  });
});

describe("donorTypeLabel", () => {
  it("returns Person for person", () => {
    expect(donorTypeLabel("person")).toBe("Person");
  });
  it("returns Organization for organization", () => {
    expect(donorTypeLabel("organization")).toBe("Organization");
  });
  it("returns Unclassified for unknown", () => {
    expect(donorTypeLabel("unknown")).toBe("Unclassified");
  });
});

describe("formatCycleLabel", () => {
  it("handles single cycle", () => {
    expect(formatCycleLabel([2024])).toBe("cycle 2024");
  });
  it("handles multiple cycles", () => {
    expect(formatCycleLabel([2024, 2026])).toBe("cycles 2024, 2026");
  });
  it("handles three cycles", () => {
    expect(formatCycleLabel([2020, 2022, 2024])).toBe("cycles 2020, 2022, 2024");
  });
  it("handles empty", () => {
    expect(formatCycleLabel([])).toBe("cycle unavailable");
  });
  it("handles undefined", () => {
    expect(formatCycleLabel(undefined)).toBe("cycle unavailable");
  });
});
