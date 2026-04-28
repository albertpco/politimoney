import { fetchJson } from "@/lib/ingest/http";
import type { QuoteRecord } from "@/lib/ingest/types";

// Yahoo Finance public quote endpoint (unofficial). Browser-like UA reduces
// 401/empty responses; Yahoo is rate-limited and may return empty result lists.
const YAHOO_QUOTE_URL = "https://query1.finance.yahoo.com/v7/finance/quote";
const BATCH_SIZE = 50;

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

type YahooQuoteResultRow = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketPreviousClose?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  beta?: number;
  trailingPE?: number;
  forwardPE?: number;
  trailingAnnualDividendYield?: number;
  dividendYield?: number;
  exDividendDate?: number;
  earningsTimestamp?: number;
};

type YahooQuoteResponse = {
  quoteResponse?: {
    result?: YahooQuoteResultRow[];
    error?: { code?: string; description?: string } | null;
  };
};

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function epochToIsoOrNull(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  // Yahoo returns seconds since epoch.
  return new Date(value * 1000).toISOString();
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export async function ingestYahooQuotes(params: {
  tickers: string[];
}): Promise<{ data: QuoteRecord[]; warnings: string[] }> {
  const warnings: string[] = [];
  const data: QuoteRecord[] = [];
  const fetchedAt = new Date().toISOString();

  const tickers = params.tickers
    .map((t) => t.trim().toUpperCase())
    .filter((t) => t.length > 0);

  if (!tickers.length) return { data, warnings };

  for (const batch of chunk(tickers, BATCH_SIZE)) {
    const url = `${YAHOO_QUOTE_URL}?symbols=${encodeURIComponent(batch.join(","))}`;
    try {
      const response = await fetchJson<YahooQuoteResponse>(url, {
        headers: BROWSER_HEADERS,
      });
      const rows = response.quoteResponse?.result ?? [];
      if (response.quoteResponse?.error) {
        warnings.push(
          `Yahoo quote error: ${response.quoteResponse.error.description ?? response.quoteResponse.error.code ?? "unknown"}`,
        );
      }
      if (!rows.length) {
        warnings.push(
          `Yahoo returned no quotes for batch: ${batch.join(",")}`,
        );
        continue;
      }
      for (const row of rows) {
        const ticker = (row.symbol ?? "").toUpperCase();
        if (!ticker) continue;
        data.push({
          ticker,
          price: toNullableNumber(row.regularMarketPrice),
          previousClose: toNullableNumber(row.regularMarketPreviousClose),
          fiftyTwoWeekLow: toNullableNumber(row.fiftyTwoWeekLow),
          fiftyTwoWeekHigh: toNullableNumber(row.fiftyTwoWeekHigh),
          volume: toNullableNumber(row.regularMarketVolume),
          marketCap: toNullableNumber(row.marketCap),
          beta: toNullableNumber(row.beta),
          trailingPE: toNullableNumber(row.trailingPE),
          forwardPE: toNullableNumber(row.forwardPE),
          dividendYield: toNullableNumber(
            row.dividendYield ?? row.trailingAnnualDividendYield,
          ),
          exDividendDate: epochToIsoOrNull(row.exDividendDate),
          earningsTimestamp: epochToIsoOrNull(row.earningsTimestamp),
          fetchedAt,
          source: "yahoo",
        });
      }
    } catch (error) {
      warnings.push(
        `Yahoo quote fetch failed for batch ${batch.join(",")}: ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { data, warnings };
}
