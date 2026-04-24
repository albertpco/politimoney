import { fetchText } from "@/lib/ingest/http";
import type { CongressMember, CongressTradeDisclosure } from "@/lib/ingest/types";

// ---------------------------------------------------------------------------
// House Financial Disclosure PTR (Periodic Transaction Report) ingest
// Source: https://disclosures-clerk.house.gov/public_disc/financial-pdfs/{YEAR}FD.xml
// PDFs:   https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/{YEAR}/{DocID}.pdf
// ---------------------------------------------------------------------------

const FD_XML_BASE = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs";
const PTR_PDF_BASE = "https://disclosures-clerk.house.gov/public_disc/ptr-pdfs";

type HousePtrEntry = {
  prefix: string;
  last: string;
  first: string;
  suffix: string;
  filingType: string;
  stateDst: string;
  year: string;
  filingDate: string;
  docId: string;
};

// ---------------------------------------------------------------------------
// XML parsing — the House XML is simple enough for regex extraction
// (no namespaces, flat <Member> elements with child text nodes)
// ---------------------------------------------------------------------------

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const m = re.exec(xml);
  return m?.[1]?.trim() ?? "";
}

function parseHousePtrXml(xml: string): HousePtrEntry[] {
  const entries: HousePtrEntry[] = [];
  const memberRegex = /<Member>([\s\S]*?)<\/Member>/gi;
  let match: RegExpExecArray | null;
  while ((match = memberRegex.exec(xml)) !== null) {
    const block = match[1];
    entries.push({
      prefix: extractTag(block, "Prefix"),
      last: extractTag(block, "Last"),
      first: extractTag(block, "First"),
      suffix: extractTag(block, "Suffix"),
      filingType: extractTag(block, "FilingType"),
      stateDst: extractTag(block, "StateDst"),
      year: extractTag(block, "Year"),
      filingDate: extractTag(block, "FilingDate"),
      docId: extractTag(block, "DocID"),
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// StateDst parsing — "TX22" → { state: "TX", district: "22" }
//                    "CA"   → { state: "CA", district: undefined }
// ---------------------------------------------------------------------------

function parseStateDst(raw: string): { state: string; district?: string } {
  const s = raw.trim().toUpperCase();
  const stateCode = s.slice(0, 2);
  const district = s.length > 2 ? s.slice(2) : undefined;
  return { state: stateCode, district };
}

// ---------------------------------------------------------------------------
// Member matching — match House PTR filer to bioguide ID via congress.members
// Strategy: normalize last name + state + chamber match
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

/** Strip titles, credentials, and honorifics from a name part */
function cleanNamePart(raw: string): string {
  return raw
    .replace(/\b(hon|dr|mr|mrs|ms|jr|sr|iii|ii|iv|md|facs|phd|esq)\b/gi, "")
    .replace(/,/g, "")
    .trim();
}

/** Extract the likely last name from a messy XML last field (e.g., "Dunn, MD, FACS" → "Dunn") */
function extractLastName(raw: string): string {
  // Take the first word before any comma or credential
  const cleaned = cleanNamePart(raw);
  return cleaned.split(/\s+/)[0] ?? cleaned;
}

function matchBioguideId(
  entry: HousePtrEntry,
  members: CongressMember[],
): string | undefined {
  const { state, district } = parseStateDst(entry.stateDst);
  const entryLast = normalizeName(extractLastName(entry.last));
  const entryFirst = normalizeName(cleanNamePart(entry.first));
  // Some XML entries have multi-word last names like "Taylor Greene" or "McClain Delaney"
  const entryFullLast = normalizeName(cleanNamePart(entry.last));

  // Pass 1: exact last name + state + chamber H + district
  for (const m of members) {
    if (m.chamber !== "H") continue;
    if (m.state !== state) continue;
    const mLast = normalizeName(m.lastName ?? m.name.split(",")[0] ?? "");
    if (mLast !== entryLast && mLast !== entryFullLast) continue;
    if (district && m.district && m.district !== district) continue;
    return m.bioguideId;
  }

  // Pass 2: last name + first initial + state (no district constraint)
  for (const m of members) {
    if (m.chamber !== "H") continue;
    if (m.state !== state) continue;
    const mLast = normalizeName(m.lastName ?? m.name.split(",")[0] ?? "");
    if (mLast !== entryLast && mLast !== entryFullLast) continue;
    const mFirst = normalizeName(m.firstName ?? m.name.split(",")[1] ?? "");
    if (mFirst && entryFirst && mFirst[0] === entryFirst[0]) return m.bioguideId;
  }

  // Pass 3: multi-word last name — check if member last name is contained in entry last name
  // Handles "Taylor Greene" in XML matching "Greene" in members data
  for (const m of members) {
    if (m.chamber !== "H") continue;
    if (m.state !== state) continue;
    const mLast = normalizeName(m.lastName ?? m.name.split(",")[0] ?? "");
    if (!mLast || mLast.length < 3) continue;
    if (!entryFullLast.includes(mLast)) continue;
    if (district && m.district && m.district !== district) continue;
    return m.bioguideId;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type CongressTradesIngestResult = {
  disclosures: CongressTradeDisclosure[];
  warnings: string[];
};

export async function ingestCongressTradeDisclosures(opts: {
  years: number[];
  members: CongressMember[];
}): Promise<CongressTradesIngestResult> {
  const warnings: string[] = [];
  const disclosures: CongressTradeDisclosure[] = [];

  for (const year of opts.years) {
    const url = `${FD_XML_BASE}/${year}FD.xml`;
    let xml: string;
    try {
      xml = await fetchText(url);
    } catch (err) {
      warnings.push(`Failed to fetch House FD XML for ${year}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    const entries = parseHousePtrXml(xml);
    // Filter to PTR filings only (FilingType "P")
    const ptrEntries = entries.filter((e) => e.filingType === "P");
    console.log(`[congress-trades] ${year}: ${entries.length} total filings, ${ptrEntries.length} PTR filings`);

    for (const entry of ptrEntries) {
      const { state, district } = parseStateDst(entry.stateDst);
      const bioguideId = matchBioguideId(entry, opts.members);
      const memberName = [entry.first, entry.last].filter(Boolean).join(" ");

      disclosures.push({
        memberName,
        chamber: "H",
        state,
        district,
        filingDate: entry.filingDate,
        filingType: "PTR",
        docId: entry.docId,
        documentUrl: `${PTR_PDF_BASE}/${year}/${entry.docId}.pdf`,
        bioguideId,
        year,
      });
    }

    const unmatched = ptrEntries.filter(
      (e) => !matchBioguideId(e, opts.members),
    ).length;
    if (unmatched > 0) {
      warnings.push(
        `${year}: ${unmatched}/${ptrEntries.length} PTR filers could not be matched to a bioguide ID`,
      );
    }
  }

  // Deduplicate by docId (in case same doc appears in multiple year files)
  const seen = new Set<string>();
  const deduped = disclosures.filter((d) => {
    if (seen.has(d.docId)) return false;
    seen.add(d.docId);
    return true;
  });

  console.log(
    `[congress-trades] total: ${deduped.length} unique PTR disclosures across ${opts.years.join(", ")}`,
  );

  return { disclosures: deduped, warnings };
}
