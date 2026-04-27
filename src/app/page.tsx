import Link from "next/link";
import {
  ClaimCard,
  SectionCard,
  StateValueMap,
  TableExplorer,
  UtilityRail,
  VoteBreakdownBar,
} from "@/components/ui-primitives";
import { buildVoteSegments } from "@/lib/vote-segments";
import {
  CompactRanking,
  AiHandoffPanel,
  FactCheckPanel,
  QueryHero,
  SignalTile,
  WorkflowCard,
} from "@/components/politired-surfaces";
import { RecentReceiptsTicker } from "@/components/recent-receipts-ticker";
import {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getHouseVoteCountRepository,
  getLatestRunSummaryRepository,
  getSenateVoteCountRepository,
  getLatestStateOutcomesRepository,
  rankEntitiesRepository,
} from "@/lib/data/repository";
import {
  getLatestHouseVotesRepository,
  getLatestSenateVotesRepository,
} from "@/lib/data/vote-repository";
import { readLaunchSummary } from "@/lib/ingest/storage";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";

export const revalidate = 3600;

function toProperCase(name: string): string {
  if (!name) return name;
  const titleCase = (s: string) =>
    s.replace(/\b\w+/g, (w) => {
      if (w.length <= 2 && w === w.toUpperCase()) return w;
      return w[0].toUpperCase() + w.slice(1).toLowerCase();
    });
  if (name.includes(",")) {
    const [last, ...rest] = name.split(",");
    return titleCase(`${rest.join(",").trim()} ${last.trim()}`).trim();
  }
  return titleCase(name);
}

function formatCompactNumber(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: value >= 1_000_000 ? 1 : 0,
  }).format(value);
}

