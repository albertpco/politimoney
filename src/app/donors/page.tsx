import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  TableExplorer,
  UtilityRail,
} from "@/components/ui-primitives";
import { getDonorProfilesRepository } from "@/lib/data/repository";
import { fmtCompact, donorTypeLabel } from "@/lib/format";

export const revalidate = 3600;

export default async function DonorsPage() {
  const donors = await getDonorProfilesRepository(250);

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle
          title="Top Donors"
          subtitle={`${donors.length} donor profiles ranked by total contributions across all committees.`}
        />
        <CoverageStatusBar
          freshness="Latest ingestion cycle"
          quality="medium"
          gapNote="Donor profiles are derived from FEC contribution records and may not capture all giving."
        />

        <SectionCard
          title="Donor rankings"
          subtitle="All donors ranked by total contributed. Open a profile to see recipient breakdowns."
        >
          <div className="overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Donor", "Type", "Employer", "Total", "Recipients", "Profile"]}
              rows={donors.map((donor) => [
                donor.donor,
                donorTypeLabel(donor.donorType),
                donor.donorEmployer ?? "---",
                fmtCompact(donor.totalContributed),
                String(donor.recipientCount),
                {
                  label: "Open",
                  href: `/donors/${donor.id}`,
                },
              ])}
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Looking for a specific donor?"
          subtitle="Search by name, employer, or occupation."
        >
          <Link
            href="/search"
            className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Search donors
          </Link>
        </SectionCard>
      </main>
      <UtilityRail />
    </div>
  );
}
