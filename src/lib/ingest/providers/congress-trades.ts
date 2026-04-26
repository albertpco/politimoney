import { fetchBytes, fetchText } from "@/lib/ingest/http";
import type { CongressMember, CongressTrade, CongressTradeDisclosure } from "@/lib/ingest/types";

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
  trades: CongressTrade[];
  warnings: string[];
};

type ParsedHousePtrTransaction = {
  ticker?: string;
  assetName: string;
  assetType?: string;
  owner?: string;
  transactionType: CongressTrade["transactionType"];
  transactionLabel: string;
  amountRange: string;
  transactionDate: string;
  notificationDate?: string;
  filingStatus?: string;
  capitalGainsOver200?: boolean;
};

type PdfTextRow = {
  y: number;
  cells: { x: number; text: string }[];
};

const HOUSE_PTR_PDF_DELAY_MS = 300;
const HOUSE_PTR_PDF_LIMIT = Number(process.env.INGEST_HOUSE_PTR_PDF_LIMIT ?? 0);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanPdfText(value: string): string {
  return value.replace(/\0/g, "").replace(/\s+/g, " ").trim();
}

function normalizeDate(value: string): string {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!match) return value.trim();
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function mapTransactionType(label: string): CongressTrade["transactionType"] {
  const normalized = label.trim().toUpperCase();
  if (normalized.startsWith("P")) return "purchase";
  if (normalized.startsWith("S")) return "sale";
  if (normalized.startsWith("E")) return "exchange";
  return "other";
}

function extractTicker(assetName: string): string | undefined {
  const matches = [...assetName.matchAll(/\(([A-Z][A-Z0-9./-]{0,9})\)/g)];
  return matches.at(-1)?.[1]?.replace(".", "-");
}

function extractAssetType(assetName: string): string | undefined {
  return assetName.match(/\[([A-Z]{1,4})\]\s*$/)?.[1];
}

function stripAssetType(assetName: string): string {
  return assetName.replace(/\s*\[[A-Z]{1,4}\]\s*$/, "").trim();
}

function lineLooksLikeTransactionType(line: string): boolean {
  return /^(P|S|E)(\s*\([^)]+\))?$/i.test(line.trim());
}

function lineLooksLikeDate(line: string): boolean {
  return /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(line.trim());
}

function lineLooksLikeAmount(line: string): boolean {
  return /^\$[\d,]+(?:\.\d{2})?\s*-\s*\$[\d,]+(?:\.\d{2})?$|^Over\s+\$[\d,]+/i.test(line.trim());
}

function isMetadataLine(line: string): boolean {
  return (
    /^Filing ID #/i.test(line) ||
    /^Name:$/i.test(line) ||
    /^Status:$/i.test(line) ||
    /^State\/District:$/i.test(line) ||
    /^ID$/i.test(line) ||
    /^Owner$/i.test(line) ||
    /^Asset$/i.test(line) ||
    /^Transaction$/i.test(line) ||
    /^Type$/i.test(line) ||
    /^Date$/i.test(line) ||
    /^Notification$/i.test(line) ||
    /^Amount$/i.test(line) ||
    /^Cap\.$/i.test(line) ||
    /^Gains >$/i.test(line) ||
    /^\$200\?$/i.test(line) ||
    /^Clerk of the House/i.test(line)
  );
}

function groupPdfRows(items: { str: string; transform: number[] }[]): PdfTextRow[] {
  const rows: PdfTextRow[] = [];
  for (const item of items) {
    const text = cleanPdfText(item.str);
    if (!text) continue;
    const x = Math.round(item.transform[4] ?? 0);
    const y = Math.round(item.transform[5] ?? 0);
    let row = rows.find((candidate) => Math.abs(candidate.y - y) <= 2);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, text });
  }

  return rows
    .map((row) => ({
      y: row.y,
      cells: row.cells.sort((left, right) => left.x - right.x),
    }))
    .sort((left, right) => right.y - left.y);
}

