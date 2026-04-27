import { useEffect, useState } from "react";
import Link from "../components/link";
import {
  ClaimCard,
  SectionCard,
  StateValueMap,
  TableExplorer,
  UtilityRail,
} from "../components/ui-primitives";
import {
  CompactRanking,
  AiHandoffPanel,
  FactCheckPanel,
  QueryHero,
  SignalTile,
  WorkflowCard,
} from "../components/politired-surfaces";
import { RecentReceiptsTicker } from "../components/recent-receipts-ticker";
import { fetchJson, loadLaunchSummary, loadManifest, type FeedManifest, type LaunchSummary } from "../lib/feed";
import {
  getStateDashboardRowsFromOutcomes,
  type OutcomeRow,
} from "../lib/state-outcomes";

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
    "I am using PolitiMoney, an open public-record intelligence tool for American government.",
    "Help me inspect the evidence without assuming motive or cause and effect.",
    "Start with these questions:",
    "1. Who funds the official, committee, bill, or vote group I am looking at?",
    "2. Which records support the claim, and what source links should I verify?",
    "3. What does the data show, and what does it not prove?",
    "4. What comparison or ranking should I run next to avoid cherry-picking?",
  ].join("\n");
}

const STATE_MAP_METRICS = [
  { key: "gdp-per-capita", label: "GDP / capita", metricLabel: "GDP per capita (USD)", field: "gdpPerCapitaValue" as const },
  { key: "gdp-growth", label: "GDP growth", metricLabel: "Real GDP growth, percent y/y", field: "gdpGrowthPctValue" as const },
  { key: "median-income", label: "Median income", metricLabel: "Median household income (USD)", field: "medianIncomeValue" as const },
  { key: "bachelors-plus", label: "Bachelor's+", metricLabel: "Pct. age 25+ with bachelor's degree or higher", field: "bachelorsPlusValue" as const },
  { key: "unemployment", label: "Unemployment", metricLabel: "Annual unemployment rate, percent", field: "unemploymentValue" as const },
  { key: "tax-burden", label: "Tax burden", metricLabel: "State+local taxes as pct. of state product", field: "taxBurdenValue" as const },
  { key: "federal-balance", label: "Fed. balance", metricLabel: "Net federal $ per resident", field: "federalBalanceValue" as const },
  { key: "median-age", label: "Median age", metricLabel: "Median age, years", field: "medianAgeValue" as const },
  { key: "child-poverty", label: "Child poverty", metricLabel: "Child poverty rate", field: "childPovertyValue" as const },
  { key: "population", label: "Population", metricLabel: "Population", field: "populationValue" as const },
  { key: "fertility", label: "Fertility", metricLabel: "Births per 1k women", field: "fertilityValue" as const },
  { key: "child-mortality", label: "Child mortality", metricLabel: "Child mortality per 1k", field: "childMortalityValue" as const },
  { key: "suicide-rate", label: "Suicide rate", metricLabel: "Deaths per 100k", field: "suicideRateValue" as const },
];

