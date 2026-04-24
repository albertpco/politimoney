/**
 * Shared MCP tool registration.
 *
 * Called by both the stdio server (local dev / Claude Desktop)
 * and the Streamable HTTP route handler (hosted / remote clients).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getBillsLobbiedRepository,
  getCommitteeRecipientsRepository,
  getContractorProfileRepository,
  getContractsByCompanyRepository,
  getDonorProfileRepository,
  getDonorProfilesRepository,
  getFundingProfileRepository,
  getLatestStateOutcomesRepository,
  getLobbyingByClientRepository,
  getLobbyingClientsRepository,
  getRecentMemberVotePositionsRepository,
  getInsiderTradeSummariesRepository,
  getInsiderTradesByCompanyRepository,
  getLobbyistContributionsForMemberRepository,
  getTopContractorsRepository,
  rankEntitiesRepository,
  searchEntitiesRepository,
} from "@/lib/data/repository";
import {
  readCandidateFinancials,
  readCongressBills,
  readCongressMembers,
  readFecCandidates,
  readFecCommittees,
  readIndependentExpenditures,
  readLaunchSummary,
  readLatestSummary,
  readPacSummaries,
  readCongressTradeDisclosures,
  readPacToCandidate,
  readRecentEfilings,
} from "@/lib/ingest/storage";

function asTextResult(payload: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function normalizeStateCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Register all politired MCP tools on the given server instance.
 *
 * @param server - An McpServer instance (from @modelcontextprotocol/sdk)
 * @param opts.includeIngest - If true, register the run_ingest_pipeline tool
 *   (only appropriate for local/trusted environments, not public HTTP).
 */
