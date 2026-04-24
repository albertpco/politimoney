import { fetchJson } from "@/lib/ingest/http";
import type { FaraForeignPrincipal, FaraRegistrant } from "@/lib/ingest/types";

type FaraRegistrantRow = {
  Registration_Number?: string | number;
  Name?: string;
  City?: string;
  State?: string;
  Registration_Date?: string;
};

type FaraRegistrantResponse = {
  REGISTRANTS_ACTIVE?: {
    ROW?: FaraRegistrantRow[];
  };
};

type FaraForeignPrincipalRow = {
  Registration_Number?: string | number;
  Foreign_Principal_Name?: string;
  Country_Location_Represented?: string;
  Foreign_Principal_Address?: string;
};

type FaraForeignPrincipalResponse = {
  ROWSET?: {
    ROW?: FaraForeignPrincipalRow[] | FaraForeignPrincipalRow;
  };
};

export type FaraIngestResult = {
  registrants: FaraRegistrant[];
  foreignPrincipals: FaraForeignPrincipal[];
  warnings: string[];
};

const FARA_BASE_URL = "https://efile.fara.gov/api/v1";

function ensureArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function ingestFaraData({
  registrantLimit,
}: {
  registrantLimit: number;
}): Promise<FaraIngestResult> {
  const warnings: string[] = [];
  const registrantsPayload = await fetchJson<FaraRegistrantResponse>(
    `${FARA_BASE_URL}/Registrants/json/Active`,
  );

  const registrantRows = (registrantsPayload.REGISTRANTS_ACTIVE?.ROW ?? []).slice(
    0,
    registrantLimit,
  );
  const registrants: FaraRegistrant[] = registrantRows.map((row) => ({
    registrationNumber: String(row.Registration_Number ?? ""),
    name: row.Name ?? "Unknown",
    city: row.City,
    state: row.State,
    registrationDate: row.Registration_Date,
  }));

  const foreignPrincipals: FaraForeignPrincipal[] = [];
  let rateLimitHits = 0;

  for (const registrant of registrants) {
    if (!registrant.registrationNumber) continue;
    const endpoint = `${FARA_BASE_URL}/ForeignPrincipals/json/Active/${encodeURIComponent(
      registrant.registrationNumber,
    )}`;
    try {
      const payload = await fetchJson<FaraForeignPrincipalResponse>(endpoint);
      for (const row of ensureArray(payload.ROWSET?.ROW)) {
        foreignPrincipals.push({
          registrationNumber: String(
            row.Registration_Number ?? registrant.registrationNumber,
          ),
          principalName: row.Foreign_Principal_Name ?? "Unknown",
          country: row.Country_Location_Represented,
          foreignPrincipalAddress: row.Foreign_Principal_Address,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      warnings.push(
        `Failed to fetch foreign principals for ${registrant.registrationNumber}: ${message}`,
      );
      if (message.includes("(429)")) {
        rateLimitHits += 1;
        if (rateLimitHits >= 3) {
          warnings.push(
            "Stopped fetching additional foreign principals due to repeated FARA API rate limits.",
          );
          break;
        }
      }
    }

    // FARA API throttle is 5 requests per 10 seconds.
    await new Promise((resolve) => setTimeout(resolve, 2100));
  }

  if (rateLimitHits > 0) {
    warnings.push(
      `FARA API rate-limit hits encountered: ${rateLimitHits}. Consider lowering INGEST_FARA_REGISTRANT_LIMIT.`,
    );
  }
  if (!registrants.length) {
    warnings.push("No active FARA registrants returned.");
  } else if (!foreignPrincipals.length) {
    warnings.push(
      "No foreign principals were returned from sampled registrants. Verify API responsiveness.",
    );
  }

  return { registrants, foreignPrincipals, warnings };
}
