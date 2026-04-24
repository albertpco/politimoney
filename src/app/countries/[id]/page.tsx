import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  MetricCard,
  ClaimCard,
  CausalityWarningBlock,
  UtilityRail,
} from "@/components/ui-primitives";
import { getLatestCountryInfluenceEntitiesRepository } from "@/lib/data/repository";
import { evidenceLinks } from "@/lib/site-data";

export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const countries = await getLatestCountryInfluenceEntitiesRepository();
  const country = countries.find((c) => c.id === id);
  if (!country) return { title: "Country not found | Politired" };
  return {
    title: `${country.name} | Politired`,
    description: `Foreign influence profile for ${country.name}. ${country.principalCount} principal registrations, ${country.registrantCount} registrants.`,
  };
}

export default async function CountryDetailPage({ params }: Props) {
  const { id } = await params;
  const countries = await getLatestCountryInfluenceEntitiesRepository();
  const country = countries.find((c) => c.id === id);
  if (!country) notFound();

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title={country.name}
          subtitle="FARA foreign agent registration activity for this country."
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
        />

        <SectionCard title="Country channel snapshot" subtitle="Registered foreign principal activity.">
          <div className="grid gap-3 md:grid-cols-3">
            <MetricCard
              label="Principal rows"
              value={String(country.principalCount)}
              delta="FARA registrations"
              period="available data"
              quality="medium"
            />
            <MetricCard
              label="Registrant count"
              value={String(country.registrantCount)}
              delta="unique registrants"
              period="available data"
              quality="medium"
            />
            <MetricCard
              label="Top principals"
              value={String(country.topPrincipals.length)}
              delta="sampled entities"
              period="available data"
              quality="medium"
            />
          </div>
        </SectionCard>

        {country.topPrincipals.length > 0 && (
          <SectionCard title="Top principals" subtitle="Sampled foreign principals registered under this country.">
            <ul className="space-y-1">
              {country.topPrincipals.map((principal) => (
                <li key={principal} className="text-sm text-stone-700">
                  {principal}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-stone-500">
              {country.caution}
            </p>
            <div className="mt-3">
              <CausalityWarningBlock />
            </div>
          </SectionCard>
        )}

        <ClaimCard
          claim={`${country.name} has ${country.principalCount} FARA foreign principal registrations from ${country.registrantCount} registrants.`}
          level="medium"
          evidenceCount={evidenceLinks.length}
          nonClaim="FARA registrations show legal advocacy on behalf of foreign principals. They do not establish espionage, undue influence, or illegal campaign conduct."
          sourceLinks={evidenceLinks}
        />
      </main>
      <UtilityRail />
    </div>
  );
}