export function registerPolitiredTools(
  server: McpServer,
  opts: { includeIngest?: boolean } = {},
) {
  // --- Ingest (local only) ---
  if (opts.includeIngest) {
    server.registerTool(
      "run_ingest_pipeline",
      {
        description:
          "Run a full ingest pipeline pull across FEC, FARA, Congress, and state outcomes.",
      },
      async () => {
        const { runIngestionPipeline } = await import("@/lib/ingest/pipeline");
        const summary = await runIngestionPipeline();
        return asTextResult({ ok: true, summary });
      },
    );
  }

  server.registerTool(
    "get_launch_summary",
    {
      description:
        "Return the latest precomputed launch summary artifact with top members, top committees, and latest vote pointers.",
    },
    async () => {
      const summary = await readLaunchSummary();
      if (!summary) {
        return asTextResult({
          ok: false,
          message: "No launch summary artifact found yet. Run the ingest pipeline first.",
        });
      }
      return asTextResult({ ok: true, summary });
    },
  );

  server.registerTool(
    "get_latest_ingest_summary",
    {
      description: "Return the latest ingestion summary snapshot.",
    },
    async () => {
      const summary = await readLatestSummary();
      if (!summary) {
        return asTextResult({
          ok: false,
          message: "No ingestion snapshot found yet.",
        });
      }
      return asTextResult({ ok: true, summary });
    },
  );

  server.registerTool(
    "get_state_outcome",
    {
      description:
        "Return latest state outcome metrics (population, child poverty, fertility, suicide).",
      inputSchema: z.object({
        stateCode: z
          .string()
          .min(2)
          .max(2)
          .describe("Two-letter US state code, e.g. CA"),
      }),
    },
    async ({ stateCode }) => {
      const normalizedCode = normalizeStateCode(stateCode);
      const outcomes = await getLatestStateOutcomesRepository();
      const outcome = outcomes.find(
        (row) => row.stateCode === normalizedCode,
      );

      if (!outcome) {
        return asTextResult({
          ok: false,
          message: `No state outcome found for '${normalizedCode}'.`,
        });
      }

      return asTextResult({ ok: true, outcome });
    },
  );

  server.registerTool(
    "search_entities",
    {
      description:
        "Search members, candidates, committees, and bills by name, ID, or keyword.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Free-text search query."),
        type: z
          .enum(["member", "candidate", "committee", "bill", "donor"])
          .optional()
          .describe("Optional entity type filter."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(25)
          .optional()
          .describe("Maximum results to return. Default 12."),
      }),
    },
    async ({ query, type, limit }) => {
      const results = await searchEntitiesRepository(query, type, limit);
      return asTextResult({ ok: true, results });
    },
  );

  server.registerTool(
    "get_donor_profile",
    {
      description:
        "Return a donor profile showing aggregate visible contributions and top recipient entities.",
      inputSchema: z.object({
        donorIdOrName: z
          .string()
          .min(1)
          .describe("Derived donor ID slug or donor name."),
      }),
    },
    async ({ donorIdOrName }) => {
      const donor = await getDonorProfileRepository(donorIdOrName);
      if (!donor) {
        return asTextResult({
          ok: false,
          message: `No donor profile found for '${donorIdOrName}'.`,
        });
      }
      return asTextResult({ ok: true, donor });
    },
  );

  server.registerTool(
    "search_donors",
    {
      description:
        "Search named donors by name, employer, or occupation from the derived donor read model.",
      inputSchema: z.object({
        query: z.string().min(1).describe("Free-text donor search query."),
        limit: z.number().int().min(1).max(100).optional().describe("Maximum donors to return. Default 25."),
      }),
    },
    async ({ query, limit = 25 }) => {
      const q = query.trim().toLowerCase();
      const donors = await getDonorProfilesRepository(500);
      const results = donors
        .filter((donor) =>
          donor.donor.toLowerCase().includes(q) ||
          donor.donorEmployer?.toLowerCase().includes(q) ||
          donor.donorOccupation?.toLowerCase().includes(q),
        )
        .slice(0, limit);

      return asTextResult({ ok: true, totalMatching: results.length, donors: results });
    },
  );

  server.registerTool(
    "get_funding_profile",
    {
      description:
        "Return a funding profile for a current member (bioguide ID), FEC candidate, or committee.",
      inputSchema: z.object({
        entityId: z
          .string()
          .min(1)
          .describe("Bioguide ID, FEC candidate ID, or committee ID."),
      }),
    },
    async ({ entityId }) => {
      const profile = await getFundingProfileRepository(entityId);
      if (!profile) {
        return asTextResult({
          ok: false,
          message: `No funding profile found for '${entityId}'.`,
        });
      }
      return asTextResult({ ok: true, profile });
    },
  );

  server.registerTool(
    "rank_entities",
    {
      description:
        "Rank committees, candidates, or members by total receipts. Covers 2024 cycle (bulk) and current 2026 cycle (API) data.",
      inputSchema: z.object({
        type: z.enum(["committee", "candidate", "member"]),
        metric: z
          .literal("total_receipts")
          .optional()
          .describe("Currently only total_receipts is supported."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Maximum rows to return. Default 10."),
      }),
    },
    async ({ type, limit }) => {
      const rankings = await rankEntitiesRepository({ type, limit });
      return asTextResult({ ok: true, rankings });
    },
  );

  server.registerTool(
    "analyze_vote_funding",
    {
      description:
        "Analyze how funding breaks down across a House or Senate roll call vote. Accepts a voteId or billId.",
      inputSchema: z
        .object({
          chamber: z
            .enum(["house", "senate"])
            .optional()
            .describe("Optional chamber selector. Defaults to house."),
          voteId: z
            .string()
            .optional()
            .describe("Vote ID from the roll call dataset."),
          billId: z
            .string()
            .optional()
            .describe("Bill ID in the form 119-HR-1."),
        })
        .refine((value) => Boolean(value.voteId || value.billId), {
          message: "Provide voteId or billId.",
        }),
    },
    async ({ chamber, voteId, billId }) => {
      const analysis =
        chamber === "senate"
          ? await analyzeSenateVoteFundingRepository({ voteId, billId })
          : await analyzeHouseVoteFundingRepository({ voteId, billId });
      if (!analysis) {
        return asTextResult({
          ok: false,
          message: `No ${chamber === "senate" ? "Senate" : "House"} vote funding analysis found for the requested input.`,
        });
      }
      return asTextResult({ ok: true, analysis });
    },
  );

  server.registerTool(
    "get_member_votes",
    {
      description:
        "Return how a specific member of Congress voted on roll call votes. Accepts a bioguide ID.",
      inputSchema: z.object({
        bioguideId: z.string().min(1).describe("Bioguide ID of the member (e.g., C001098 for Ted Cruz)."),
        chamber: z.enum(["house", "senate"]).optional().describe("Filter by chamber. Omit for both."),
        limit: z.number().int().min(1).max(100).optional().describe("Max votes to return. Default 20."),
      }),
    },
    async ({ bioguideId, chamber, limit = 20 }) => {
      const id = bioguideId.trim().toUpperCase();
      const results = (
        await Promise.all([
          chamber !== "senate"
            ? getRecentMemberVotePositionsRepository({ bioguideId: id, chamber: "H", limit })
            : Promise.resolve([]),
          chamber !== "house"
            ? getRecentMemberVotePositionsRepository({ bioguideId: id, chamber: "S", limit })
            : Promise.resolve([]),
        ])
      )
        .flat()
        .map((vote) => ({
          voteId: vote.voteId,
          date: vote.happenedAt,
          question: vote.question,
          result: vote.result,
          voteCast: vote.voteCast,
        }))
        .slice(0, limit);

      return asTextResult({ ok: true, memberBioguideId: id, totalVotes: results.length, votes: results.slice(0, limit) });
    },
  );

  server.registerTool(
    "get_committee_recipients",
    {
      description:
        "Return which candidates a PAC/committee funded, using PAC-to-candidate contribution data (pas2 / Schedule B).",
      inputSchema: z.object({
        committeeId: z.string().min(1).describe("FEC committee ID (e.g., C00000422 for AMA PAC)."),
        limit: z.number().int().min(1).max(100).optional().describe("Max recipients. Default 25."),
      }),
    },
    async ({ committeeId, limit = 25 }) => {
      const id = committeeId.trim().toUpperCase();
      const recipients = await getCommitteeRecipientsRepository(id, limit);
      return asTextResult({ ok: true, committeeId: id, totalRecipients: recipients.length, recipients });
    },
  );

  server.registerTool(
    "get_pac_rankings",
    {
      description:
        "Return all PACs/committees ranked by a financial metric. Use this to answer questions like 'which are the biggest lobbying groups?' or 'rank all PACs by spending'.",
      inputSchema: z.object({
        metric: z.enum(["disbursements", "receipts", "independent_expenditures"]).optional()
          .describe("Metric to rank by. Default: disbursements."),
        limit: z.number().int().min(1).max(500).optional().describe("Max results. Default 50."),
        minAmount: z.number().optional().describe("Minimum amount filter. Default 0."),
      }),
    },
    async ({ metric = "disbursements", limit = 50, minAmount = 0 }) => {
      const pacSummaries = await readPacSummaries();
      const key = metric === "receipts" ? "totalReceipts"
        : metric === "independent_expenditures" ? "independentExpenditures"
        : "totalDisbursements";

      const ranked = pacSummaries
        .filter((pac) => (pac[key] ?? 0) > minAmount)
        .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
        .slice(0, limit)
        .map((pac, index) => ({
          rank: index + 1,
          committeeId: pac.committeeId,
          name: pac.name,
          committeeType: pac.committeeType,
          [key]: pac[key],
          totalReceipts: pac.totalReceipts,
          totalDisbursements: pac.totalDisbursements,
          independentExpenditures: pac.independentExpenditures,
          cashOnHand: pac.cashOnHand,
        }));

      return asTextResult({ ok: true, metric, totalPacs: pacSummaries.length, rankings: ranked });
    },
  );

  server.registerTool(
    "get_candidate_financials",
    {
      description:
        "Return detailed financial data for a candidate (total receipts, individual contributions, PAC contributions, party contributions, disbursements, cash on hand).",
      inputSchema: z.object({
        candidateId: z.string().min(1).describe("FEC candidate ID (e.g., S2TX00312 for Ted Cruz)."),
      }),
    },
    async ({ candidateId }) => {
      const id = candidateId.trim().toUpperCase();
      const financials = await readCandidateFinancials();
      const match = financials.find((cf) => cf.candidateId === id);
      if (!match) return asTextResult({ ok: false, message: `No financials found for ${id}.` });
      return asTextResult({ ok: true, financials: match });
    },
  );

  server.registerTool(
    "compare_states",
    {
      description:
        "Compare outcome metrics (child poverty, suicide rate, fertility, child mortality) across two or more states.",
      inputSchema: z.object({
        stateCodes: z.array(z.string().min(2).max(2)).min(2).max(10)
          .describe("Array of two-letter state codes to compare."),
      }),
    },
    async ({ stateCodes }) => {
      const outcomes = await getLatestStateOutcomesRepository();
      const normalized = stateCodes.map((s) => s.trim().toUpperCase());
      const results = normalized.map((code) => {
        const matches = outcomes.filter((row) => row.stateCode === code);
        return { stateCode: code, outcomes: matches };
      });

      return asTextResult({ ok: true, comparison: results });
    },
  );

  server.registerTool(
    "get_independent_expenditures",
    {
      description:
        "Return independent expenditures (outside spending for/against candidates) by a committee or targeting a candidate.",
      inputSchema: z.object({
        committeeId: z.string().optional().describe("Filter by spending committee ID."),
        candidateId: z.string().optional().describe("Filter by target candidate ID."),
        limit: z.number().int().min(1).max(200).optional().describe("Max results. Default 50."),
      }),
    },
    async ({ committeeId, candidateId, limit = 50 }) => {
      const expenditures = await readIndependentExpenditures();
      let filtered = expenditures;
      if (committeeId) filtered = filtered.filter((e) => e.committeeId === committeeId.toUpperCase());
      if (candidateId) filtered = filtered.filter((e) => e.candidateId === candidateId.toUpperCase());

      const sorted = filtered
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

      return asTextResult({
        ok: true,
        totalMatching: filtered.length,
        totalAmount: filtered.reduce((sum, e) => sum + e.amount, 0),
        expenditures: sorted,
      });
    },
  );

  server.registerTool(
    "export_dataset",
    {
      description:
        "Export a raw dataset as JSON for analysis. Available: candidates, committees, members, bills, pac_summaries, candidate_financials, pac_to_candidate.",
      inputSchema: z.object({
        dataset: z.enum(["candidates", "committees", "members", "bills", "pac_summaries", "candidate_financials", "pac_to_candidate"])
          .describe("Dataset to export."),
        limit: z.number().int().min(1).max(1000).optional().describe("Max rows. Default 100."),
      }),
    },
    async ({ dataset, limit = 100 }) => {
      let data: unknown[];
      switch (dataset) {
        case "candidates": data = await readFecCandidates(); break;
        case "committees": data = await readFecCommittees(); break;
        case "members": data = await readCongressMembers(); break;
        case "bills": data = await readCongressBills(); break;
        case "pac_summaries": data = await readPacSummaries(); break;
        case "candidate_financials": data = await readCandidateFinancials(); break;
        case "pac_to_candidate": data = await readPacToCandidate(); break;
        default: data = [];
      }

      return asTextResult({ ok: true, dataset, totalRows: data.length, rows: data.slice(0, limit) });
    },
  );

  server.registerTool(
    "get_top_contractors",
    {
      description:
        "Return top federal contractors ranked by total obligated contract amount from USASpending.gov. Includes FEC committee crosswalk where available.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional()
          .describe("Max contractors to return. Default 50."),
      }),
    },
    async ({ limit = 50 }) => {
      const contractors = await getTopContractorsRepository(limit);
      if (!contractors.length) {
        return asTextResult({ ok: false, message: "No USASpending contractor data available. Run the USASpending ingest first." });
      }
      return asTextResult({ ok: true, totalContractors: contractors.length, contractors });
    },
  );

  server.registerTool(
    "get_contracts_by_company",
    {
      description:
        "Return federal contract awards for a specific company from USASpending.gov. Also returns the contractor's FEC PAC link if found.",
      inputSchema: z.object({
        companyName: z.string().min(1).describe("Company name to search for (e.g., 'Lockheed Martin', 'Raytheon')."),
        limit: z.number().int().min(1).max(200).optional().describe("Max contracts to return. Default 50."),
      }),
    },
    async ({ companyName, limit = 50 }) => {
      const [contracts, profile] = await Promise.all([
        getContractsByCompanyRepository(companyName, limit),
        getContractorProfileRepository(companyName),
      ]);

      if (!contracts.length && !profile) {
        return asTextResult({
          ok: false,
          message: `No contracts or profile found for '${companyName}'. Run USASpending ingest or try a different name.`,
        });
      }

      return asTextResult({
        ok: true,
        companyName,
        profile: profile ?? undefined,
        totalContracts: contracts.length,
        totalAmount: contracts.reduce((sum, c) => sum + c.awardAmount, 0),
        contracts,
      });
    },
  );

  // --- LDA Lobbying Disclosure tools ---

  server.registerTool(
    "get_lobbying_clients",
    {
      description:
        "Return top lobbying clients ranked by total spending from Senate LDA filings. Shows issue areas, linked FEC committees, and linked government contractors.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(500).optional()
          .describe("Max clients to return. Default 50."),
      }),
    },
    async ({ limit = 50 }) => {
      const clients = await getLobbyingClientsRepository(limit);
      if (!clients.length) {
        return asTextResult({ ok: false, message: "No LDA lobbying data available. Run fetch:lobbying first." });
      }
      return asTextResult({ ok: true, totalClients: clients.length, clients });
    },
  );

  server.registerTool(
    "get_lobbying_by_client",
    {
      description:
        "Return detailed lobbying profile for a specific client: filings, issues lobbied, specific bills, linked PAC donations, and linked government contracts.",
      inputSchema: z.object({
        clientName: z.string().min(1).describe("Client name to search for (e.g., 'Pharmaceutical Research', 'Boeing')."),
      }),
    },
    async ({ clientName }) => {
      const result = await getLobbyingByClientRepository(clientName);
      if (!result) {
        return asTextResult({ ok: false, message: `No lobbying profile found for '${clientName}'.` });
      }
      return asTextResult({ ok: true, ...result });
    },
  );

  server.registerTool(
    "get_lobbyist_contributions",
    {
      description:
        "Return lobbyist political contributions filtered by payee (campaign/PAC name) or honoree (member of Congress name).",
      inputSchema: z.object({
        payee: z.string().optional().describe("Filter by payee name (campaign/PAC)."),
        honoree: z.string().optional().describe("Filter by honoree name (member of Congress)."),
        limit: z.number().int().min(1).max(200).optional().describe("Max results. Default 50."),
      }),
    },
    async ({ payee, honoree, limit = 50 }) => {
      const searchTerm = honoree ?? payee ?? "";
      if (!searchTerm) {
        return asTextResult({ ok: false, message: "Provide either payee or honoree to filter." });
      }
      const contributions = await getLobbyistContributionsForMemberRepository(searchTerm, limit);
      return asTextResult({
        ok: true,
        searchTerm,
        totalMatching: contributions.length,
        totalAmount: contributions.reduce((sum, c) => sum + c.amount, 0),
        contributions,
      });
    },
  );

  server.registerTool(
    "get_bills_lobbied",
    {
      description:
        "Return which bills had the most lobbying activity, ranked by number of filings mentioning the bill.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional().describe("Max results. Default 50."),
      }),
    },
    async ({ limit = 50 }) => {
      const bills = await getBillsLobbiedRepository(limit);
      if (!bills.length) {
        return asTextResult({ ok: false, message: "No lobbying filing data available. Run fetch:lobbying first." });
      }
      return asTextResult({ ok: true, totalBills: bills.length, bills });
    },
  );

  server.registerTool(
    "get_recent_contributions",
    {
      description:
        "Return recent FEC eFiling contributions (real-time, within minutes of filing). Filter by committee, donor name, state, or date range. Run fetch:efilings first to populate data.",
      inputSchema: z.object({
        committeeId: z.string().optional().describe("Filter by committee ID (e.g., C00000935)."),
        donorName: z.string().optional().describe("Substring match on donor name (case-insensitive)."),
        state: z.string().min(2).max(2).optional().describe("Two-letter state code filter."),
        daysBack: z.number().int().min(1).max(90).optional().describe("Only show contributions from the last N days. Default: all loaded data."),
        minAmount: z.number().optional().describe("Minimum contribution amount filter."),
        limit: z.number().int().min(1).max(500).optional().describe("Max results. Default 50."),
      }),
    },
    async ({ committeeId, donorName, state, daysBack, minAmount, limit = 50 }) => {
      const efilings = await readRecentEfilings();
      if (!efilings.length) {
        return asTextResult({
          ok: false,
          message: "No eFiling data available. Run `npm run fetch:efilings` first.",
        });
      }

      let filtered = efilings;
      if (committeeId) filtered = filtered.filter((e) => e.committeeId === committeeId.toUpperCase());
      if (donorName) {
        const q = donorName.toLowerCase();
        filtered = filtered.filter((e) => e.donorName.toLowerCase().includes(q));
      }
      if (state) filtered = filtered.filter((e) => e.state === state.toUpperCase());
      if (minAmount) filtered = filtered.filter((e) => e.amount >= minAmount);
      if (daysBack) {
        const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        filtered = filtered.filter((e) => (e.contributionDate ?? "") >= cutoff);
      }

      const sorted = filtered
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit);

      return asTextResult({
        ok: true,
        totalMatching: filtered.length,
        totalAmount: filtered.reduce((sum, e) => sum + e.amount, 0),
        contributions: sorted,
      });
    },
  );

  // --- SEC EDGAR insider trading tools ---

  server.registerTool(
    "get_insider_trades",
    {
      description:
        "Return recent SEC Form 4 insider trades filtered by ticker or company name. Shows purchases, sales, and exercise transactions by corporate insiders (officers, directors).",
      inputSchema: z.object({
        ticker: z.string().optional().describe("Stock ticker symbol (e.g., AAPL, MSFT)."),
        companyName: z.string().optional().describe("Company name to search for (e.g., 'Lockheed Martin')."),
        limit: z.number().int().min(1).max(200).optional().describe("Max trades to return. Default 50."),
      }),
    },
    async ({ ticker, companyName, limit = 50 }) => {
      const search = ticker ?? companyName;
      if (!search) {
        return asTextResult({ ok: false, message: "Provide ticker or companyName." });
      }
      const result = await getInsiderTradesByCompanyRepository(search, limit);
      if (!result.trades.length) {
        return asTextResult({
          ok: false,
          message: `No insider trades found for '${search}'. Run fetch:insider-trades first.`,
        });
      }
      return asTextResult({
        ok: true,
        ticker: search,
        summary: result.summary,
        totalTrades: result.trades.length,
        trades: result.trades,
      });
    },
  );

  server.registerTool(
    "get_insider_trade_rankings",
    {
      description:
        "Return companies ranked by net insider buying or selling (absolute value). Flags companies that also have FEC PACs or are government contractors.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).optional().describe("Max companies to return. Default 50."),
      }),
    },
    async ({ limit = 50 }) => {
      const summaries = await getInsiderTradeSummariesRepository(limit);
      if (!summaries.length) {
        return asTextResult({
          ok: false,
          message: "No insider trade data available. Run fetch:insider-trades first.",
        });
      }
      return asTextResult({
        ok: true,
        totalCompanies: summaries.length,
        rankings: summaries.map((s, i) => ({
          rank: i + 1,
          ticker: s.ticker,
          companyName: s.companyName,
          netValue: s.netValue,
          buyValue: s.buyValue,
          sellValue: s.sellValue,
          tradeCount: s.tradeCount,
          hasFecPac: !!s.fecCommitteeId,
          fecCommitteeName: s.fecCommitteeName,
          isGovernmentContractor: !!s.contractorName,
          contractorName: s.contractorName,
        })),
      });
    },
  );

  // --- Congress STOCK Act trade disclosures ---

  server.registerTool(
    "get_congress_trade_disclosures",
    {
      description:
        "Return House member STOCK Act periodic transaction report filings. Shows who filed stock trade disclosures, when, and links to the original PDFs. Filter by member name, state, or year.",
      inputSchema: z.object({
        memberName: z.string().optional().describe("Substring match on member name (case-insensitive)."),
        state: z.string().min(2).max(2).optional().describe("Two-letter state code filter."),
        year: z.number().int().optional().describe("Filter by filing year (e.g., 2024)."),
        limit: z.number().int().min(1).max(500).optional().describe("Max results. Default 50."),
      }),
    },
    async ({ memberName, state, year, limit = 50 }) => {
      const disclosures = await readCongressTradeDisclosures();
      if (!disclosures.length) {
        return asTextResult({
          ok: false,
          message: "No congress trade disclosure data available. Run the ingest pipeline first.",
        });
      }

      let filtered = disclosures;
      if (memberName) {
        const q = memberName.toLowerCase();
        filtered = filtered.filter((d) => d.memberName.toLowerCase().includes(q));
      }
      if (state) filtered = filtered.filter((d) => d.state === state.toUpperCase());
      if (year) filtered = filtered.filter((d) => d.year === year);

      // Sort by filing date descending
      const sorted = filtered
        .sort((a, b) => (b.filingDate ?? "").localeCompare(a.filingDate ?? ""))
        .slice(0, limit);

      // Build member summary
      const byMember = new Map<string, number>();
      for (const d of filtered) {
        byMember.set(d.memberName, (byMember.get(d.memberName) ?? 0) + 1);
      }
      const topFilers = [...byMember.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, filingCount: count }));

      return asTextResult({
        ok: true,
        totalMatching: filtered.length,
        uniqueMembers: byMember.size,
        topFilers,
        disclosures: sorted,
      });
    },
  );
}
