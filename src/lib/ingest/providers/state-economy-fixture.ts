/**
 * Static fixtures for slow-moving state-level public statistics.
 * All sources are public domain or fact-of-record published once a year.
 *
 * Refresh cadence: bump SOURCE_YEAR and update tables when:
 *   - Census ACS 1-year publishes (Sept) — income, age, education
 *   - BLS LAUS publishes annual (Mar)    — unemployment
 *   - Tax Foundation publishes annual (Apr) — state+local tax burden
 *   - Rockefeller Institute Balance of Payments (Oct) — federal balance
 *
 * Sources:
 *   - Median household income, median age, % bachelor's+ : U.S. Census ACS 1-year 2023
 *     (S1903_C03_001E, S0101_C01_032E, S1501_C02_015E)
 *   - Unemployment rate: U.S. BLS Local Area Unemployment Statistics, 2024 annual
 *   - State+local tax burden % of net product: Tax Foundation 2022 study
 *   - Federal balance per capita (federal $ received minus federal $ paid):
 *     Rockefeller Institute Balance of Payments, FY 2022 release
 */

export const STATE_ECONOMY_SOURCE_YEAR = 2023;
export const STATE_UNEMPLOYMENT_SOURCE_YEAR = 2024;
export const STATE_TAX_BURDEN_SOURCE_YEAR = 2022;
export const STATE_FEDERAL_BALANCE_SOURCE_YEAR = 2022;

export type StateEconomyFixtureRow = {
  /** Median household income, USD (Census ACS S1903). */
  medianHouseholdIncomeUsd: number;
  /** Median age in years (Census ACS S0101). */
  medianAgeYears: number;
  /** Percent of population age 25+ with bachelor's degree or higher (S1501). */
  bachelorsOrHigherPct: number;
  /** Unemployment rate, percent, BLS annual. */
  unemploymentRatePct: number;
  /** State+local taxes paid as % of state net product, Tax Foundation. */
  stateLocalTaxBurdenPct: number;
  /** Net federal $ per resident: positive = receives more than pays. */
  federalBalancePerCapitaUsd: number;
};

