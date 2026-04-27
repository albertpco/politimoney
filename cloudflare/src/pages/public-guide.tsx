import Link from "../components/link";
import { SectionCard, TableExplorer } from "../components/ui-primitives";

export function PublicGuidePage({ view = "methodology" }: { view?: "methodology" | "sources" | "mcp" }) {
  return (
    <main className="space-y-5">
      <SectionCard
        title={view === "sources" ? "Source Inventory" : view === "mcp" ? "Open Source + MCP" : "How To Read PolitiMoney"}
        subtitle="PolitiMoney is a public-record browser backed by source files you can export, inspect, and query with local MCP tools."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="pt-panel p-4">
            <p className="pt-kicker">Browse</p>
            <h3 className="pt-title mt-2 text-lg">Use the public site</h3>
            <p className="pt-muted mt-2 text-sm leading-6">
              Start with directories, not assumptions. Members, PACs, bills, votes, donors, states, and congressional trades all use public-record snapshots prepared for the hosted site.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="pt-button-primary px-3 py-1.5 text-xs" href="/members">Members</Link>
              <Link className="pt-button-secondary px-3 py-1.5 text-xs" href="/pacs">PACs</Link>
              <Link className="pt-button-secondary px-3 py-1.5 text-xs" href="/congress-trades">Trades</Link>
            </div>
          </div>
          <div className="pt-panel p-4">
            <p className="pt-kicker">Clone</p>
            <h3 className="pt-title mt-2 text-lg">Run the open-source repo</h3>
            <p className="pt-muted mt-2 text-sm leading-6">
              Clone the GitHub repo, install dependencies, add free FEC and Congress.gov API keys, then run the ingest/export commands locally.
            </p>
            <div className="mt-4">
              <a className="pt-button-primary px-3 py-1.5 text-xs" href="https://github.com/albertpco/politimoney" rel="noreferrer">
                Open GitHub
              </a>
            </div>
          </div>
          <div className="pt-panel p-4">
            <p className="pt-kicker">Ask</p>
            <h3 className="pt-title mt-2 text-lg">Use MCP from an agent</h3>
            <p className="pt-muted mt-2 text-sm leading-6">
              Any MCP stdio client can run <code>npm run mcp:server</code> in the repo and query the same public data snapshots with source-aware tools.
            </p>
            <div className="mt-4">
              <Link className="pt-button-secondary px-3 py-1.5 text-xs" href="/mcp">MCP setup</Link>
            </div>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Investigation Flows" subtitle="These are the paths a visitor can follow from the hosted site.">
        <TableExplorer
          columns={["Question", "Where to start", "What you can learn"]}
          rows={[
            [
              "What stocks are members buying or selling?",
              { label: "Congress Trades", href: "/congress-trades" },
              "Ticker, member, state, transaction type, date, reported amount range, and the filing source. These are disclosed ranges, not exact trade sizes.",
            ],
            [
              "Which PACs raise the most money?",
              { label: "PAC directory", href: "/pacs" },
              "Which committees raised the most, what kind of committee they are, and which donor and recipient records are visible.",
            ],
            [
              "Which donors give to whom?",
              { label: "Donor directory", href: "/donors" },
              "How much a named donor gave in the loaded records, how many recipients appear, and which recipients received the most.",
            ],
            [
              "How does money relate to a vote?",
              { label: "Bills", href: "/bills" },
              "Which bills have matched votes, how members voted, and where funding context is available around vote groups.",
            ],
            [
              "Can I verify the source?",
              { label: "Source inventory", href: "/data-coverage/sources" },
              "Source-system names, caveats, public links, and clear notes about what public records can and cannot show.",
            ],
          ]}
        />
      </SectionCard>

      <SectionCard title="MCP Tools" subtitle="The agent surface is local-first. It does not require the hosted Pages app to run server code.">
        <pre className="pt-panel overflow-auto p-4 text-xs"><code>{`git clone https://github.com/albertpco/politimoney.git
cd politimoney
npm install
npm run ingest
npm run mcp:server`}</code></pre>
        <TableExplorer
          columns={["Tool", "Use it for"]}
          rows={[
            ["get_pac_rankings", "Rank PACs by receipts, disbursements, or independent expenditures."],
            ["get_committee_recipients", "See where a PAC's money goes."],
            ["get_donor_profile", "See a donor's aggregate giving and top recipients."],
            ["get_congress_trade_disclosures", "Search STOCK Act trades by member, ticker, state, or transaction type."],
            ["analyze_vote_funding", "Compare funding groups around a bill or roll-call vote."],
            ["export_dataset", "Export public data snapshots as JSON for analysis or another app."],
          ]}
        />
      </SectionCard>

      <SectionCard title="Sources And Caveats" subtitle="The app is evidence-first, not allegation-first.">
        <TableExplorer
          columns={["Source", "Records"]}
          rows={[
            ["FEC / FEC bulk", "Campaign committees, candidates, receipts, donor aggregates, independent expenditures."],
            ["Congress.gov / House / Senate", "Bills, member records, roll calls, and vote positions."],
            ["House and Senate disclosure systems", "Congressional STOCK Act transaction disclosures."],
            ["USASpending, FARA, LDA, SEC, Census, CDC", "Contracts, foreign-agent filings, lobbying, insider trades, and state outcome context in the broader local dataset."],
          ]}
        />
        <div className="caveat mt-4">
          <span className="badge">Caveat</span>
          <div>
            Public records can show filings, dates, amounts, recipients, transactions, votes, and source links. They do not, by themselves, prove motive, cause and effect, illegality, or coordination.
          </div>
        </div>
      </SectionCard>
    </main>
  );
}

export default PublicGuidePage;
