import Link from "next/link";
import { PageScaffold } from "@/components/page-templates";
import { SectionCard, StateValueMap, TableExplorer } from "@/components/ui-primitives";
import { getLatestStatesRepository } from "@/lib/data/state-repository";
import { STATE_REFERENCE_MAP } from "@/lib/state-reference";
import { getStateDashboardRowsFromOutcomes } from "@/lib/state-outcomes";

export const revalidate = 3600;

export default async function StatesPage() {
  const stateRows = getStateDashboardRowsFromOutcomes(await getLatestStatesRepository());

  return (
    <PageScaffold
      eyebrow="States"
      title="State dashboards"
      subtitle="Browse the state outcome snapshot, open a state, and compare how the metrics move across the map."
    >
      <SectionCard
        title="All states"
        subtitle={`${stateRows.length} state records in the current snapshot.`}
      >
        <TableExplorer
          columns={["State", "Governor", "Population", "Child poverty", "Fertility", "Child mortality", "Suicide rate", "Open"]}
          rows={stateRows.map((state) => {
            const ref = STATE_REFERENCE_MAP.get(state.code);
            return [
              state.name,
              ref ? `${ref.governor} (${ref.governorParty})` : "—",
              state.pop,
              state.childPoverty,
              state.fertility,
              state.childMortality,
              state.suicideRate,
              { label: "Open", href: `/states/${state.id}` },
            ];
          })}
        />
      </SectionCard>

      <StateValueMap
        title="Map view"
        metricLabel="Choose a metric"
        items={stateRows.map((state) => ({
          code: state.code,
          value: state.childPovertyValue,
          href: `/states/${state.id}`,
        }))}
        metrics={[
          {
            key: "child-poverty",
            label: "Child poverty",
            metricLabel: "Child poverty rate",
            items: stateRows.map((state) => ({
              code: state.code,
              value: state.childPovertyValue,
              href: `/states/${state.id}`,
            })),
          },
          {
            key: "population",
            label: "Population",
            metricLabel: "Population",
            items: stateRows.map((state) => ({
              code: state.code,
              value: state.populationValue,
              href: `/states/${state.id}`,
            })),
          },
          {
            key: "fertility",
            label: "Fertility",
            metricLabel: "Births per 1k women",
            items: stateRows.map((state) => ({
              code: state.code,
              value: state.fertilityValue,
              href: `/states/${state.id}`,
            })),
          },
          {
            key: "child-mortality",
            label: "Child mortality",
            metricLabel: "Child mortality per 1k",
            items: stateRows.map((state) => ({
              code: state.code,
              value: state.childMortalityValue,
              href: `/states/${state.id}`,
            })),
          },
          {
            key: "suicide-rate",
            label: "Suicide rate",
            metricLabel: "Deaths per 100k",
            items: stateRows.map((state) => ({
              code: state.code,
              value: state.suicideRateValue,
              href: `/states/${state.id}`,
            })),
          },
        ]}
      />

      <SectionCard title="Next step" subtitle="Go straight to a state or search for another route.">
        <div className="flex flex-wrap gap-3">
          <Link
            href="/search"
            className="rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Search
          </Link>
          <Link
            href="/members"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50"
          >
            Members
          </Link>
        </div>
      </SectionCard>
    </PageScaffold>
  );
}
