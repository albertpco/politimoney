export const topRoutes = [
  "/",
  "/search",
  "/explore",
  "/explore/senators",
  "/explore/senators/:id",
  "/explore/states",
  "/explore/states/:id",
  "/explore/bills",
  "/explore/bills/:id",
  "/explore/organizations",
  "/explore/organizations/:id",
  "/explore/contracts",
  "/explore/contractors/:name",
  "/explore/countries",
  "/explore/countries/:id",
  "/compare",
  "/compare/senators",
  "/compare/states",
  "/compare/countries",
  "/share",
  "/share/:kind/:id",
  "/influence",
  "/influence/network",
  "/influence/foreign-lobbying",
  "/influence/foreign-connected-pacs",
  "/outcomes",
  "/outcomes/metrics",
  "/outcomes/trends",
  "/briefs",
  "/briefs/:slug",
  "/methodology",
  "/methodology/proof-ladder",
  "/methodology/limitations",
  "/methodology/legal-context",
  "/data-coverage",
  "/data-coverage/sources",
  "/data-coverage/freshness",
  "/data-coverage/changelog",
  "/data-coverage/run-history",
];

export const instrumentationEvents = [
  "claim_opened",
  "source_opened",
  "evidence_trail_completed",
  "time_to_first_entity_answer",
  "time_to_compare_completion",
  "uncertainty_panel_open_rate",
  "non_claims_panel_open_rate",
  "share_brief",
  "export_citation_bundle",
  "compare_view_saved",
] as const;

/** @deprecated — retained only as fallback for state-outcomes.ts when no ingest data exists. */
export const states = [
  { id: "ny", name: "New York", gdp: "", pop: "", childPoverty: "", fertility: "", childMortality: "", suicideRate: "" },
  { id: "ca", name: "California", gdp: "", pop: "", childPoverty: "", fertility: "", childMortality: "", suicideRate: "" },
  { id: "tx", name: "Texas", gdp: "", pop: "", childPoverty: "", fertility: "", childMortality: "", suicideRate: "" },
];

export const briefs = [
  {
    slug: "funding-context-brief",
    title: "Funding Context Brief: How to Read Campaign Finance Data",
    type: "Methodology",
    summary:
      "Explains how FEC filings, PAC receipts, and individual contributions are connected in this dataset.",
  },
  {
    slug: "influence-channels-brief",
    title: "Influence Channels Brief: FARA, Lobbying, and Foreign-Connected PACs",
    type: "Methodology",
    summary:
      "Describes the legal distinction between FARA registrations, LDA lobbying filings, and foreign-connected PAC contributions.",
  },
  {
    slug: "state-outcomes-brief",
    title: "State Outcomes Brief: What the Numbers Cover",
    type: "Outcome",
    summary:
      "Documents the Census and CDC data sources behind state-level poverty, fertility, mortality, and suicide metrics.",
  },
];

export const evidenceLinks = [
  {
    label: "FEC campaign finance data",
    href: "https://www.fec.gov/data/",
  },
  {
    label: "Congress.gov legislative data",
    href: "https://www.congress.gov/",
  },
  {
    label: "FARA foreign agent filings",
    href: "https://efile.fara.gov/",
  },
  {
    label: "Senate lobbying disclosures",
    href: "https://lda.senate.gov/",
  },
];

export const proofLadder = [
  "Documented fact (filing or official record exists)",
  "Verified linkage (entity-to-entity relationship is explicit)",
  "Policy pathway evidence (timed and topical interaction chain)",
  "Outcome alignment (directional movement with contextual controls)",
  "Competing explanation test (alternative causes reviewed)",
];
