import { CompactRanking, QueryHero, WorkflowCard } from "@/components/politired-surfaces";
import { getShareCardExamples } from "@/lib/share-cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Share Cards | Politired",
  description:
    "Shareable Politired cards for members, donors, committees, bills, and country influence profiles.",
};

export default async function ShareIndexPage() {
  const examples = await getShareCardExamples();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <QueryHero
        title="Share what the record actually says."
        subtitle="Politired share cards are compact, source-disciplined summaries that point back to the full profile when someone wants the detailed data."
        examples={examples.slice(0, 4).map((example) => ({
          label: example.label,
          href: example.href,
        }))}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkflowCard
          kicker="Members"
          title="Share who funds a person"
          body="Turn a member funding profile into a compact card with contribution data, donor scale, and vote context."
          href={examples.find((example) => example.kind === "member")?.href ?? "/explore/senators"}
          actionLabel="Open a member card"
        />
        <WorkflowCard
          kicker="Donors"
          title="Share who gives and where it flows"
          body="Turn a donor profile into a compact card with visible contribution totals and top recipient entities."
          href={examples.find((example) => example.kind === "donor")?.href ?? "/explore/donors"}
          actionLabel="Open a donor card"
        />
        <WorkflowCard
          kicker="Committees"
          title="Share who a PAC attracts"
          body="Condense contribution totals, donors, and recipient candidates into one portable surface."
          href={examples.find((example) => example.kind === "committee")?.href ?? "/explore/organizations"}
          actionLabel="Open a committee card"
        />
        <WorkflowCard
          kicker="Bills"
          title="Share the vote context"
          body="Publish a bill card with the latest action and House/Senate funding splits."
          href={examples.find((example) => example.kind === "bill")?.href ?? "/explore/bills"}
          actionLabel="Open a bill card"
        />
        <WorkflowCard
          kicker="Countries"
          title="Share the disclosure boundary"
          body="Country cards keep FARA disclosure visible without pretending it proves criminal conduct."
          href={examples.find((example) => example.kind === "country")?.href ?? "/explore/countries"}
          actionLabel="Open a country card"
        />
      </section>

      <CompactRanking
        title="Ready To Share"
        subtitle="Example cases from current data."
        items={examples.map((example, index) => ({
          rank: index + 1,
          label: example.label,
          detail: example.detail,
          href: example.href,
        }))}
      />
    </main>
  );
}
