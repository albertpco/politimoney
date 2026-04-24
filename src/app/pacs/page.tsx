import Link from "next/link";
import { ClaimCard, SectionCard, TableExplorer } from "@/components/ui-primitives";
import { getLatestCommitteesRepository } from "@/lib/data/committee-repository";

export const revalidate = 3600;

function money(value: number | undefined): string {
  if (!value || !Number.isFinite(value)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export default async function PacsPage() {
  const committees = await getLatestCommitteesRepository();

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <SectionCard
          title="PACs and committees"
          subtitle={`${committees.length} committee records ranked by total disbursements.`}
        >
          <p className="pt-muted text-sm">
            Open a committee profile to see donations, recipients, and linked officials.
          </p>
          <div className="mt-4">
            <TableExplorer
              columns={["Committee", "Type", "Disbursed", "Linked officials", "Profile"]}
              rows={committees.map((committee) => [
                committee.name,
                committee.issue,
                money(committee.cycleTotal),
                String(committee.linkedOfficials),
                {
                  label: "Open",
                  href: `/pacs/${encodeURIComponent(committee.committeeId.toLowerCase())}`,
                },
              ])}
            />
          </div>
        </SectionCard>
        <ClaimCard
          claim="This directory ranks committees by available disbursement totals from the current FEC-derived read model."
          level="medium"
          evidenceCount={1}
          nonClaim="A high disbursement total does not prove improper conduct, influence, or coordination. Open the committee profile for donor and recipient context."
          sourceLinks={[{ label: "Data coverage", href: "/data-coverage/sources" }]}
        />

        <SectionCard title="Need a specific committee?" subtitle="Search by committee name, committee ID, or donor name.">
          <Link
            href="/search"
            className="pt-button-primary inline-flex px-4 py-2 text-sm"
          >
            Search PACs
          </Link>
        </SectionCard>
      </main>
    </div>
  );
}
