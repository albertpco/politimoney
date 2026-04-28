import { beforeEach, describe, expect, it, vi } from "vitest";

const httpMocks = vi.hoisted(() => ({
  fetchJson: vi.fn(),
  fetchText: vi.fn(),
  fetchBytes: vi.fn(),
}));

vi.mock("@/lib/ingest/http", () => httpMocks);

import { ingestFinraShortInterest } from "./finra-short-interest";
import { ingestFinraFtd } from "./finra-ftd";
import { ingestYahooQuotes } from "./yahoo-quotes";

beforeEach(() => {
  httpMocks.fetchJson.mockReset();
  httpMocks.fetchText.mockReset();
  httpMocks.fetchBytes.mockReset();
});

describe("ingestFinraShortInterest", () => {
  it("shapes FINRA rows into ShortInterestRecord values", async () => {
    httpMocks.fetchJson.mockResolvedValueOnce([
      {
        symbolCode: "AAPL",
        settlementDate: "2026-04-15T00:00:00.000Z",
        currentShortPositionQuantity: 1_000_000,
        previousShortPositionQuantity: 800_000,
        averageDailyVolumeQuantity: 50_000_000,
        daysToCoverQuantity: "0.02",
      },
    ]);

    const result = await ingestFinraShortInterest({ tickers: ["AAPL"] });

    expect(result.warnings).toEqual([]);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      ticker: "AAPL",
      reportDate: "2026-04-15",
      shortInterest: 1_000_000,
      averageDailyVolume: 50_000_000,
      daysToCover: 0.02,
      deltaVsPrior: 200_000,
      source: "finra",
    });
  });

  it("returns empty data and a warning when fetch throws", async () => {
    httpMocks.fetchJson.mockRejectedValueOnce(new Error("429 rate limited"));
    const result = await ingestFinraShortInterest({ tickers: ["AAPL"] });
    expect(result.data).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/FINRA short interest fetch failed/);
  });

  it("warns when response is not an array", async () => {
    httpMocks.fetchJson.mockResolvedValueOnce({ unexpected: true });
    const result = await ingestFinraShortInterest({ tickers: ["AAPL"] });
    expect(result.data).toEqual([]);
    expect(result.warnings[0]).toMatch(/not an array/);
  });

  it("returns empty for empty ticker input without calling fetch", async () => {
    const result = await ingestFinraShortInterest({ tickers: [] });
    expect(result.data).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(httpMocks.fetchJson).not.toHaveBeenCalled();
  });
});

describe("ingestFinraFtd", () => {
  it("returns empty data and a stub warning", async () => {
    const result = await ingestFinraFtd({ tickers: ["AAPL"] });
    expect(result.data).toEqual([]);
    expect(result.warnings).toEqual(["FTD ingestion not yet implemented"]);
    expect(httpMocks.fetchJson).not.toHaveBeenCalled();
    expect(httpMocks.fetchText).not.toHaveBeenCalled();
    expect(httpMocks.fetchBytes).not.toHaveBeenCalled();
  });
});

describe("ingestYahooQuotes", () => {
  it("shapes Yahoo result rows into QuoteRecord values", async () => {
    httpMocks.fetchJson.mockResolvedValueOnce({
      quoteResponse: {
        result: [
          {
            symbol: "AAPL",
            regularMarketPrice: 195.5,
            regularMarketPreviousClose: 193.0,
            fiftyTwoWeekLow: 150.0,
            fiftyTwoWeekHigh: 220.0,
            regularMarketVolume: 80_000_000,
            marketCap: 3_000_000_000_000,
            beta: 1.2,
            trailingPE: 30.1,
            forwardPE: 28.5,
            dividendYield: 0.005,
            exDividendDate: 1_700_000_000,
            earningsTimestamp: 1_705_000_000,
          },
        ],
        error: null,
      },
    });

    const result = await ingestYahooQuotes({ tickers: ["AAPL"] });

    expect(result.warnings).toEqual([]);
    expect(result.data).toHaveLength(1);
    const quote = result.data[0];
    expect(quote.ticker).toBe("AAPL");
    expect(quote.price).toBe(195.5);
    expect(quote.previousClose).toBe(193.0);
    expect(quote.fiftyTwoWeekLow).toBe(150.0);
    expect(quote.fiftyTwoWeekHigh).toBe(220.0);
    expect(quote.marketCap).toBe(3_000_000_000_000);
    expect(quote.dividendYield).toBe(0.005);
    expect(quote.exDividendDate).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(quote.earningsTimestamp).toBe(new Date(1_705_000_000 * 1000).toISOString());
    expect(quote.source).toBe("yahoo");
    expect(typeof quote.fetchedAt).toBe("string");
  });

  it("returns warnings when Yahoo returns an empty result list", async () => {
    httpMocks.fetchJson.mockResolvedValueOnce({
      quoteResponse: { result: [], error: null },
    });
    const result = await ingestYahooQuotes({ tickers: ["FOOBAR"] });
    expect(result.data).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/no quotes/);
  });

  it("returns warnings when fetch throws (e.g. 429)", async () => {
    httpMocks.fetchJson.mockRejectedValueOnce(new Error("429 rate limited"));
    const result = await ingestYahooQuotes({ tickers: ["AAPL"] });
    expect(result.data).toEqual([]);
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/Yahoo quote fetch failed/);
  });

  it("returns empty for empty ticker input", async () => {
    const result = await ingestYahooQuotes({ tickers: [] });
    expect(result.data).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(httpMocks.fetchJson).not.toHaveBeenCalled();
  });
});
