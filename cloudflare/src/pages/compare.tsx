import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  CompareStrip,
  StateValueMap,
} from "../components/ui-primitives";
import { fetchJson, type MemberRecord } from "../lib/feed";
import {
  getStateDashboardRowsFromOutcomes,
  type OutcomeRow,
  type StateDashboardRow,
} from "../lib/state-outcomes";

function PageLayout({
  title,
  subtitle,
  children,
  quality = "medium",
  freshness = "Updated from the static feed",
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

function CompareHub() {
  return (
    <PageLayout
      title="Compare Landing"
      subtitle="Run side-by-side accountability comparisons for senators, states, and countries."
    >
      <SectionCard title="Choose comparison view" subtitle="Compare different topics with consistent metrics.">
        <div className="grid gap-3 md:grid-cols-3">
          <Link className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50" href="/compare/senators">
            Compare senators
          </Link>
          <Link className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50" href="/compare/states">
            Compare states
          </Link>
          <Link className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50" href="/compare/countries">
            Compare countries
          </Link>
        </div>
      </SectionCard>
    </PageLayout>
  );
}

function CompareSenators() {
  const [members, setMembers] = useState<MemberRecord[] | null>(null);
  const [stateRows, setStateRows] = useState<StateDashboardRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchJson<MemberRecord[]>("members.json").catch(() => [] as MemberRecord[]),
      fetchJson<OutcomeRow[]>("state-outcomes.json").catch(() => [] as OutcomeRow[]),
    ]).then(([m, o]) => {
      if (cancelled) return;
      setMembers(m);
      setStateRows(getStateDashboardRowsFromOutcomes(o));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!members) return <p className="pt-muted">Loading senators…</p>;

  const senators = members.filter((m) => m.chamber === "S");
  // Without funding totals on raw member records, fall back to alphabetical for a deterministic pair
  const sorted = [...senators].sort((a, b) => a.name.localeCompare(b.name));
  const left = sorted[0];
  const right = sorted[1];
  const leftState = left ? stateRows.find((s) => s.code.toUpperCase() === (left.state ?? "").toUpperCase()) : undefined;
  const rightState = right ? stateRows.find((s) => s.code.toUpperCase() === (right.state ?? "").toUpperCase()) : undefined;

  return (
    <PageLayout
      title="Senator Compare"
      subtitle="Side-by-side state-outcome context for two sitting senators."
    >
      <CompareStrip
        items={[
          {
            label: "Senator",
            left: left ? `${left.name} (${left.partyCode ?? left.party ?? "?"}-${left.state ?? "?"})` : "N/A",
            right: right ? `${right.name} (${right.partyCode ?? right.party ?? "?"}-${right.state ?? "?"})` : "N/A",
            diff: "",
          },
          {
            label: "State child poverty",
            left: leftState?.childPoverty ?? "N/A",
            right: rightState?.childPoverty ?? "N/A",
            diff:
              leftState?.childPovertyValue !== undefined && rightState?.childPovertyValue !== undefined
                ? `${(leftState.childPovertyValue - rightState.childPovertyValue).toFixed(1)} pts`
                : "N/A",
          },
          {
            label: "State median income",
            left: leftState?.medianIncome ?? "N/A",
            right: rightState?.medianIncome ?? "N/A",
            diff:
              leftState?.medianIncomeValue !== undefined && rightState?.medianIncomeValue !== undefined
                ? `$${Math.round(leftState.medianIncomeValue - rightState.medianIncomeValue).toLocaleString()}`
                : "N/A",
          },
        ]}
      />
      <SectionCard title="Pick another pair" subtitle="Open senator profiles to compare funding and voting record directly.">
        <ul className="grid gap-2 sm:grid-cols-2">
          {sorted.slice(0, 12).map((s) => (
            <li key={s.bioguideId}>
              <Link href={`/members/${s.bioguideId.toLowerCase()}`} className="pt-link text-sm">
                {s.name} · {s.partyCode ?? s.party ?? "?"}-{s.state ?? "?"}
              </Link>
            </li>
          ))}
        </ul>
      </SectionCard>
    </PageLayout>
  );
}

function CompareStates() {
  const [stateRows, setStateRows] = useState<StateDashboardRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<OutcomeRow[]>("state-outcomes.json")
      .catch(() => [] as OutcomeRow[])
      .then((o) => {
        if (!cancelled) setStateRows(getStateDashboardRowsFromOutcomes(o));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!stateRows) return <p className="pt-muted">Loading state outcomes…</p>;

  const orderedByPopulation = [...stateRows].sort(
    (l, r) => (r.populationValue ?? 0) - (l.populationValue ?? 0),
  );
  const left = orderedByPopulation[0];
  const right = orderedByPopulation[1];

  return (
    <PageLayout
      title="State Compare"
      subtitle="Side-by-side population outcomes with trend overlays and caveat notes."
    >
      <CompareStrip
        items={[
          {
            label: "Population",
            left: `${left?.name ?? "N/A"}: ${left?.pop ?? "N/A"}`,
            right: `${right?.name ?? "N/A"}: ${right?.pop ?? "N/A"}`,
            diff:
              left?.populationValue !== undefined && right?.populationValue !== undefined
                ? `${((left.populationValue - right.populationValue) / 1_000_000).toFixed(1)}M`
                : "N/A",
          },
          {
            label: "Child poverty",
            left: left?.childPoverty ?? "N/A",
            right: right?.childPoverty ?? "N/A",
            diff:
              left?.childPovertyValue !== undefined && right?.childPovertyValue !== undefined
                ? `${(left.childPovertyValue - right.childPovertyValue).toFixed(1)} pts`
                : "N/A",
          },
          {
            label: "Suicide rate",
            left: left?.suicideRate ?? "N/A",
            right: right?.suicideRate ?? "N/A",
            diff:
              left?.suicideRateValue !== undefined && right?.suicideRateValue !== undefined
                ? `${(left.suicideRateValue - right.suicideRateValue).toFixed(1)}/100k`
                : "N/A",
          },
        ]}
      />
      <StateValueMap
        title="State map: suicide rate"
        metricLabel="Age-adjusted deaths per 100k"
        items={stateRows.map((s) => ({
          code: s.code,
          value: s.suicideRateValue,
          href: `/states/${s.id}`,
        }))}
      />
    </PageLayout>
  );
}

function CompareCountries() {
  return (
    <PageLayout
      title="Country Compare"
      subtitle="Country influence comparisons (FARA registrants and principals) are not yet staged in the static feed."
      quality="partial"
    >
      <SectionCard title="Coming soon" subtitle="Country-level FARA influence data will land in a follow-up feed export.">
        <p className="pt-muted text-sm">
          When the FARA aggregate is staged, this view will show registered influence channels with legal-context annotations.
        </p>
      </SectionCard>
    </PageLayout>
  );
}

export function ComparePage() {
  const { slug } = useParams<{ slug?: string }>();
  if (!slug) return <CompareHub />;
  if (slug === "senators") return <CompareSenators />;
  if (slug === "states") return <CompareStates />;
  if (slug === "countries") return <CompareCountries />;
  return (
    <PageLayout title="Compare" subtitle={`No comparison view for "${slug}".`}>
      <SectionCard title="Not found" subtitle="Pick a comparison view from the landing page.">
        <Link href="/compare" className="pt-link">Back to compare landing</Link>
      </SectionCard>
    </PageLayout>
  );
}

export default ComparePage;