function cellText(row: PdfTextRow, minX: number, maxX: number): string {
  return row.cells
    .filter((cell) => cell.x >= minX && cell.x < maxX)
    .map((cell) => cell.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseHousePtrRows(rows: PdfTextRow[]): ParsedHousePtrTransaction[] {
  const transactions: ParsedHousePtrTransaction[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const transactionLabel = cellText(row, 245, 315);
    const transactionDate = cellText(row, 315, 375);
    const notificationDate = cellText(row, 375, 440);
    const amountRange = cellText(row, 440, 525);

    if (
      !lineLooksLikeTransactionType(transactionLabel) ||
      !lineLooksLikeDate(transactionDate) ||
      !lineLooksLikeAmount(amountRange)
    ) {
      continue;
    }

    const assetParts = [cellText(row, 90, 245)].filter(Boolean);
    for (let nextIndex = index + 1; nextIndex < rows.length; nextIndex += 1) {
      const next = rows[nextIndex];
      if (Math.abs(row.y - next.y) > 45) break;
      if (lineLooksLikeTransactionType(cellText(next, 245, 315))) break;
      const text = cellText(next, 90, 245);
      if (!text) continue;
      if (text.includes(":")) break;
      if (isMetadataLine(text) || lineLooksLikeDate(text) || lineLooksLikeAmount(text)) break;
      assetParts.push(text);
    }

    const rawAssetName = assetParts.join(" ").replace(/\s+/g, " ").trim();
    if (!rawAssetName) continue;
    const assetType = extractAssetType(rawAssetName);
    const assetName = stripAssetType(rawAssetName);
    transactions.push({
      ticker: extractTicker(assetName),
      assetName,
      assetType,
      transactionType: mapTransactionType(transactionLabel),
      transactionLabel,
      amountRange,
      transactionDate: normalizeDate(transactionDate),
      notificationDate: normalizeDate(notificationDate),
    });
  }

  return transactions;
}

async function parseHousePtrTransactionsFromPdf(pdfBytes: Uint8Array): Promise<ParsedHousePtrTransaction[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const document = await pdfjs.getDocument({ data: pdfBytes } as Parameters<typeof pdfjs.getDocument>[0]).promise;
  const transactions: ParsedHousePtrTransaction[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const items = content.items
      .filter((item): item is typeof item & { str: string; transform: number[] } => "str" in item && "transform" in item)
      .map((item) => ({ str: item.str, transform: [...item.transform] }));
    transactions.push(...parseHousePtrRows(groupPdfRows(items)));
  }

  return transactions;
}

export function parseHousePtrTransactionsFromLines(lines: string[]): ParsedHousePtrTransaction[] {
  const transactions: ParsedHousePtrTransaction[] = [];
  let assetLines: string[] = [];
  let lastOwner: string | undefined;
  let inTransactionTable = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = cleanPdfText(lines[index] ?? "");
    if (!line) continue;
    if (/^\$200\?$/i.test(line)) {
      inTransactionTable = true;
      assetLines = [];
      continue;
    }
    if (!inTransactionTable || isMetadataLine(line)) continue;

    if (/^Filing Status:/i.test(line)) continue;
    if (/^Subholding Of:/i.test(line) || /^Location:/i.test(line) || /^Description:/i.test(line)) {
      continue;
    }

    if (lineLooksLikeTransactionType(line)) {
      const transactionDate = cleanPdfText(lines[index + 1] ?? "");
      const notificationDate = cleanPdfText(lines[index + 2] ?? "");
      const amountRange = cleanPdfText(lines[index + 3] ?? "");
      if (!assetLines.length || !lineLooksLikeDate(transactionDate) || !lineLooksLikeAmount(amountRange)) {
        assetLines = [];
        continue;
      }

      const rawAssetName = assetLines.join(" ").replace(/\s+/g, " ").trim();
      const assetType = extractAssetType(rawAssetName);
      const assetName = stripAssetType(rawAssetName);
      transactions.push({
        ticker: extractTicker(assetName),
        assetName,
        assetType,
        owner: lastOwner,
        transactionType: mapTransactionType(line),
        transactionLabel: line,
        amountRange,
        transactionDate: normalizeDate(transactionDate),
        notificationDate: lineLooksLikeDate(notificationDate) ? normalizeDate(notificationDate) : undefined,
      });

      assetLines = [];
      index += 3;
      continue;
    }

    if (/^[A-Z]{2,}$/.test(line) && assetLines.length === 0) {
      lastOwner = line;
      continue;
    }

    assetLines.push(line);
  }

  return transactions;
}

async function fetchHousePtrTransactions(disclosure: CongressTradeDisclosure): Promise<CongressTrade[]> {
  const bytes = await fetchBytes(disclosure.documentUrl);
  const parsed = await parseHousePtrTransactionsFromPdf(bytes);
  return parsed.map((trade) => ({
    memberName: disclosure.memberName,
    chamber: disclosure.chamber,
    state: disclosure.state,
    district: disclosure.district,
    bioguideId: disclosure.bioguideId,
    ticker: trade.ticker,
    assetName: trade.assetName,
    assetType: trade.assetType,
    owner: trade.owner,
    transactionType: trade.transactionType,
    transactionLabel: trade.transactionLabel,
    amountRange: trade.amountRange,
    transactionDate: trade.transactionDate,
    notificationDate: trade.notificationDate,
    filingDate: disclosure.filingDate,
    filingYear: disclosure.year,
    docId: disclosure.docId,
    documentUrl: disclosure.documentUrl,
    filingStatus: trade.filingStatus,
    capitalGainsOver200: trade.capitalGainsOver200,
    source: "house-ptr-pdf",
  }));
}

export async function ingestCongressTradeDisclosures(opts: {
  years: number[];
  members: CongressMember[];
  parseTransactions?: boolean;
}): Promise<CongressTradesIngestResult> {
  const warnings: string[] = [];
  const disclosures: CongressTradeDisclosure[] = [];
  const trades: CongressTrade[] = [];

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

  if (opts.parseTransactions !== false) {
    const pdfLimit = HOUSE_PTR_PDF_LIMIT > 0 ? HOUSE_PTR_PDF_LIMIT : deduped.length;
    for (const disclosure of deduped.slice(0, pdfLimit)) {
      try {
        if (trades.length > 0) await sleep(HOUSE_PTR_PDF_DELAY_MS);
        trades.push(...(await fetchHousePtrTransactions(disclosure)));
      } catch (error) {
        warnings.push(
          `Failed to parse House PTR PDF ${disclosure.docId}: ${error instanceof Error ? error.message : "unknown error"}`,
        );
      }
    }
    if (pdfLimit < deduped.length) {
      warnings.push(
        `Parsed ${pdfLimit}/${deduped.length} House PTR PDFs due to INGEST_HOUSE_PTR_PDF_LIMIT`,
      );
    }
    console.log(`[congress-trades] parsed ${trades.length} transactions from ${pdfLimit} PTR PDFs`);
  }

  return { disclosures: deduped, trades, warnings };
}
