import Link from "next/link";
import { SectionCard, TableExplorer } from "@/components/ui-primitives";
import { getLatestMembersRepository } from "@/lib/data/member-repository";

export const revalidate = 3600;

function toProperCase(name: string): string {
  return name.replace(/\b\w+/g, (word) => {
    if (word.length <= 2 && word === word.toUpperCase()) return word;
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}

function chamberLabel(chamber: string): string {
  return chamber === "S" ? "Senate" : "House";
}

export default async function MembersPage() {
  const members = (await getLatestMembersRepository())
    .filter((member) => member.currentMember !== false)
    .sort((left, right) =>
      left.state.localeCompare(right.state) ||
      left.chamber.localeCompare(right.chamber) ||
      left.name.localeCompare(right.name),
    );

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <SectionCard
          title="Members"
          subtitle={`${members.length} current congressional members in the active dataset.`}
        >
          <p className="text-sm text-stone-700">
            Open a profile to see the funding breakdown and related committee links.
          </p>
          <div className="mt-4 overflow-hidden rounded-[1.25rem] border border-stone-200">
            <TableExplorer
              columns={["Name", "Chamber", "Party", "State", "District", "Profile"]}
              rows={members.map((member) => [
                toProperCase(member.name),
                chamberLabel(member.chamber),
                member.partyCode ?? member.party ?? "—",
                member.state,
                member.district ?? "—",
                {
                  label: "Open",
                  href: `/members/${encodeURIComponent(member.bioguideId.toLowerCase())}`,
                },
              ])}
            />
          </div>
        </SectionCard>

        <SectionCard title="Need a specific person?" subtitle="Use search if you are not sure how the person is indexed.">
          <Link
            href="/search"
            className="inline-flex rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-800"
          >
            Search members
          </Link>
        </SectionCard>
      </main>
    </div>
  );
}
