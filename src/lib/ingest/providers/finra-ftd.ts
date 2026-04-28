import type { FtdRecord } from "@/lib/ingest/types";

// SEC Fails-to-Deliver datasets: https://www.sec.gov/data/foiadocsfailsdatahtm
// Each release is a ZIP (e.g. cnsfails202401a.zip) of pipe-delimited text.
// TODO: implement ZIP fetch + parse. Dormant for now per PR scope.
export async function ingestFinraFtd(params: {
  tickers: string[];
  monthsBack?: number;
}): Promise<{ data: FtdRecord[]; warnings: string[] }> {
  void params;
  return {
    data: [],
    warnings: ["FTD ingestion not yet implemented"],
  };
}
