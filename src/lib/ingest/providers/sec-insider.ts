import { fetchJson, fetchText } from "@/lib/ingest/http";
import type {
  FecCommittee,
  InsiderTrade,
  InsiderTradeSummary,
  InsiderTransactionType,
  ContractorProfile,
} from "@/lib/ingest/types";

const SEC_USER_AGENT = "politimoney/0.1 albpcohen@gmail.com";

const SEC_HEADERS: Record<string, string> = {
  "User-Agent": SEC_USER_AGENT,
};

/** 100ms between requests → stays under SEC's 10 req/sec limit. */
function delay(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// SEC EDGAR search: resolve company name → CIK
// ---------------------------------------------------------------------------

type EdgarCompanyMatch = {
  cik: string;
  companyName: string;
  ticker: string;
};

type EdgarSearchHit = {
  _source: {
    entity_name?: string;
    tickers?: string;
    entity_id?: string;
  };
};

type EdgarSearchResponse = {
  hits?: {
    hits?: EdgarSearchHit[];
  };
};

async function searchCompanyByName(
  name: string,
): Promise<EdgarCompanyMatch | null> {
  const endYear = new Date().getUTCFullYear();
  const startYear = endYear - 1;
  const url = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(name)}&dateRange=custom&startdt=${startYear}-01-01&enddt=${endYear}-12-31&forms=4`;
  try {
    const data = await fetchJson<EdgarSearchResponse>(url, {
      headers: SEC_HEADERS,
    });
    const hit = data.hits?.hits?.[0];
    if (!hit?._source?.entity_id) return null;
    const cik = hit._source.entity_id.replace(/^0+/, "");
    const ticker = (hit._source.tickers ?? "").split(",")[0]?.trim() ?? "";
    return {
      cik,
      companyName: hit._source.entity_name ?? name,
      ticker: ticker || name.slice(0, 8).toUpperCase(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SEC EDGAR company submissions: list recent Form 4 filings
// ---------------------------------------------------------------------------

type EdgarSubmissionFiling = {
  accessionNumber: string[];
  form: string[];
  filingDate: string[];
  primaryDocument: string[];
};

type EdgarSubmissionsResponse = {
  cik: number;
  name: string;
  tickers?: string[];
  filings: {
    recent: EdgarSubmissionFiling;
  };
};

type Form4FilingRef = {
  accessionNumber: string;
  filingDate: string;
  primaryDocument: string;
};

const DEFAULT_MARKET_CIKS: EdgarCompanyMatch[] = [
  { ticker: "NVDA", cik: "1045810", companyName: "NVIDIA CORP" },
  { ticker: "AAPL", cik: "320193", companyName: "APPLE INC" },
  { ticker: "MSFT", cik: "789019", companyName: "MICROSOFT CORP" },
  { ticker: "GOOGL", cik: "1652044", companyName: "ALPHABET INC" },
  { ticker: "AMZN", cik: "1018724", companyName: "AMAZON COM INC" },
  { ticker: "META", cik: "1326801", companyName: "META PLATFORMS INC" },
  { ticker: "TSLA", cik: "1318605", companyName: "TESLA INC" },
  { ticker: "PLTR", cik: "1321655", companyName: "PALANTIR TECHNOLOGIES INC" },
  { ticker: "LMT", cik: "936468", companyName: "LOCKHEED MARTIN CORP" },
  { ticker: "RTX", cik: "101829", companyName: "RTX CORP" },
  { ticker: "NOC", cik: "1133421", companyName: "NORTHROP GRUMMAN CORP" },
  { ticker: "GD", cik: "40533", companyName: "GENERAL DYNAMICS CORP" },
  { ticker: "BA", cik: "12927", companyName: "BOEING CO" },
  { ticker: "UNH", cik: "731766", companyName: "UNITEDHEALTH GROUP INC" },
  { ticker: "LLY", cik: "59478", companyName: "ELI LILLY AND CO" },
];

async function fetchRecentForm4Refs(
  cik: string,
  limit = 20,
): Promise<{ refs: Form4FilingRef[]; companyName: string; ticker: string }> {
  const paddedCik = cik.padStart(10, "0");
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;
  const data = await fetchJson<EdgarSubmissionsResponse>(url, {
    headers: SEC_HEADERS,
  });

  const recent = data.filings.recent;
  const refs: Form4FilingRef[] = [];

  for (let i = 0; i < recent.form.length && refs.length < limit; i++) {
    if (recent.form[i] === "4") {
      refs.push({
        accessionNumber: recent.accessionNumber[i],
        filingDate: recent.filingDate[i],
        primaryDocument: recent.primaryDocument[i],
      });
    }
  }

  return {
    refs,
    companyName: data.name,
    ticker: data.tickers?.[0] ?? "",
  };
}

// ---------------------------------------------------------------------------
// Form 4 XML parsing
// ---------------------------------------------------------------------------

function xmlText(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const match = re.exec(xml);
  return match?.[1]?.trim() ?? "";
}

function xmlBool(xml: string, tag: string): boolean {
  const value = xmlText(xml, tag);
  return value === "1" || value.toLowerCase() === "true";
}

const KNOWN_TRANSACTION_CODES: ReadonlySet<InsiderTransactionType> = new Set([
  "P",
  "S",
  "S-OE",
  "M",
  "A",
  "D",
  "F",
  "G",
  "I",
  "J",
  "X",
  "C",
  "V",
  "OE",
]);

const ACQUIRE_CODES: ReadonlySet<InsiderTransactionType> = new Set([
  "P",
  "A",
  "M",
]);

const DISPOSE_CODES: ReadonlySet<InsiderTransactionType> = new Set([
  "S",
  "S-OE",
  "D",
  "F",
]);

function parseTransactionCode(code: string): InsiderTransactionType {
  const upper = code.toUpperCase();
  if (KNOWN_TRANSACTION_CODES.has(upper as InsiderTransactionType)) {
    return upper as InsiderTransactionType;
  }
  return "OTHER";
}

function nestedValue(xml: string, tag: string): string {
  const block = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"))?.[1];
  if (!block) return "";
  return xmlText(block, "value");
}

function signedShares(
  shares: number,
  type: InsiderTransactionType,
): number | null {
  if (ACQUIRE_CODES.has(type)) return shares;
  if (DISPOSE_CODES.has(type)) return -shares;
  return null;
}

function computeOwnershipDelta(
  signed: number | null,
  ownedAfter: number | undefined,
): number | undefined {
  if (signed === null) return undefined;
  if (ownedAfter === undefined) return undefined;
  const before = ownedAfter - signed;
  if (!Number.isFinite(before) || before === 0) return undefined;
  return Math.round((signed / before) * 10000) / 100;
}

function parseTransactionBlock(
  txn: string,
  isDerivative: boolean,
  context: {
    issuerCik: string;
    issuerName: string;
    issuerTicker: string;
    ownerName: string;
    ownerCik: string;
    isDirector: boolean;
    isOfficer: boolean;
    isTenPercentOwner: boolean;
    isOther: boolean;
    officerTitle: string;
    filingDate: string;
  },
): InsiderTrade | null {
  const transactionDate = nestedValue(txn, "transactionDate");
  const code = xmlText(
    txn.match(/<transactionCoding>([\s\S]*?)<\/transactionCoding>/i)?.[1] ?? "",
    "transactionCode",
  );

  const amountsBlock =
    txn.match(/<transactionAmounts>([\s\S]*?)<\/transactionAmounts>/i)?.[1] ??
    "";
  const sharesStr = nestedValue(amountsBlock, "transactionShares");
  const priceStr = nestedValue(amountsBlock, "transactionPricePerShare");

  const shares = Number.parseFloat(sharesStr) || 0;
  const pricePerShare = Number.parseFloat(priceStr) || 0;

  if (!code || shares === 0) return null;

  const postBlock =
    txn.match(/<postTransactionAmounts>([\s\S]*?)<\/postTransactionAmounts>/i)?.[1] ??
    "";
  const ownedAfterStr = nestedValue(
    postBlock,
    "sharesOwnedFollowingTransaction",
  );
  const ownedAfterParsed = Number.parseFloat(ownedAfterStr);
  const sharesOwnedAfter = Number.isFinite(ownedAfterParsed)
    ? ownedAfterParsed
    : undefined;

  const ownershipBlock =
    txn.match(/<ownershipNature>([\s\S]*?)<\/ownershipNature>/i)?.[1] ?? "";
  const directOrIndirectRaw = nestedValue(
    ownershipBlock,
    "directOrIndirectOwnership",
  ).toUpperCase();
  const directOrIndirect: InsiderTrade["directOrIndirect"] =
    directOrIndirectRaw === "D" || directOrIndirectRaw === "I"
      ? directOrIndirectRaw
      : undefined;

  const transactionType = parseTransactionCode(code);
  const signed = signedShares(shares, transactionType);
  const ownershipDelta = computeOwnershipDelta(signed, sharesOwnedAfter);

  const officerTitle = context.officerTitle;
  const isCeo = /\b(CEO|chief executive)\b/i.test(officerTitle);
  const isCfo = /\b(CFO|chief financial)\b/i.test(officerTitle);

  const trade: InsiderTrade = {
    cik: context.issuerCik,
    ticker: context.issuerTicker || "N/A",
    companyName: context.issuerName || "Unknown",
    insiderName: context.ownerName || "Unknown",
    insiderCik: context.ownerCik,
    insiderTitle: officerTitle || undefined,
    isDirector: context.isDirector,
    isOfficer: context.isOfficer,
    isTenPercentOwner: context.isTenPercentOwner,
    isOther: context.isOther,
    isCeo,
    isCfo,
    isDerivative,
    transactionType,
    shares,
    pricePerShare,
    totalValue: Math.round(shares * pricePerShare * 100) / 100,
    transactionDate: transactionDate || context.filingDate,
    filingDate: context.filingDate,
    sharesOwnedAfter,
    ownershipDelta,
    directOrIndirect,
  };

  if (isDerivative) {
    const underlyingBlock =
      txn.match(/<underlyingSecurity>([\s\S]*?)<\/underlyingSecurity>/i)?.[1] ??
      "";
    const underlyingTitle = nestedValue(
      underlyingBlock,
      "underlyingSecurityTitle",
    );
    const underlyingSharesStr = nestedValue(
      underlyingBlock,
      "underlyingSecurityShares",
    );
    const underlyingShares = Number.parseFloat(underlyingSharesStr);
    const exerciseDate = nestedValue(txn, "exerciseDate");
    const expirationDate = nestedValue(txn, "expirationDate");

    if (underlyingTitle) trade.derivativeUnderlyingTitle = underlyingTitle;
    if (Number.isFinite(underlyingShares))
      trade.derivativeUnderlyingShares = underlyingShares;
    if (exerciseDate) trade.derivativeExerciseDate = exerciseDate;
    if (expirationDate) trade.derivativeExpirationDate = expirationDate;
  }

  return trade;
}

function parseForm4Xml(
  xml: string,
  filingDate: string,
  companyCik: string,
): InsiderTrade[] {
  const trades: InsiderTrade[] = [];

  const issuerName = xmlText(xml, "issuerName");
  const issuerTicker = xmlText(xml, "issuerTradingSymbol");
  const issuerCik = xmlText(xml, "issuerCik") || companyCik;
  const ownerName = xmlText(xml, "rptOwnerName");

  const ownerIdBlock =
    xml.match(/<reportingOwnerId>([\s\S]*?)<\/reportingOwnerId>/i)?.[1] ?? "";
  const ownerCik = xmlText(ownerIdBlock, "rptOwnerCik").replace(/^0+/, "");

  const relBlock =
    xml.match(
      /<reportingOwnerRelationship>([\s\S]*?)<\/reportingOwnerRelationship>/i,
    )?.[1] ?? "";
  const isDirector = xmlBool(relBlock, "isDirector");
  const isOfficer = xmlBool(relBlock, "isOfficer");
  const isTenPercentOwner = xmlBool(relBlock, "isTenPercentOwner");
  const isOther = xmlBool(relBlock, "isOther");
  const officerTitle = xmlText(relBlock, "officerTitle");

  const context = {
    issuerCik,
    issuerName,
    issuerTicker,
    ownerName,
    ownerCik,
    isDirector,
    isOfficer,
    isTenPercentOwner,
    isOther,
    officerTitle,
    filingDate,
  };

  const nonDerivMatches = xml.matchAll(
    /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi,
  );
  for (const m of nonDerivMatches) {
    const trade = parseTransactionBlock(m[1], false, context);
    if (trade) trades.push(trade);
  }

  const derivMatches = xml.matchAll(
    /<derivativeTransaction>([\s\S]*?)<\/derivativeTransaction>/gi,
  );
  for (const m of derivMatches) {
    const trade = parseTransactionBlock(m[1], true, context);
    if (trade) trades.push(trade);
  }

  return trades;
}

// ---------------------------------------------------------------------------
// Fetch and parse Form 4 filings for a single company
// ---------------------------------------------------------------------------

async function fetchForm4Trades(
  cik: string,
  filingLimit = 10,
): Promise<{ trades: InsiderTrade[]; warnings: string[] }> {
  const warnings: string[] = [];
  const trades: InsiderTrade[] = [];

  let refs: Form4FilingRef[];
  let companyName: string;
  let ticker: string;
  try {
    const result = await fetchRecentForm4Refs(cik, filingLimit);
    refs = result.refs;
    companyName = result.companyName;
    ticker = result.ticker;
  } catch (error) {
    warnings.push(
      `Failed to fetch Form 4 refs for CIK ${cik}: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { trades, warnings };
  }

  for (const ref of refs) {
    await delay();
    try {
      const accessionNoDashes = ref.accessionNumber.replace(/-/g, "");
      const primaryDocument = ref.primaryDocument.split("/").pop() ?? ref.primaryDocument;
      const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}/${primaryDocument}`;
      const xml = await fetchText(url, { headers: SEC_HEADERS });
      const parsed = parseForm4Xml(xml, ref.filingDate, cik);

      // Ensure ticker/company are populated from the submissions API if the XML was sparse
      for (const trade of parsed) {
        if (!trade.ticker || trade.ticker === "N/A") trade.ticker = ticker;
        if (!trade.companyName || trade.companyName === "Unknown")
          trade.companyName = companyName;
      }

      trades.push(...parsed);
    } catch (error) {
      warnings.push(
        `Failed to parse Form 4 (${ref.accessionNumber}): ${error instanceof Error ? error.message : "unknown"}`,
      );
    }
  }

  return { trades, warnings };
}

// ---------------------------------------------------------------------------
// Company name normalization (shared with USASpending crosswalk)
// ---------------------------------------------------------------------------

function normalizeCompanyName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[.,\-'"()]/g, " ")
    .replace(
      /\b(CORP|CORPORATION|INC|INCORPORATED|LLC|LLP|CO|COMPANY|LTD|LIMITED|GROUP|HOLDINGS|ENTERPRISES|LP|NA|N A|PAC|POLITICAL ACTION COMMITTEE)\b/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// Build summaries from trades
// ---------------------------------------------------------------------------

function buildInsiderTradeSummaries(
  trades: InsiderTrade[],
  committees: FecCommittee[],
  contractors: ContractorProfile[],
): InsiderTradeSummary[] {
  // Group trades by ticker
  const byTicker = new Map<string, InsiderTrade[]>();
  for (const trade of trades) {
    const key = trade.ticker.toUpperCase();
    const existing = byTicker.get(key) ?? [];
    existing.push(trade);
    byTicker.set(key, existing);
  }

  // Build crosswalk: normalized company name → FEC committee
  const orgIndex = new Map<string, FecCommittee>();
  for (const committee of committees) {
    if (!committee.connectedOrgName) continue;
    const normalized = normalizeCompanyName(committee.connectedOrgName);
    if (normalized) orgIndex.set(normalized, committee);
  }

  // Build crosswalk: normalized company name → USASpending contractor
  const contractorIndex = new Map<string, ContractorProfile>();
  for (const contractor of contractors) {
    const normalized = normalizeCompanyName(contractor.recipientName);
    if (normalized) contractorIndex.set(normalized, contractor);
  }

  const summaries: InsiderTradeSummary[] = [];

  for (const [ticker, tickerTrades] of byTicker) {
    const companyName = tickerTrades[0]?.companyName ?? ticker;
    const cik = tickerTrades[0]?.cik ?? "";
    const normalizedName = normalizeCompanyName(companyName);

    let totalBuys = 0;
    let totalSells = 0;
    let buyValue = 0;
    let sellValue = 0;
    let acquiredValue = 0;
    let derivativeTradeCount = 0;

    for (const trade of tickerTrades) {
      if (trade.isDerivative) derivativeTradeCount++;
      if (trade.transactionType === "P") {
        totalBuys++;
        buyValue += trade.totalValue;
        acquiredValue += trade.totalValue;
      } else if (
        trade.transactionType === "S" ||
        trade.transactionType === "S-OE"
      ) {
        totalSells++;
        sellValue += trade.totalValue;
      } else if (trade.transactionType === "A") {
        acquiredValue += trade.totalValue;
      }
    }

    // Find FEC committee match
    const fecMatch =
      orgIndex.get(normalizedName) ??
      [...orgIndex.entries()].find(
        ([orgNorm]) =>
          (normalizedName.length >= 5 && orgNorm.includes(normalizedName)) ||
          (orgNorm.length >= 5 && normalizedName.includes(orgNorm)),
      )?.[1];

    // Find contractor match
    const contractorMatch =
      contractorIndex.get(normalizedName) ??
      [...contractorIndex.entries()].find(
        ([contNorm]) =>
          (normalizedName.length >= 5 &&
            contNorm.includes(normalizedName)) ||
          (contNorm.length >= 5 && normalizedName.includes(contNorm)),
      )?.[1];

    const recentTrades = tickerTrades
      .sort(
        (a, b) =>
          new Date(b.transactionDate).getTime() -
          new Date(a.transactionDate).getTime(),
      )
      .slice(0, 10);

    summaries.push({
      ticker,
      companyName,
      cik,
      totalBuys,
      totalSells,
      buyValue: Math.round(buyValue * 100) / 100,
      sellValue: Math.round(sellValue * 100) / 100,
      acquiredValue: Math.round(acquiredValue * 100) / 100,
      netValue: Math.round((buyValue - sellValue) * 100) / 100,
      tradeCount: tickerTrades.length,
      derivativeTradeCount,
      recentTrades,
      fecCommitteeId: fecMatch?.committeeId,
      fecCommitteeName: fecMatch?.name,
      contractorName: contractorMatch?.recipientName,
    });
  }

  return summaries.sort(
    (a, b) => Math.abs(b.netValue) - Math.abs(a.netValue),
  );
}

// ---------------------------------------------------------------------------
// Top insider-buying companies (signals conviction)
// ---------------------------------------------------------------------------

async function fetchTopInsiderBuyers(
  limit = 50,
): Promise<{ trades: InsiderTrade[]; warnings: string[] }> {
  const warnings: string[] = [];
  const allTrades: InsiderTrade[] = [];

  // Search for recent Form 4 filings with purchase transactions
  const endYear = new Date().getUTCFullYear();
  const startYear = endYear - 1;
  const searchUrl = `https://efts.sec.gov/LATEST/search-index?q=%22transactionCode%22+%22P%22&forms=4&dateRange=custom&startdt=${startYear}-01-01&enddt=${endYear}-12-31`;
  let ciks: string[] = [];

  try {
    const data = await fetchJson<EdgarSearchResponse>(searchUrl, {
      headers: SEC_HEADERS,
    });
    const hits = data.hits?.hits ?? [];
    const cikSet = new Set<string>();
    for (const hit of hits) {
      const entityId = hit._source?.entity_id;
      if (entityId) cikSet.add(entityId.replace(/^0+/, ""));
    }
    ciks = [...cikSet].slice(0, limit);
  } catch (error) {
    warnings.push(
      `Failed to search for top insider buyers: ${error instanceof Error ? error.message : "unknown"}`,
    );
    return { trades: allTrades, warnings };
  }

  for (const cik of ciks) {
    await delay();
    const result = await fetchForm4Trades(cik, 5);
    allTrades.push(...result.trades);
    warnings.push(...result.warnings);
  }

  return { trades: allTrades, warnings };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export type SecInsiderIngestResult = {
  trades: InsiderTrade[];
  summaries: InsiderTradeSummary[];
  warnings: string[];
};

export async function ingestSecInsiderData({
  committees = [],
  contractors = [],
  maxCompanies = 30,
  filingsPerCompany = 10,
  includeTopBuyers = true,
}: {
  committees?: FecCommittee[];
  contractors?: ContractorProfile[];
  maxCompanies?: number;
  filingsPerCompany?: number;
  includeTopBuyers?: boolean;
} = {}): Promise<SecInsiderIngestResult> {
  const warnings: string[] = [];
  const allTrades: InsiderTrade[] = [];

  // Step 1: Extract unique connectedOrgNames from FEC committees
  const orgNames = new Set<string>();
  for (const committee of committees) {
    if (committee.connectedOrgName?.trim()) {
      orgNames.add(committee.connectedOrgName.trim());
    }
  }

  console.log(
    `[sec-insider] Found ${orgNames.size} unique connected org names from FEC committees`,
  );

  // Step 2: Resolve org names to SEC CIK numbers
  const resolvedCompanies: EdgarCompanyMatch[] = [];
  const orgList = [...orgNames].slice(0, maxCompanies);

  for (const orgName of orgList) {
    await delay();
    const match = await searchCompanyByName(orgName);
    if (match) {
      resolvedCompanies.push(match);
    }
  }

  console.log(
    `[sec-insider] Resolved ${resolvedCompanies.length}/${orgList.length} companies to SEC CIKs`,
  );

  // Step 3: Fetch Form 4 filings for each matched company
  const companyTargets = [...resolvedCompanies];
  for (const company of DEFAULT_MARKET_CIKS) {
    if (!companyTargets.some((target) => target.cik === company.cik)) {
      companyTargets.push(company);
    }
  }

  for (const company of companyTargets.slice(0, Math.max(maxCompanies, DEFAULT_MARKET_CIKS.length))) {
    await delay();
    const result = await fetchForm4Trades(company.cik, filingsPerCompany);
    allTrades.push(...result.trades);
    warnings.push(...result.warnings);
  }

  console.log(
    `[sec-insider] Fetched ${allTrades.length} insider trades from FEC-matched companies`,
  );

  // Step 4: Optionally fetch top insider buyers for broader coverage
  if (includeTopBuyers) {
    const topResult = await fetchTopInsiderBuyers(50);
    // Deduplicate by cik+date+insiderName
    const existingKeys = new Set(
      allTrades.map(
        (t) => `${t.cik}|${t.transactionDate}|${t.insiderName}`,
      ),
    );
    for (const trade of topResult.trades) {
      const key = `${trade.cik}|${trade.transactionDate}|${trade.insiderName}`;
      if (!existingKeys.has(key)) {
        allTrades.push(trade);
        existingKeys.add(key);
      }
    }
    warnings.push(...topResult.warnings);
    console.log(
      `[sec-insider] Total trades after top-buyer scan: ${allTrades.length}`,
    );
  }

  // Step 5: Build summaries with FEC/contractor crosswalk
  const summaries = buildInsiderTradeSummaries(
    allTrades,
    committees,
    contractors,
  );

  const fecLinked = summaries.filter((s) => s.fecCommitteeId).length;
  const contractorLinked = summaries.filter((s) => s.contractorName).length;
  console.log(
    `[sec-insider] ${summaries.length} company summaries: ${fecLinked} FEC-linked, ${contractorLinked} contractor-linked`,
  );

  return { trades: allTrades, summaries, warnings };
}
