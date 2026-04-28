import { fetchJson } from "@/lib/ingest/http";
import type { ShortInterestRecord } from "@/lib/ingest/types";

// FINRA Data Open API: equityShortInterest dataset.
// Public docs: https://www.finra.org/finra-data/browse-catalog/short-sale-volume-data/equity-short-interest
// TODO: confirm endpoint and auth — FINRA Query API is documented but the precise
// dataset path/parameters can change. If the call fails, callers receive warnings
// rather than an exception.
const FINRA_BASE_URL =
  "https://api.finra.org/data/group/otcMarket/name/equityShortInterest";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent": "politimoney/0.1 albpcohen@gmail.com",
  Accept: "application/json",
};

type FinraShortInterestRow = {
  symbolCode?: string;
  issueSymbolCode?: string;
  settlementDate?: string;
  currentShortPositionQuantity?: number | string;
  previousShortPositionQuantity?: number | string;
  averageDailyVolumeQuantity?: number | string;
  daysToCoverQuantity?: number | string;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = toNumber(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildQueryUrl(tickers: string[]): string {
  const upper = tickers.map((t) => t.toUpperCase());
  const compareFilters = upper
    .map((t) => `symbolCode=${encodeURIComponent(t)}`)
    .join(",");
  const params = new URLSearchParams({
    limit: "500",
    compareFilters,
  });
  return `${FINRA_BASE_URL}?${params.toString()}`;
}

export async function ingestFinraShortInterest(params: {
  tickers: string[];
}): Promise<{ data: ShortInterestRecord[]; warnings: string[] }> {
  const warnings: string[] = [];
  const data: ShortInterestRecord[] = [];

  if (!params.tickers.length) {
    return { data, warnings };
  }

  try {
    const url = buildQueryUrl(params.tickers);
    const rows = await fetchJson<FinraShortInterestRow[]>(url, {
      headers: DEFAULT_HEADERS,
    });

    if (!Array.isArray(rows)) {
      warnings.push("FINRA short interest response was not an array");
      return { data, warnings };
    }

    for (const row of rows) {
      const ticker = (row.symbolCode ?? row.issueSymbolCode ?? "").toUpperCase();
      const reportDate = (row.settlementDate ?? "").slice(0, 10);
      if (!ticker || !reportDate) continue;

      const current = toNumber(row.currentShortPositionQuantity);
      const previous = toNumber(row.previousShortPositionQuantity);

      data.push({
        ticker,
        reportDate,
        shortInterest: current,
        averageDailyVolume: toNumber(row.averageDailyVolumeQuantity),
        daysToCover: toNullableNumber(row.daysToCoverQuantity),
        deltaVsPrior: previous ? current - previous : undefined,
        source: "finra",
      });
    }
  } catch (error) {
    warnings.push(
      `FINRA short interest fetch failed: ${error instanceof Error ? error.message : "unknown"}`,
    );
  }

  return { data, warnings };
}
