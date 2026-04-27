/**
 * Static fixture of state-level nominal GDP (BEA annual, FY 2023) and
 * year-over-year real GDP growth (BEA Q4 2023 → Q4 2024 advance estimate).
 *
 * Source: U.S. Bureau of Economic Analysis (public domain, no key required
 * for static reuse). https://www.bea.gov/data/gdp/gdp-state
 *
 * Values are USD millions. The provider merges this in so /states pages
 * always have a comparable economic baseline even when no live BEA pull
 * is configured.
 *
 * Refresh cadence: BEA publishes new annual estimates ~once per year.
 * Bump SOURCE_YEAR and update the table when a newer release lands.
 */

export const STATE_GDP_SOURCE_YEAR = 2023;

export type StateGdpFixtureRow = {
  /** Nominal GDP, millions USD, calendar year 2023. */
  gdpUsdMillions: number;
  /** Real GDP growth Q4-2023 → Q4-2024 percent, BEA advance state release. */
  gdpGrowthPct: number;
};

export const STATE_GDP_FIXTURE: Record<string, StateGdpFixtureRow> = {
  AL: { gdpUsdMillions: 304_220, gdpGrowthPct: 1.7 },
  AK: { gdpUsdMillions: 70_270, gdpGrowthPct: 1.4 },
  AZ: { gdpUsdMillions: 525_270, gdpGrowthPct: 4.7 },
  AR: { gdpUsdMillions: 187_490, gdpGrowthPct: 2.3 },
  CA: { gdpUsdMillions: 4_080_160, gdpGrowthPct: 3.1 },
  CO: { gdpUsdMillions: 540_220, gdpGrowthPct: 2.8 },
  CT: { gdpUsdMillions: 350_410, gdpGrowthPct: 2.4 },
  DE: { gdpUsdMillions: 92_570, gdpGrowthPct: 2.6 },
  DC: { gdpUsdMillions: 178_640, gdpGrowthPct: 1.9 },
  FL: { gdpUsdMillions: 1_705_540, gdpGrowthPct: 4.0 },
  GA: { gdpUsdMillions: 819_160, gdpGrowthPct: 3.2 },
  HI: { gdpUsdMillions: 110_790, gdpGrowthPct: 2.5 },
  ID: { gdpUsdMillions: 119_810, gdpGrowthPct: 4.1 },
  IL: { gdpUsdMillions: 1_134_380, gdpGrowthPct: 2.0 },
  IN: { gdpUsdMillions: 503_940, gdpGrowthPct: 1.6 },
  IA: { gdpUsdMillions: 254_080, gdpGrowthPct: 1.5 },
  KS: { gdpUsdMillions: 230_490, gdpGrowthPct: 2.6 },
  KY: { gdpUsdMillions: 295_490, gdpGrowthPct: 2.0 },
  LA: { gdpUsdMillions: 322_640, gdpGrowthPct: 1.0 },
  ME: { gdpUsdMillions: 99_330, gdpGrowthPct: 2.7 },
  MD: { gdpUsdMillions: 525_500, gdpGrowthPct: 2.3 },
  MA: { gdpUsdMillions: 781_320, gdpGrowthPct: 2.9 },
  MI: { gdpUsdMillions: 696_240, gdpGrowthPct: 1.8 },
  MN: { gdpUsdMillions: 502_010, gdpGrowthPct: 2.2 },
  MS: { gdpUsdMillions: 162_240, gdpGrowthPct: 1.5 },
  MO: { gdpUsdMillions: 437_780, gdpGrowthPct: 2.3 },
  MT: { gdpUsdMillions: 79_670, gdpGrowthPct: 2.6 },
  NE: { gdpUsdMillions: 175_390, gdpGrowthPct: 1.9 },
  NV: { gdpUsdMillions: 245_720, gdpGrowthPct: 3.6 },
  NH: { gdpUsdMillions: 121_410, gdpGrowthPct: 2.7 },
  NJ: { gdpUsdMillions: 821_840, gdpGrowthPct: 2.3 },
  NM: { gdpUsdMillions: 138_400, gdpGrowthPct: 4.5 },
  NY: { gdpUsdMillions: 2_173_410, gdpGrowthPct: 2.5 },
  NC: { gdpUsdMillions: 819_240, gdpGrowthPct: 3.4 },
  ND: { gdpUsdMillions: 76_030, gdpGrowthPct: 1.2 },
  OH: { gdpUsdMillions: 911_020, gdpGrowthPct: 1.9 },
  OK: { gdpUsdMillions: 271_100, gdpGrowthPct: 2.3 },
  OR: { gdpUsdMillions: 320_790, gdpGrowthPct: 2.4 },
  PA: { gdpUsdMillions: 1_026_490, gdpGrowthPct: 1.8 },
  RI: { gdpUsdMillions: 79_750, gdpGrowthPct: 2.0 },
  SC: { gdpUsdMillions: 366_390, gdpGrowthPct: 3.5 },
  SD: { gdpUsdMillions: 78_840, gdpGrowthPct: 1.7 },
  TN: { gdpUsdMillions: 538_290, gdpGrowthPct: 3.0 },
  TX: { gdpUsdMillions: 2_694_720, gdpGrowthPct: 4.1 },
  UT: { gdpUsdMillions: 264_320, gdpGrowthPct: 3.6 },
  VT: { gdpUsdMillions: 44_350, gdpGrowthPct: 2.1 },
  VA: { gdpUsdMillions: 762_040, gdpGrowthPct: 2.4 },
  WA: { gdpUsdMillions: 815_260, gdpGrowthPct: 3.1 },
  WV: { gdpUsdMillions: 102_660, gdpGrowthPct: 0.8 },
  WI: { gdpUsdMillions: 426_550, gdpGrowthPct: 1.9 },
  WY: { gdpUsdMillions: 53_910, gdpGrowthPct: 1.6 },
};
