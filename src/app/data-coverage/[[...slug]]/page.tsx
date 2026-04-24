import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
  MetricCard,
  TimelineRail,
} from "@/components/ui-primitives";
import {
  readLatestSummary,
  readLatestArtifacts,
  listIngestRunIds,
  readRunSummary,
} from "@/lib/ingest/storage";
import { formatCycleLabel } from "@/lib/format";
import type { IngestRunSummary } from "@/lib/ingest/types";

export const revalidate = 3600;

function PageLayout({
  title,
  subtitle,
  children,
  quality = "medium",
  freshness = "Updated from FEC filings",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  quality?: "high" | "medium" | "partial";
  freshness?: string;
}) {
  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle title={title} subtitle={subtitle} />
        <CoverageStatusBar freshness={freshness} quality={quality} />
        {children}
      </main>
      <UtilityRail />
    </div>
  );
}

async function DataCoverageHub() {
  const latestSummary = await readLatestSummary();
  return (
    <PageLayout
      title="Data Coverage Hub"
      subtitle="Source inventory, freshness, known gaps, and revision history."
    >
      {latestSummary && (
        <SectionCard title="Latest data run" subtitle="Latest data update.">
          <div className="grid gap-3 md:grid-cols-4">
            <MetricCard
              label="Run ID"
              value={latestSummary.runId}
              delta={formatCycleLabel(latestSummary.cycles)}
              period="local"
              quality="high"
            />
            <MetricCard
              label="Finished"
              value={new Date(latestSummary.finishedAt).toLocaleString()}
              delta="completed"
              period=""
              quality="high"
            />
            <MetricCard
              label="FEC + FARA + Congress"
              value={String(
                latestSummary.totals.candidates +
                  latestSummary.totals.committees +
                  latestSummary.totals.contributions +
                  latestSummary.totals.faraRegistrants +
                  latestSummary.totals.faraForeignPrincipals +
                  latestSummary.totals.bills +
                  (latestSummary.totals.congressMembers ?? 0),
              )}
              delta="records"
              period="latest"
              quality="medium"
            />
            <MetricCard
              label="State outcomes"
              value={String(latestSummary.totals.stateOutcomes ?? 0)}
              delta="states"
              period="latest"
              quality={latestSummary.sources.outcomes?.ok ? "medium" : "partial"}
            />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            <Link
              className="underline decoration-dotted"
              href="/data-coverage/run-history"
            >
              View run history
            </Link>{" "}
            ·{" "}
            <Link
              className="underline decoration-dotted"
              href="/data-coverage/sources"
            >
              Source inventory
            </Link>
          </p>
        </SectionCard>
      )}
      <SectionCard
        title="Coverage routes"
        subtitle="Use these pages to verify boundaries before interpretation."
      >
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/data-coverage/sources"
          >
            Source inventory
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/data-coverage/freshness"
          >
            Freshness
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/data-coverage/run-history"
          >
            Run history
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/data-coverage/changelog"
          >
            Changelog
          </Link>
        </div>
      </SectionCard>
    </PageLayout>
  );
}

