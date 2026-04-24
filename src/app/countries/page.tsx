import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  UtilityRail,
} from "@/components/ui-primitives";
import { getLatestCountryInfluenceEntitiesRepository } from "@/lib/data/repository";

export const revalidate = 3600;

export default async function CountriesPage() {
  const countries = await getLatestCountryInfluenceEntitiesRepository();

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Foreign Influence by Country"
          subtitle={`${countries.length} countries with registered FARA foreign principal activity.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
          gapNote="FARA data shows registered foreign agents. Not all foreign influence activities require FARA registration."
        />

        <SectionCard
          title="Country rankings"
          subtitle="All countries ranked by number of foreign principal registrations."
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Country", "Principal Rows", "Registrant Count", "Route"]}
              rows={countries.map((country) => [
                country.name,
                String(country.principalCount),
                String(country.registrantCount),
                {
                  label: "Open",
                  href: `/countries/${country.id}`,
                },
              ])}
            />
          </div>
        </SectionCard>
      </main>
      <UtilityRail />
    </div>
  );
}
