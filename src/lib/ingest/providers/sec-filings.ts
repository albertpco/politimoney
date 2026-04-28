import { fetchJson } from "@/lib/ingest/http";
import type {
  SecCorporateFiling,
  SecCorporateFilingType,
} from "@/lib/ingest/types";

const SEC_USER_AGENT = "politimoney/0.1 albpcohen@gmail.com";

const SEC_HEADERS: Record<string, string> = {
  "User-Agent": SEC_USER_AGENT,
};

function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TARGET_FORMS: ReadonlySet<SecCorporateFilingType> = new Set([
  "SC 13D",
  "SC 13D/A",
  "8-K",
  "NT 10-K",
  "NT 10-Q",
  "S-3",
  "S-3/A",
  "424B5",
]);

export type SecFilingsCompanyInput = {
  cik: string;
  ticker: string;
  companyName: string;
};

type EdgarSubmissionFiling = {
  accessionNumber: string[];
  form: string[];
  filingDate: string[];
  primaryDocument: string[];
  items?: string[];
};

type EdgarSubmissionsResponse = {
  cik: number;
  name: string;
  tickers?: string[];
  filings: {
    recent: EdgarSubmissionFiling;
  };
};

function isTargetForm(form: string): form is SecCorporateFilingType {
  return TARGET_FORMS.has(form as SecCorporateFilingType);
}

function parseItems(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return parts.length > 0 ? parts : undefined;
}

async function fetchCompanyFilings(
  company: SecFilingsCompanyInput,
  perFormLimit: number,
): Promise<{ filings: SecCorporateFiling[]; warnings: string[] }> {
  const warnings: string[] = [];
  const filings: SecCorporateFiling[] = [];

  const paddedCik = company.cik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  let data: EdgarSubmissionsResponse;
  try {
    data = await fetchJson<EdgarSubmissionsResponse>(url, {
      headers: SEC_HEADERS,
    });
  } catch (error) {
    warnings.push(
      `Failed to fetch submissions for CIK ${company.cik}: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { filings, warnings };
  }

  const recent = data.filings?.recent;
  if (!recent || !Array.isArray(recent.form)) {
    return { filings, warnings };
  }

  const resolvedCompanyName = data.name || company.companyName;
  const resolvedTicker = data.tickers?.[0] ?? company.ticker;

  const perFormCounts = new Map<SecCorporateFilingType, number>();

  for (let i = 0; i < recent.form.length; i++) {
    const form = recent.form[i];
    if (!isTargetForm(form)) continue;

    const seen = perFormCounts.get(form) ?? 0;
    if (seen >= perFormLimit) continue;
    perFormCounts.set(form, seen + 1);

    const accessionNumber = recent.accessionNumber[i];
    const filingDate = recent.filingDate[i];
    const primaryDocument = recent.primaryDocument[i];
    if (!accessionNumber || !filingDate || !primaryDocument) continue;

    const accessionNoDashes = accessionNumber.replace(/-/g, "");
    const docName = primaryDocument.split("/").pop() ?? primaryDocument;
    const primaryDocumentUrl = `https://www.sec.gov/Archives/edgar/data/${company.cik}/${accessionNoDashes}/${docName}`;

    const items = form === "8-K" ? parseItems(recent.items?.[i]) : undefined;

    const filing: SecCorporateFiling = {
      cik: company.cik,
      ticker: resolvedTicker,
      companyName: resolvedCompanyName,
      form,
      filingDate,
      accessionNumber,
      primaryDocumentUrl,
    };

    if (items && items.length > 0) {
      filing.items = items;
    }

    if (form === "SC 13D" || form === "SC 13D/A") {
      // TODO(pr-future): parse 13D body to populate filerName/filerCik when the
      // beneficial owner differs from the issuer. For now we record the filing
      // reference with issuer fields as a placeholder.
      filing.filerName = resolvedCompanyName;
      filing.filerCik = company.cik;
    }

    filings.push(filing);
  }

  return { filings, warnings };
}

export type SecFilingsIngestResult = {
  filings: SecCorporateFiling[];
  warnings: string[];
};

export async function ingestSecCorporateFilings({
  companies,
  perFormLimit = 20,
}: {
  companies: SecFilingsCompanyInput[];
  perFormLimit?: number;
}): Promise<SecFilingsIngestResult> {
  const allFilings: SecCorporateFiling[] = [];
  const warnings: string[] = [];

  for (const company of companies) {
    if (!company.cik) continue;
    await delay();
    const result = await fetchCompanyFilings(company, perFormLimit);
    allFilings.push(...result.filings);
    warnings.push(...result.warnings);
  }

  console.log(
    `[sec-filings] Fetched ${allFilings.length} corporate filings across ${companies.length} companies`,
  );

  return { filings: allFilings, warnings };
}