function formatMoney(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildLlmHandoffPrompt(): string {
  return [
    "I am using Politired, an open public-record intelligence tool for American government.",
    "Help me inspect the evidence without assuming motive or causality.",
    "Start with these questions:",
    "1. Who funds the official, committee, bill, or vote group I am looking at?",
    "2. Which records support the claim, and what source links should I verify?",
    "3. What does the data show, and what does it not prove?",
    "4. What comparison or ranking should I run next to avoid cherry-picking?",
  ].join("\n");
}

function summaryNumber(
  totals: unknown,
  key: string,
): number {
  if (!totals || typeof totals !== "object" || Array.isArray(totals)) return 0;
  const value = (totals as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export default async function Home() {
  const [launchSummary, latestSummary, houseVoteCount, senateVoteCount, stateOutcomes] = await Promise.all([
    readLaunchSummary(),
    getLatestRunSummaryRepository(),
    getHouseVoteCountRepository(),
    getSenateVoteCountRepository(),
    getLatestStateOutcomesRepository(),
  ]);

  const canRunDeepHomepageQueries = true;
  const [fallbackTopMembers, fallbackTopCommittees] = launchSummary
    ? [null, null]
    : await Promise.all([
        rankEntitiesRepository({ type: "member", limit: 5 }),
        rankEntitiesRepository({ type: "committee", limit: 5 }),
      ]);

  const topMembers =
    launchSummary?.topMembers.map((member, index) => ({
      rank: index + 1,
      id: member.id,
      label: member.label,
      totalReceipts: member.amount,
    })) ?? fallbackTopMembers ?? [];
  const topCommittees =
    launchSummary?.topCommittees.map((committee, index) => ({
      rank: index + 1,
      id: committee.id,
      label: committee.label,
      totalReceipts: committee.amount,
    })) ?? fallbackTopCommittees ?? [];
  // Fallback: compute vote analysis on the fly when launch summary is absent
  let latestHouseAnalysis = launchSummary?.latestHouseAnalysis ?? null;
  let latestSenateAnalysis = launchSummary?.latestSenateAnalysis ?? null;
  let latestHouseVote = launchSummary?.latestHouseVote;
  let latestSenateVote = launchSummary?.latestSenateVote;

  if (!latestHouseAnalysis || !latestSenateAnalysis) {
    const [houseVotes, senateVotes] = await Promise.all([
      !latestHouseAnalysis ? getLatestHouseVotesRepository(1) : Promise.resolve([]),
      !latestSenateAnalysis ? getLatestSenateVotesRepository(1) : Promise.resolve([]),
    ]);
    const hv = houseVotes[0];
    const sv = senateVotes[0];
    if (!latestHouseVote && hv) {
      latestHouseVote = { voteId: hv.voteId, billId: hv.billId, question: hv.voteQuestion, result: hv.result };
    }
    if (!latestSenateVote && sv) {
      latestSenateVote = { voteId: sv.voteId, billId: sv.billId, question: sv.question, result: sv.result };
    }
    const [houseAnalysis, senateAnalysis] = await Promise.all([
      !latestHouseAnalysis && hv
        ? analyzeHouseVoteFundingRepository({ voteId: hv.voteId })
        : Promise.resolve(null),
      !latestSenateAnalysis && sv
        ? analyzeSenateVoteFundingRepository({ voteId: sv.voteId })
        : Promise.resolve(null),
    ]);
    if (!latestHouseAnalysis && houseAnalysis) latestHouseAnalysis = houseAnalysis;
    if (!latestSenateAnalysis && senateAnalysis) latestSenateAnalysis = senateAnalysis;
  }

  const summaryTotals = launchSummary?.totals ?? latestSummary?.totals;
  const congressMemberCount = summaryNumber(summaryTotals, "congressMembers");
  const committeeCount = summaryNumber(summaryTotals, "committees");
  const totalRollCalls = houseVoteCount + senateVoteCount;

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <QueryHero
          title="Political money made legible."
          subtitle="Politired turns campaign finance, lobbying, and roll-call records into answers normal people can use. Ask a question in plain English, get the ranking, the funding breakdown, the vote record, and the source links."
          examples={[
            { label: "Rank all PACs by total receipts", href: "/search?q=Rank%20all%20PACs%20by%20total%20receipts" },
            { label: "Who are the top funded members of Congress?", href: "/search?q=Who%20are%20the%20top%20funded%20members%20of%20Congress%3F" },
            { label: "How did members vote on the latest defense bill?", href: "/search?q=How%20did%20members%20vote%20on%20the%20latest%20defense%20bill%3F" },
            { label: "Compare California and Texas on education outcomes", href: "/search?q=Compare%20California%20and%20Texas%20on%20education%20outcomes" },
            { label: "Show me the top federal contractors by award amount", href: "/search?q=Show%20me%20the%20top%20federal%20contractors%20by%20award%20amount" },
          ]}
        />

        <RecentReceiptsTicker limit={10} />

        <section className="grid gap-3 md:grid-cols-4">
          <SignalTile
            label="Contributions"
            value={formatCompactNumber(summaryNumber(summaryTotals, "contributions"))}
            note="Total contribution records in the current dataset."
          />
          <SignalTile
            label="Congress Members"
            value={String(congressMemberCount)}
            note="Canonical member records linked to campaign entities and votes."
          />
          <SignalTile
            label="Roll Calls"
            value={formatCompactNumber(totalRollCalls)}
            note={`${houseVoteCount} House + ${senateVoteCount} Senate roll-call votes loaded locally.`}
          />
          <SignalTile
            label="Searchable Committees"
            value={formatCompactNumber(committeeCount)}
            note="Committees and PACs available in the current dataset."
          />
        </section>

        {(() => {
          const stateRows = getStateDashboardRowsFromOutcomes(stateOutcomes);
          return stateRows.length > 0 ? (
            <StateValueMap
              title="Explore state outcomes"
              metricLabel="Choose a metric — click any state to open its dashboard"
              items={stateRows.map((s) => ({
                code: s.code,
                value: s.childPovertyValue,
                href: `/states/${s.id}`,
              }))}
              metrics={[
                {
                  key: "gdp-per-capita",
                  label: "GDP / capita",
                  metricLabel: "GDP per capita (USD)",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.gdpPerCapitaValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "gdp-growth",
                  label: "GDP growth",
                  metricLabel: "Real GDP growth, percent y/y",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.gdpGrowthPctValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "median-income",
                  label: "Median income",
                  metricLabel: "Median household income (USD)",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.medianIncomeValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "bachelors-plus",
                  label: "Bachelor's+",
                  metricLabel: "Pct. age 25+ with bachelor's degree or higher",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.bachelorsPlusValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "unemployment",
                  label: "Unemployment",
                  metricLabel: "Annual unemployment rate, percent",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.unemploymentValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "tax-burden",
                  label: "Tax burden",
                  metricLabel: "State+local taxes as pct. of state product",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.taxBurdenValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "federal-balance",
                  label: "Fed. balance",
                  metricLabel: "Net federal $ per resident (received minus paid)",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.federalBalanceValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "median-age",
                  label: "Median age",
                  metricLabel: "Median age, years",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.medianAgeValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "child-poverty",
                  label: "Child poverty",
                  metricLabel: "Child poverty rate",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.childPovertyValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "population",
                  label: "Population",
                  metricLabel: "Population",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.populationValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "fertility",
                  label: "Fertility",
                  metricLabel: "Births per 1k women",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.fertilityValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "child-mortality",
                  label: "Child mortality",
                  metricLabel: "Child mortality per 1k",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.childMortalityValue,
                    href: `/states/${s.id}`,
                  })),
                },
                {
                  key: "suicide-rate",
                  label: "Suicide rate",
                  metricLabel: "Deaths per 100k",
                  items: stateRows.map((s) => ({
                    code: s.code,
                    value: s.suicideRateValue,
                    href: `/states/${s.id}`,
                  })),
                },
              ]}
            />
          ) : null;
        })()}

        <SectionCard
          title="Start With The Question You Actually Have"
          subtitle="The product should feel like asking a well-informed friend who can quickly look up campaign filings."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <WorkflowCard
              kicker="Workflow 1"
              title="Who funds this person?"
              body="Start from a member of Congress and break down donors, committees, unique donors, and recent vote positions."
              href="/members"
              actionLabel="Open member profiles"
            />
            <WorkflowCard
              kicker="Workflow 2"
              title="Who is donating, and where does it go?"
              body="Open a donor profile to see visible contribution totals and top recipient entities, then jump into the recipient profile."
              href="/explore/donors"
              actionLabel="Browse donors"
            />
            <WorkflowCard
              kicker="Workflow 3"
              title="Who does this PAC fund?"
              body="Open a committee profile and follow outbound support to candidates, then jump straight into their funding and vote records."
              href="/pacs"
              actionLabel="Browse PAC and committee profiles"
            />
            <WorkflowCard
              kicker="Workflow 4"
              title="What is the funding context for this vote?"
              body="Open a bill or roll-call result and compare funding patterns across yes and no votes with linked source data."
              href="/bills"
              actionLabel="Inspect bill vote pages"
            />
          </div>
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-3">
          <FactCheckPanel
            title={`Latest House vote: ${
              latestHouseVote?.billId ?? latestHouseVote?.voteId ?? "record unavailable"
            }`}
            summary={
              latestHouseAnalysis
                ? `${latestHouseAnalysis.question ?? "Recent House vote"} split funding across ${latestHouseAnalysis.groups.length} vote groups.`
                : canRunDeepHomepageQueries
                  ? "House vote funding analysis is unavailable."
                  : "House vote funding analysis is paused due to limited data access."
            }
            visual={
              latestHouseAnalysis?.groups.length ? (
                <VoteBreakdownBar
                  segments={buildVoteSegments(
                    Object.fromEntries(latestHouseAnalysis.groups.map((g) => [g.voteCast, g.memberCount])),
                  )}
                />
              ) : undefined
            }
            dataPoints={
              latestHouseAnalysis
                ? [
                    `Vote record: ${latestHouseVote?.voteId ?? latestHouseAnalysis.voteId}`,
                    ...(latestHouseVote?.result ? [`Result: ${latestHouseVote.result}`] : []),
                    ...latestHouseAnalysis.groups.map(
                      (group) =>
                        `${group.voteCast}: ${group.memberCount} members, ${formatMoney(group.totalReceipts)} in linked receipts`,
                    ),
                  ]
                : [
                    canRunDeepHomepageQueries
                      ? "No House analysis loaded."
                      : "Detailed vote analysis is unavailable to keep the homepage fast.",
                  ]
            }
            href={
              (latestHouseVote?.voteId ?? latestHouseAnalysis?.voteId)
                ? `/votes/house/${(latestHouseVote?.voteId ?? latestHouseAnalysis?.voteId ?? "").toLowerCase()}`
                : undefined
            }
            actionLabel="Open latest House vote"
          />
          <FactCheckPanel
            title={`Latest Senate vote: ${
              latestSenateVote?.billId ?? latestSenateVote?.voteId ?? "record unavailable"
            }`}
            summary={
              latestSenateAnalysis
                ? `${latestSenateAnalysis.question ?? "Recent Senate vote"} is already connected to campaign receipts and member records.`
                : canRunDeepHomepageQueries
                  ? "Senate vote funding analysis is unavailable."
                  : "Senate vote funding analysis is paused due to limited data access."
            }
            visual={
              latestSenateAnalysis?.groups.length ? (
                <VoteBreakdownBar
                  segments={buildVoteSegments(
                    Object.fromEntries(latestSenateAnalysis.groups.map((g) => [g.voteCast, g.memberCount])),
                  )}
                />
              ) : undefined
            }
            dataPoints={
              latestSenateAnalysis
                ? [
                    `Vote record: ${latestSenateVote?.voteId ?? latestSenateAnalysis.voteId}`,
                    ...(latestSenateVote?.result ? [`Result: ${latestSenateVote.result}`] : []),
                    ...latestSenateAnalysis.groups.map(
                      (group) =>
                        `${group.voteCast}: ${group.memberCount} senators, ${formatMoney(group.totalReceipts)} in linked receipts`,
                    ),
                  ]
                : [
                    canRunDeepHomepageQueries
                      ? "No Senate analysis loaded."
                      : "Detailed vote analysis is unavailable to keep the homepage fast.",
                  ]
            }
            href={
              (latestSenateVote?.voteId ?? latestSenateAnalysis?.voteId)
                ? `/votes/senate/${(latestSenateVote?.voteId ?? latestSenateAnalysis?.voteId ?? "").toLowerCase()}`
                : undefined
            }
            actionLabel="Open latest Senate vote"
          />
          <FactCheckPanel
            title="What Politired shows"
            summary="Not opinions. Not punditry. Ranked public records with links back to the source system."
            dataPoints={[
              "Questions become rankings instead of opinions.",
              "Funding flows become browseable instead of opaque.",
              "Every result is built to be shared with source links attached.",
            ]}
          />
        </section>

        <AiHandoffPanel prompt={buildLlmHandoffPrompt()} />

        {canRunDeepHomepageQueries && topMembers.some((m) => m.totalReceipts > 0) && (
          <section className="grid gap-4 xl:grid-cols-2">
            <CompactRanking
              title="Top Funded Members"
              subtitle="Latest receipts across all campaign committees."
              items={topMembers.map((member) => ({
                rank: member.rank,
                label: toProperCase(member.label),
                detail: formatMoney(member.totalReceipts),
                rawValue: member.totalReceipts,
                href: `/members/${member.id.toLowerCase()}`,
              }))}
            />
            <CompactRanking
              title="Top Committees and PACs"
              subtitle="Latest receipts across all searchable committees."
              items={topCommittees.map((committee) => ({
                rank: committee.rank,
                label: committee.label,
                detail: formatMoney(committee.totalReceipts),
                rawValue: committee.totalReceipts,
                href: `/pacs/${committee.id.toLowerCase()}`,
              }))}
            />
          </section>
        )}

        <SectionCard
          title="Browse UI + MCP"
          subtitle="Discovery in the browser. Precision in your coding workflow."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="pt-panel p-4">
              <p className="pt-kicker">
                Browse Surface
              </p>
              <h3 className="pt-title mt-2 text-lg">Explore, compare, share</h3>
              <p className="pt-muted mt-2 text-sm leading-6">
                Profiles, vote analyses, and fact-check cards for skeptics, journalists, and organizers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="pt-button-primary px-3 py-1.5 text-xs" href="/search">
                  Open browse UI
                </Link>
                <Link className="pt-button-secondary px-3 py-1.5 text-xs" href="/compare">
                  Compare entities
                </Link>
              </div>
            </div>
            <div className="pt-panel p-4">
              <p className="pt-kicker">
                Query Surface
              </p>
              <h3 className="pt-title mt-2 text-lg">Claude/Codex-ready</h3>
              <p className="pt-muted mt-2 text-sm leading-6">
                The same data model is exposed through MCP tools for repeatable, source-grounded political queries.
              </p>
              <TableExplorer
                columns={["Example prompt", "Intent"]}
                rows={[
                  ["Who are the top 5 donors to members of the Senate Judiciary Committee?", "rank + funding profile"],
                  ["How did funding align with the vote on the latest appropriations bill?", "vote funding analysis"],
                  ["Compare California and Texas on education outcomes vs spending.", "state compare"],
                ]}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard
          title="Shareable By Default"
          subtitle="The result should be clear enough to inform a conversation and transparent enough to verify."
        >
          <ClaimCard
            claim={`The local Politired workspace currently links ${congressMemberCount} members, ${totalRollCalls.toLocaleString()} roll calls, and ${formatCompactNumber(summaryNumber(latestSummary?.totals, "contributions"))} contribution rows into one queryable graph.`}
            level="high"
            evidenceCount={4}
            nonClaim="This does not mean every causal claim is proven. It means the money, member, and vote joins are now inspectable instead of rhetorical."
            sourceLinks={[
              { label: "Member directory", href: "/members" },
              { label: "Committee directory", href: "/pacs" },
              {
                label: latestHouseVote?.billId
                  ? latestHouseVote.billId
                  : "Latest House vote",
                href: latestHouseVote?.billId
                  ? `/bills/${latestHouseVote.billId.toLowerCase()}`
                  : "/bills",
              },
              {
                label: latestSenateVote?.billId
                  ? latestSenateVote.billId
                  : "Latest Senate vote",
                href: latestSenateVote?.billId
                  ? `/bills/${latestSenateVote.billId.toLowerCase()}`
                  : "/bills",
              },
            ]}
          />
        </SectionCard>
      </main>
      <UtilityRail />
    </div>
  );
}