export function HomePage() {
  const [launchSummary, setLaunchSummary] = useState<LaunchSummary | null>(null);
  const [manifest, setManifest] = useState<FeedManifest | null>(null);
  const [stateRows, setStateRows] = useState<ReturnType<typeof getStateDashboardRowsFromOutcomes>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [summary, nextManifest, outcomes] = await Promise.all([
        loadLaunchSummary(),
        loadManifest().catch(() => null),
        fetchJson<OutcomeRow[]>("state-outcomes.json").catch(() => [] as OutcomeRow[]),
      ]);
      if (cancelled) return;
      setLaunchSummary(summary);
      setManifest(nextManifest);
      setStateRows(getStateDashboardRowsFromOutcomes(outcomes));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const totals = launchSummary?.totals ?? {};
  const totalRollCalls = manifest?.datasets.votes?.count ?? totals.votes ?? 0;
  const congressMemberCount = totals.members ?? 0;
  const committeeCount = totals.committees ?? 0;
  const billCount = manifest?.datasets.bills?.count ?? totals.bills ?? 0;

  const topMembers = (launchSummary?.topMembers ?? []).map((m, i) => ({
    rank: i + 1,
    id: m.bioguideId,
    label: m.name,
    totalReceipts: m.total,
  }));
  const topCommittees = (launchSummary?.topCommittees ?? []).map((c, i) => ({
    rank: i + 1,
    id: c.committeeId,
    label: c.name,
    totalReceipts: c.total,
  }));
  const latestHouseVote = launchSummary?.latestHouseVote;
  const latestSenateVote = launchSummary?.latestSenateVote;

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <QueryHero
          title="Political money made legible."
          subtitle="PolitiMoney turns campaign finance, lobbying, and roll-call records into answers normal people can use. Ask a question in plain English, get the ranking, the funding breakdown, the vote record, and the source links."
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
            label="Members"
            value={String(congressMemberCount)}
            note="Member profiles with campaign money and vote links where available."
          />
          <SignalTile
            label="Roll Calls"
            value={formatCompactNumber(totalRollCalls)}
            note="Congressional votes you can open, search, and connect back to bills."
          />
          <SignalTile
            label="Committees"
            value={formatCompactNumber(committeeCount)}
            note="PACs and party committees ranked by reported money raised."
          />
          <SignalTile
            label="Bills"
            value={formatCompactNumber(billCount)}
            note="Bills you can search, with vote links when roll calls are matched."
          />
        </section>

        {stateRows.length > 0 ? (
          <StateValueMap
            title="Explore state outcomes"
            metricLabel="Choose a metric — click any state to open its dashboard"
            items={stateRows.map((s) => ({ code: s.code, value: s.childPovertyValue, href: `/states/${s.id}` }))}
            metrics={STATE_MAP_METRICS.map((m) => ({
              key: m.key,
              label: m.label,
              metricLabel: m.metricLabel,
              items: stateRows.map((s) => ({ code: s.code, value: s[m.field], href: `/states/${s.id}` })),
            }))}
          />
        ) : null}

        <SectionCard
          title="Start With The Question You Actually Have"
          subtitle="The product should feel like asking a well-informed friend who can quickly look up campaign filings."
        >
          <div className="grid gap-4 lg:grid-cols-3">
            <WorkflowCard kicker="Workflow 1" title="Who funds this person?" body="Start from a member of Congress and break down donors, committees, unique donors, and recent vote positions." href="/members" actionLabel="Open member profiles" />
            <WorkflowCard kicker="Workflow 2" title="Who is donating, and where does it go?" body="Open a donor profile to see visible contribution totals and top recipient entities, then jump into the recipient profile." href="/donors" actionLabel="Browse donors" />
            <WorkflowCard kicker="Workflow 3" title="Who does this PAC fund?" body="Open a committee profile and follow outbound support to candidates, then jump straight into their funding and vote records." href="/pacs" actionLabel="Browse PAC and committee profiles" />
            <WorkflowCard kicker="Workflow 4" title="What is the funding context for this vote?" body="Open a bill or roll-call result and compare funding patterns across yes and no votes with linked source data." href="/bills" actionLabel="Inspect bill vote pages" />
          </div>
        </SectionCard>

        <section className="grid gap-4 xl:grid-cols-3">
          <FactCheckPanel
            title={`Latest House vote: ${latestHouseVote?.billId ?? latestHouseVote?.voteId ?? "loading…"}`}
            summary={latestHouseVote ? `Question: ${latestHouseVote.question ?? "Recent House vote"}.` : "Loading the latest House vote from the feed."}
            visual={undefined}
            dataPoints={
              latestHouseVote
                ? [
                    `Vote record: ${latestHouseVote.voteId}`,
                    ...(latestHouseVote.result ? [`Result: ${latestHouseVote.result}`] : []),
                  ]
                : ["Open the vote record to see the full member breakdown and funding context."]
            }
            href={latestHouseVote?.voteId ? `/votes/house/${latestHouseVote.voteId.toLowerCase()}` : "/votes"}
            actionLabel="Open latest House vote"
          />
          <FactCheckPanel
            title={`Latest Senate vote: ${latestSenateVote?.billId ?? latestSenateVote?.voteId ?? "loading…"}`}
            summary={latestSenateVote ? `Question: ${latestSenateVote.question ?? "Recent Senate vote"}.` : "Loading the latest Senate vote from the feed."}
            dataPoints={
              latestSenateVote
                ? [
                    `Vote record: ${latestSenateVote.voteId}`,
                    ...(latestSenateVote.result ? [`Result: ${latestSenateVote.result}`] : []),
                  ]
                : ["Open the vote record to see the full member breakdown and funding context."]
            }
            href={latestSenateVote?.voteId ? `/votes/senate/${latestSenateVote.voteId.toLowerCase()}` : "/votes"}
            actionLabel="Open latest Senate vote"
          />
          <FactCheckPanel
            title="What PolitiMoney shows"
            summary="Not opinions. Not punditry. Ranked public records with links back to the source system."
            dataPoints={[
              "Questions become rankings instead of opinions.",
              "Funding flows become browseable instead of opaque.",
              "Every result is built to be shared with source links attached.",
            ]}
          />
        </section>

        <AiHandoffPanel prompt={buildLlmHandoffPrompt()} />

        {topMembers.length > 0 && topMembers.some((m) => m.totalReceipts > 0) ? (
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
        ) : null}

        <SectionCard
          title="Browse UI + MCP"
          subtitle="Discovery in the browser. Precision in your coding workflow."
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="pt-panel p-4">
              <p className="pt-kicker">Browse Surface</p>
              <h3 className="pt-title mt-2 text-lg">Explore, compare, share</h3>
              <p className="pt-muted mt-2 text-sm leading-6">
                Profiles, vote analyses, and fact-check cards for skeptics, journalists, and organizers.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link className="pt-button-primary px-3 py-1.5 text-xs" href="/search">Open browse UI</Link>
                <Link className="pt-button-secondary px-3 py-1.5 text-xs" href="/compare">Compare entities</Link>
              </div>
            </div>
            <div className="pt-panel p-4">
              <p className="pt-kicker">Query Surface</p>
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
            claim={loading
              ? "Loading the latest run summary…"
              : `PolitiMoney currently links ${congressMemberCount} members, ${formatCompactNumber(totalRollCalls)} congressional votes, and ${formatCompactNumber(committeeCount)} committees into one public-record browser.`}
            level="high"
            evidenceCount={4}
            nonClaim="This does not mean the records prove cause and effect. It means the money, member, and vote records are inspectable instead of rhetorical."
            sourceLinks={[
              { label: "Member directory", href: "/members" },
              { label: "Committee directory", href: "/pacs" },
              {
                label: latestHouseVote?.billId ?? "Latest House vote",
                href: latestHouseVote?.billId ? `/bills/${latestHouseVote.billId.toLowerCase()}` : "/bills",
              },
              {
                label: latestSenateVote?.billId ?? "Latest Senate vote",
                href: latestSenateVote?.billId ? `/bills/${latestSenateVote.billId.toLowerCase()}` : "/bills",
              },
            ]}
          />
        </SectionCard>

      </main>
      <UtilityRail />
    </div>
  );
}

export default HomePage;
