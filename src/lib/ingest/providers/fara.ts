import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fetchJson, fetchText } from "@/lib/ingest/http";
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
const FARA_HEADERS = {
  "User-Agent": "PolitiMoney/0.1 public-record-ingest",
  Referer: "https://efile.fara.gov/",
};
const execFileAsync = promisify(execFile);

function ensureArray<T>(value: T[] | T | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

function stripTags(value: string): string {
  return decodeXmlEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function xmlBlocks(xml: string, tag: string): string[] {
  const pattern = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "g");
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function xmlValue(xml: string, tag: string): string | undefined {
  const block = xmlBlocks(xml, tag)[0];
  const value = block ? stripTags(block) : undefined;
  return value || undefined;
}

async function fetchActiveRegistrantRows(): Promise<FaraRegistrantRow[]> {
  try {
    const payload = await fetchJson<FaraRegistrantResponse>(
      `${FARA_BASE_URL}/Registrants/json/Active`,
      { headers: FARA_HEADERS },
    );
    return payload.REGISTRANTS_ACTIVE?.ROW ?? [];
  } catch {
    const xml = await fetchFaraText(`${FARA_BASE_URL}/Registrants/xml/Active`);
    return xmlBlocks(xml, "ROW").map((row) => ({
      Registration_Number: xmlValue(row, "Registration_Number"),
      Name: xmlValue(row, "Name"),
      City: xmlValue(row, "City"),
      State: xmlValue(row, "State"),
      Registration_Date: xmlValue(row, "Registration_Date"),
    }));
  }
}

async function fetchForeignPrincipalRows(registrationNumber: string): Promise<FaraForeignPrincipalRow[]> {
  const encoded = encodeURIComponent(registrationNumber);
  try {
    const payload = await fetchJson<FaraForeignPrincipalResponse>(
      `${FARA_BASE_URL}/ForeignPrincipals/json/Active/${encoded}`,
      { headers: FARA_HEADERS },
    );
    return ensureArray(payload.ROWSET?.ROW);
  } catch {
    const xml = await fetchFaraText(`${FARA_BASE_URL}/ForeignPrincipals/xml/Active/${encoded}`);
    return xmlBlocks(xml, "ROW").map((row) => ({
      Registration_Number: xmlValue(row, "Registration_Number"),
      Foreign_Principal_Name: xmlValue(row, "Foreign_Principal_Name"),
      Country_Location_Represented: xmlValue(row, "Country_Location_Represented"),
      Foreign_Principal_Address: xmlValue(row, "Foreign_Principal_Address"),
    }));
  }
}

async function fetchFaraText(url: string): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchText(url, { headers: FARA_HEADERS });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  try {
    const { stdout } = await execFileAsync(
      "curl",
      ["-fsSL", "-A", FARA_HEADERS["User-Agent"], "-e", FARA_HEADERS.Referer, url],
      { maxBuffer: 20 * 1024 * 1024 },
    );
    return stdout;
  } catch (error) {
    lastError = error;
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown FARA API fetch error");
}

export async function ingestFaraData({
  registrantLimit,
}: {
  registrantLimit: number;
}): Promise<FaraIngestResult> {
  const warnings: string[] = [];
  const registrantRows = (await fetchActiveRegistrantRows()).slice(0, registrantLimit);
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
    try {
      const rows = await fetchForeignPrincipalRows(registrant.registrationNumber);
      for (const row of rows) {
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