export const STATE_ECONOMY_FIXTURE: Record<string, StateEconomyFixtureRow> = {
  AL: { medianHouseholdIncomeUsd: 60660, medianAgeYears: 39.6, bachelorsOrHigherPct: 28.0, unemploymentRatePct: 2.9, stateLocalTaxBurdenPct: 9.8,  federalBalancePerCapitaUsd:  6280 },
  AK: { medianHouseholdIncomeUsd: 89740, medianAgeYears: 35.7, bachelorsOrHigherPct: 31.4, unemploymentRatePct: 4.7, stateLocalTaxBurdenPct: 4.6,  federalBalancePerCapitaUsd:  9810 },
  AZ: { medianHouseholdIncomeUsd: 74568, medianAgeYears: 38.9, bachelorsOrHigherPct: 31.2, unemploymentRatePct: 3.9, stateLocalTaxBurdenPct: 9.5,  federalBalancePerCapitaUsd:  3340 },
  AR: { medianHouseholdIncomeUsd: 56335, medianAgeYears: 38.6, bachelorsOrHigherPct: 24.5, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 10.2, federalBalancePerCapitaUsd:  4640 },
  CA: { medianHouseholdIncomeUsd: 95521, medianAgeYears: 37.6, bachelorsOrHigherPct: 36.0, unemploymentRatePct: 5.4, stateLocalTaxBurdenPct: 13.5, federalBalancePerCapitaUsd:  -290 },
  CO: { medianHouseholdIncomeUsd: 92911, medianAgeYears: 37.8, bachelorsOrHigherPct: 43.4, unemploymentRatePct: 4.0, stateLocalTaxBurdenPct: 9.7,  federalBalancePerCapitaUsd:   910 },
  CT: { medianHouseholdIncomeUsd: 91665, medianAgeYears: 41.4, bachelorsOrHigherPct: 41.0, unemploymentRatePct: 3.5, stateLocalTaxBurdenPct: 15.4, federalBalancePerCapitaUsd:  -510 },
  DE: { medianHouseholdIncomeUsd: 79325, medianAgeYears: 41.3, bachelorsOrHigherPct: 35.4, unemploymentRatePct: 4.0, stateLocalTaxBurdenPct: 12.4, federalBalancePerCapitaUsd:  3920 },
  DC: { medianHouseholdIncomeUsd: 108210, medianAgeYears: 34.6, bachelorsOrHigherPct: 60.4, unemploymentRatePct: 5.5, stateLocalTaxBurdenPct: 12.0, federalBalancePerCapitaUsd: 19080 },
  FL: { medianHouseholdIncomeUsd: 71711, medianAgeYears: 42.6, bachelorsOrHigherPct: 33.0, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 9.1,  federalBalancePerCapitaUsd:  4360 },
  GA: { medianHouseholdIncomeUsd: 74632, medianAgeYears: 37.3, bachelorsOrHigherPct: 33.8, unemploymentRatePct: 3.6, stateLocalTaxBurdenPct: 8.9,  federalBalancePerCapitaUsd:  2890 },
  HI: { medianHouseholdIncomeUsd: 95322, medianAgeYears: 40.1, bachelorsOrHigherPct: 35.9, unemploymentRatePct: 3.0, stateLocalTaxBurdenPct: 14.1, federalBalancePerCapitaUsd:  6210 },
  ID: { medianHouseholdIncomeUsd: 74636, medianAgeYears: 37.0, bachelorsOrHigherPct: 30.8, unemploymentRatePct: 3.6, stateLocalTaxBurdenPct: 10.7, federalBalancePerCapitaUsd:  3050 },
  IL: { medianHouseholdIncomeUsd: 81702, medianAgeYears: 39.0, bachelorsOrHigherPct: 38.4, unemploymentRatePct: 4.9, stateLocalTaxBurdenPct: 12.9, federalBalancePerCapitaUsd: -1090 },
  IN: { medianHouseholdIncomeUsd: 70051, medianAgeYears: 38.2, bachelorsOrHigherPct: 28.6, unemploymentRatePct: 3.8, stateLocalTaxBurdenPct: 9.3,  federalBalancePerCapitaUsd:  1840 },
  IA: { medianHouseholdIncomeUsd: 73147, medianAgeYears: 38.3, bachelorsOrHigherPct: 30.7, unemploymentRatePct: 3.0, stateLocalTaxBurdenPct: 11.2, federalBalancePerCapitaUsd:  2010 },
  KS: { medianHouseholdIncomeUsd: 75979, medianAgeYears: 37.4, bachelorsOrHigherPct: 35.0, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 11.2, federalBalancePerCapitaUsd:  3070 },
  KY: { medianHouseholdIncomeUsd: 60183, medianAgeYears: 39.4, bachelorsOrHigherPct: 26.5, unemploymentRatePct: 4.5, stateLocalTaxBurdenPct: 9.6,  federalBalancePerCapitaUsd:  6470 },
  LA: { medianHouseholdIncomeUsd: 57852, medianAgeYears: 37.8, bachelorsOrHigherPct: 25.9, unemploymentRatePct: 4.4, stateLocalTaxBurdenPct: 9.1,  federalBalancePerCapitaUsd:  4220 },
  ME: { medianHouseholdIncomeUsd: 71773, medianAgeYears: 45.1, bachelorsOrHigherPct: 35.0, unemploymentRatePct: 3.5, stateLocalTaxBurdenPct: 12.4, federalBalancePerCapitaUsd:  4970 },
  MD: { medianHouseholdIncomeUsd: 102310, medianAgeYears: 39.4, bachelorsOrHigherPct: 42.6, unemploymentRatePct: 3.0, stateLocalTaxBurdenPct: 11.3, federalBalancePerCapitaUsd:  6840 },
  MA: { medianHouseholdIncomeUsd: 99858, medianAgeYears: 39.8, bachelorsOrHigherPct: 47.4, unemploymentRatePct: 4.0, stateLocalTaxBurdenPct: 11.5, federalBalancePerCapitaUsd:   430 },
  MI: { medianHouseholdIncomeUsd: 69183, medianAgeYears: 40.1, bachelorsOrHigherPct: 32.4, unemploymentRatePct: 4.6, stateLocalTaxBurdenPct: 8.6,  federalBalancePerCapitaUsd:  2100 },
  MN: { medianHouseholdIncomeUsd: 87556, medianAgeYears: 38.7, bachelorsOrHigherPct: 39.6, unemploymentRatePct: 3.2, stateLocalTaxBurdenPct: 12.1, federalBalancePerCapitaUsd:   320 },
  MS: { medianHouseholdIncomeUsd: 54915, medianAgeYears: 38.0, bachelorsOrHigherPct: 23.5, unemploymentRatePct: 3.6, stateLocalTaxBurdenPct: 9.8,  federalBalancePerCapitaUsd:  6780 },
  MO: { medianHouseholdIncomeUsd: 68545, medianAgeYears: 39.0, bachelorsOrHigherPct: 32.4, unemploymentRatePct: 3.7, stateLocalTaxBurdenPct: 9.3,  federalBalancePerCapitaUsd:  2740 },
  MT: { medianHouseholdIncomeUsd: 70804, medianAgeYears: 40.4, bachelorsOrHigherPct: 34.3, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 10.5, federalBalancePerCapitaUsd:  3970 },
  NE: { medianHouseholdIncomeUsd: 78109, medianAgeYears: 36.8, bachelorsOrHigherPct: 35.0, unemploymentRatePct: 2.9, stateLocalTaxBurdenPct: 11.5, federalBalancePerCapitaUsd:  1540 },
  NV: { medianHouseholdIncomeUsd: 76364, medianAgeYears: 38.7, bachelorsOrHigherPct: 27.5, unemploymentRatePct: 5.5, stateLocalTaxBurdenPct: 9.6,  federalBalancePerCapitaUsd:  2010 },
  NH: { medianHouseholdIncomeUsd: 95628, medianAgeYears: 43.0, bachelorsOrHigherPct: 41.5, unemploymentRatePct: 2.6, stateLocalTaxBurdenPct: 9.6,  federalBalancePerCapitaUsd:   180 },
  NJ: { medianHouseholdIncomeUsd: 101051, medianAgeYears: 40.1, bachelorsOrHigherPct: 43.5, unemploymentRatePct: 4.7, stateLocalTaxBurdenPct: 13.2, federalBalancePerCapitaUsd: -2220 },
  NM: { medianHouseholdIncomeUsd: 62268, medianAgeYears: 39.3, bachelorsOrHigherPct: 30.0, unemploymentRatePct: 4.1, stateLocalTaxBurdenPct: 10.2, federalBalancePerCapitaUsd: 12390 },
  NY: { medianHouseholdIncomeUsd: 84578, medianAgeYears: 39.3, bachelorsOrHigherPct: 41.0, unemploymentRatePct: 4.4, stateLocalTaxBurdenPct: 15.9, federalBalancePerCapitaUsd: -2030 },
  NC: { medianHouseholdIncomeUsd: 70804, medianAgeYears: 39.0, bachelorsOrHigherPct: 35.4, unemploymentRatePct: 3.7, stateLocalTaxBurdenPct: 9.9,  federalBalancePerCapitaUsd:  3760 },
  ND: { medianHouseholdIncomeUsd: 76525, medianAgeYears: 35.4, bachelorsOrHigherPct: 32.0, unemploymentRatePct: 2.6, stateLocalTaxBurdenPct: 8.8,  federalBalancePerCapitaUsd:   860 },
  OH: { medianHouseholdIncomeUsd: 69680, medianAgeYears: 39.7, bachelorsOrHigherPct: 31.3, unemploymentRatePct: 4.4, stateLocalTaxBurdenPct: 10.0, federalBalancePerCapitaUsd:  3170 },
  OK: { medianHouseholdIncomeUsd: 63603, medianAgeYears: 37.0, bachelorsOrHigherPct: 27.5, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 9.0,  federalBalancePerCapitaUsd:  3840 },
  OR: { medianHouseholdIncomeUsd: 80160, medianAgeYears: 40.0, bachelorsOrHigherPct: 36.7, unemploymentRatePct: 4.3, stateLocalTaxBurdenPct: 10.8, federalBalancePerCapitaUsd:  2270 },
  PA: { medianHouseholdIncomeUsd: 76081, medianAgeYears: 40.7, bachelorsOrHigherPct: 35.8, unemploymentRatePct: 3.6, stateLocalTaxBurdenPct: 10.6, federalBalancePerCapitaUsd:  3010 },
  RI: { medianHouseholdIncomeUsd: 84972, medianAgeYears: 40.4, bachelorsOrHigherPct: 38.4, unemploymentRatePct: 4.6, stateLocalTaxBurdenPct: 11.4, federalBalancePerCapitaUsd:  4070 },
  SC: { medianHouseholdIncomeUsd: 67804, medianAgeYears: 40.3, bachelorsOrHigherPct: 32.2, unemploymentRatePct: 4.1, stateLocalTaxBurdenPct: 8.9,  federalBalancePerCapitaUsd:  3720 },
  SD: { medianHouseholdIncomeUsd: 71722, medianAgeYears: 37.7, bachelorsOrHigherPct: 32.6, unemploymentRatePct: 1.9, stateLocalTaxBurdenPct: 8.4,  federalBalancePerCapitaUsd:  3260 },
  TN: { medianHouseholdIncomeUsd: 67631, medianAgeYears: 38.9, bachelorsOrHigherPct: 30.9, unemploymentRatePct: 3.3, stateLocalTaxBurdenPct: 7.6,  federalBalancePerCapitaUsd:  3470 },
  TX: { medianHouseholdIncomeUsd: 75780, medianAgeYears: 35.5, bachelorsOrHigherPct: 33.5, unemploymentRatePct: 4.1, stateLocalTaxBurdenPct: 8.6,  federalBalancePerCapitaUsd:  -130 },
  UT: { medianHouseholdIncomeUsd: 93421, medianAgeYears: 31.9, bachelorsOrHigherPct: 38.2, unemploymentRatePct: 3.5, stateLocalTaxBurdenPct: 12.1, federalBalancePerCapitaUsd:   470 },
  VT: { medianHouseholdIncomeUsd: 81211, medianAgeYears: 43.0, bachelorsOrHigherPct: 41.2, unemploymentRatePct: 2.4, stateLocalTaxBurdenPct: 13.6, federalBalancePerCapitaUsd:  4150 },
  VA: { medianHouseholdIncomeUsd: 89931, medianAgeYears: 38.7, bachelorsOrHigherPct: 41.4, unemploymentRatePct: 2.9, stateLocalTaxBurdenPct: 12.5, federalBalancePerCapitaUsd: 11210 },
  WA: { medianHouseholdIncomeUsd: 94605, medianAgeYears: 38.2, bachelorsOrHigherPct: 39.2, unemploymentRatePct: 4.9, stateLocalTaxBurdenPct: 10.7, federalBalancePerCapitaUsd:  -310 },
  WV: { medianHouseholdIncomeUsd: 55948, medianAgeYears: 42.9, bachelorsOrHigherPct: 24.7, unemploymentRatePct: 4.4, stateLocalTaxBurdenPct: 9.8,  federalBalancePerCapitaUsd:  6680 },
  WI: { medianHouseholdIncomeUsd: 75670, medianAgeYears: 39.9, bachelorsOrHigherPct: 33.0, unemploymentRatePct: 3.0, stateLocalTaxBurdenPct: 10.9, federalBalancePerCapitaUsd:  1240 },
  WY: { medianHouseholdIncomeUsd: 74815, medianAgeYears: 38.6, bachelorsOrHigherPct: 30.0, unemploymentRatePct: 3.4, stateLocalTaxBurdenPct: 7.5,  federalBalancePerCapitaUsd:  3290 },
};