async function SourcesPage() {
  const [latestSummary, latestArtifacts] = await Promise.all([
    readLatestSummary(),
    readLatestArtifacts(),
  ]);
  const knownGapsStatic = [
    "FEC candidate/committee data is capped by pipeline limits (candidateLimit, fecCommitteeLimit, etc.).",
    "FEC candidate feeds are election-cycle filings and do not represent a full seated Congress roster by themselves.",
    "FARA sample is limited by faraRegistrantLimit; full FARA requires separate bulk access.",
    "Congress.gov bills are a snapshot; bill text and full action history live on Congress.gov.",
    "State outcomes: GDP is not yet in outcome schema.",
  ];
  const knownGapsFromRun = latestSummary?.warnings ?? [];
  return (
    <PageLayout
      title="Source Inventory"
      subtitle="Canonical sources and authority classes used by the application."
    >
      <TableExplorer
        columns={["Source", "Type", "Scope", "Usage"]}
        rows={[
          [
            "FEC",
            "Official",
            "Campaign law and filings",
            "Legal baseline and contributor rules",
          ],
          [
            "OpenSecrets",
            "Research aggregation",
            "PAC/FARA and channel summaries",
            "Public-facing influence views",
          ],
          [
            "DOJ FARA",
            "Official",
            "Registrants and principals",
            "Underlying foreign influence records",
          ],
          [
            "Congress.gov API",
            "Official",
            "Bill metadata and actions",
            "Policy activity context",
          ],
          [
            "Census ACS API",
            "Official",
            "Population, child poverty, fertility",
            "State outcomes",
          ],
          [
            "CDC NCHS API",
            "Official",
            "Age-adjusted suicide rates",
            "State outcomes",
          ],
        ]}
      />
      <SectionCard
        title="Latest data snapshot counts"
        subtitle="Latest data snapshot."
      >
        {latestSummary && latestArtifacts ? (
          <TableExplorer
            columns={["Dataset", "Count", "Sample preview"]}
            rows={[
              [
                "FEC candidates",
                String(latestSummary.totals.candidates),
                latestArtifacts.fec.candidates[0]?.name ?? "No data",
              ],
              [
                "FEC contributions",
                String(latestSummary.totals.contributions),
                latestArtifacts.fec.contributions[0]?.donorName ?? "No data",
              ],
              [
                "FARA registrants",
                String(latestSummary.totals.faraRegistrants),
                latestArtifacts.fara.registrants[0]?.name ?? "No data",
              ],
              [
                "FARA foreign principals",
                String(latestSummary.totals.faraForeignPrincipals),
                latestArtifacts.fara.foreignPrincipals[0]?.principalName ??
                  "No data",
              ],
              [
                "Congress bills",
                String(latestSummary.totals.bills),
                latestArtifacts.congress.bills[0]?.title ?? "No data",
              ],
              [
                "Congress members",
                String(latestSummary.totals.congressMembers ?? 0),
                latestArtifacts.congress.members[0]?.name ?? "No data",
              ],
              [
                "State outcomes",
                String(latestSummary.totals.stateOutcomes),
                latestArtifacts.outcomes.states[0]?.stateName ?? "No data",
              ],
            ]}
          />
        ) : (
          <p className="text-sm text-slate-700">
            Data is not yet available. Check back later.
          </p>
        )}
      </SectionCard>
      <SectionCard
        title="Known gaps and limitations"
        subtitle="Data coverage and known limitations."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          {knownGapsStatic.map((gap) => (
            <li key={gap}>{gap}</li>
          ))}
          {knownGapsFromRun.map((w) => (
            <li key={w} className="text-amber-700">
              {w}
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageLayout>
  );
}

async function FreshnessPage() {
  const latestSummary = await readLatestSummary();
  return (
    <PageLayout
      title="Data Freshness"
      subtitle="Refresh cadence and lag profile by metric domain."
    >
      <TableExplorer
        columns={["Domain", "Cadence", "Typical lag", "Notes"]}
        rows={[
          [
            "FARA channels",
            "Frequent",
            "Low to moderate",
            "Dependent on filing cadence",
          ],
          [
            "Campaign summaries",
            "Frequent",
            "Low",
            "Depends on disclosure schedule",
          ],
          [
            "Population outcomes",
            "Periodic",
            "Moderate",
            "Official release cycles vary",
          ],
        ]}
      />
      <SectionCard
        title="Latest run freshness"
        subtitle="When the data was last updated."
      >
        {latestSummary ? (
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Started"
              value={new Date(latestSummary.startedAt).toLocaleString()}
              delta={`run ${latestSummary.runId}`}
              period="local"
              quality="high"
            />
            <MetricCard
              label="Finished"
              value={new Date(latestSummary.finishedAt).toLocaleString()}
              delta={formatCycleLabel(latestSummary.cycles)}
              period="local"
              quality="high"
            />
            <MetricCard
              label="Warnings"
              value={String(latestSummary.warnings.length)}
              delta="ingest warnings"
              period="latest run"
              quality={latestSummary.warnings.length ? "partial" : "high"}
            />
          </div>
        ) : (
          <p className="text-sm text-slate-700">
            No data loaded yet. Check back later.
          </p>
        )}
      </SectionCard>
    </PageLayout>
  );
}

function ChangelogPage() {
  return (
    <PageLayout
      title="Data Changelog"
      subtitle="Versioned updates and correction logs for transparency and auditability."
    >
      <TimelineRail
        events={[
          {
            date: "2026-03-01",
            title: "Initial multi-route UI implementation",
            detail:
              "Implemented public web IA, screen stacks, and trust components.",
          },
          {
            date: "2026-02-28",
            title: "Country case template revision",
            detail:
              "Added explicit non-claim language and causality warning defaults.",
          },
          {
            date: "2026-02-27",
            title: "Outcome scorecard schema update",
            detail:
              "Added child poverty, fertility, and child mortality to standard panels.",
          },
        ]}
      />
    </PageLayout>
  );
}

async function RunHistoryPage() {
  const runIds = await listIngestRunIds();
  const runSummaries = (
    await Promise.all(
      runIds.slice(0, 30).map(async (runId) => {
        const s = await readRunSummary(runId);
        return s ?? null;
      }),
    )
  ).filter(Boolean) as IngestRunSummary[];

  return (
    <PageLayout
      title="Ingest Run History"
      subtitle="Past pipeline runs (newest first). Latest run is the current snapshot."
    >
      <SectionCard
        title="Runs"
        subtitle={`${runSummaries.length} run(s) in history. Run IDs are timestamps.`}
      >
        {runSummaries.length === 0 ? (
          <p className="text-sm text-slate-700">
            No data loaded yet. Check back later.
          </p>
        ) : (
          <TableExplorer
            columns={[
              "Run ID",
              "Finished",
              "Cycle",
              "FEC",
              "FARA",
              "Bills",
              "Members",
              "Outcomes",
              "Warnings",
            ]}
            rows={runSummaries.map((s) => [
              s.runId,
              new Date(s.finishedAt).toLocaleString(),
              s.cycles.length ? s.cycles.join(", ") : "\u2014",
              String(
                s.totals.candidates +
                  s.totals.committees +
                  s.totals.contributions,
              ),
              String(
                s.totals.faraRegistrants + s.totals.faraForeignPrincipals,
              ),
              String(s.totals.bills),
              String(s.totals.congressMembers ?? 0),
              String(s.totals.stateOutcomes ?? 0),
              String(s.warnings.length),
            ])}
          />
        )}
      </SectionCard>
    </PageLayout>
  );
}

export default async function DataCoveragePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <DataCoverageHub />;
  if (subsection === "sources") return <SourcesPage />;
  if (subsection === "freshness") return <FreshnessPage />;
  if (subsection === "changelog") return <ChangelogPage />;
  if (subsection === "run-history") return <RunHistoryPage />;

  notFound();
}
