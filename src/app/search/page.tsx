import Link from "next/link";
import { QueryHero } from "@/components/politired-surfaces";
import { SectionCard, TableExplorer } from "@/components/ui-primitives";
import { searchEntitiesRepository } from "@/lib/data/search-repository";

export const revalidate = 3600;

type SearchPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function normalizeRoute(result: {
  type: string;
  id: string;
  label: string;
  href?: string;
}): string {
  if (result.type === "member") return `/members/${encodeURIComponent(result.id.toLowerCase())}`;
  if (result.type === "candidate") return result.href ?? `/search?q=${encodeURIComponent(result.label)}`;
  if (result.type === "committee") return `/pacs/${encodeURIComponent(result.id.toLowerCase())}`;
  if (result.type === "bill") return `/bills/${encodeURIComponent(result.id.toLowerCase())}`;
  if (result.type === "state") return `/states/${encodeURIComponent(result.id.toLowerCase())}`;
  return result.href ?? `/search?q=${encodeURIComponent(result.label)}`;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await searchParams;
  const q = firstValue(query.q).trim();
  const results = q ? await searchEntitiesRepository(q, undefined, 25) : [];

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-6">
        <QueryHero
          title="Search the public record."
          subtitle="Start with a person, PAC, bill, or donor and explore the public record."
          examples={[
            { label: "Top funded members of Congress", href: "/search?q=Top%20funded%20members%20of%20Congress" },
            { label: "Rank PACs by total receipts", href: "/search?q=Rank%20PACs%20by%20total%20receipts" },
            { label: "Compare state outcomes on child poverty", href: "/search?q=Compare%20state%20outcomes%20on%20child%20poverty" },
          ]}
        />

        <SectionCard title="Query" subtitle="Use `?q=` to run a search against the current dataset.">
          <p className="text-sm text-stone-700">
            Query: <span className="font-semibold">{q || "(empty)"}</span>
          </p>
          <p className="mt-1 text-xs text-stone-600">
            Try a member name, committee name, bill number, or donor name.
          </p>
        </SectionCard>

        {q ? (
          <SectionCard title={`Results for "${q}"`} subtitle={`${results.length} matches found.`}>
            <TableExplorer
              columns={["Name", "Type", "Context", "Route"]}
              rows={results.map((result) => [
                result.label,
                result.type,
                result.subtitle ?? "—",
                {
                  label: "Open",
                  href: normalizeRoute(result),
                },
              ])}
            />
          </SectionCard>
        ) : (
          <SectionCard title="Start here" subtitle="Use the search box above or jump into a primary directory.">
            <div className="grid gap-3 md:grid-cols-3">
              <Link
                href="/members"
                className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                Browse members
              </Link>
              <Link
                href="/pacs"
                className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                Browse PACs
              </Link>
              <Link
                href="/search?q=Rank%20PACs%20by%20total%20receipts"
                className="rounded-xl border border-stone-200 bg-white p-4 text-sm font-medium text-stone-800 hover:bg-stone-50"
              >
                Run an example question
              </Link>
            </div>
          </SectionCard>
        )}
      </main>
    </div>
  );
}
