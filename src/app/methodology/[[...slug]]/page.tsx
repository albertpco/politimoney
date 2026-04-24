import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
  TimelineRail,
  CausalityWarningBlock,
} from "@/components/ui-primitives";
import { proofLadder } from "@/lib/site-data";

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

function MethodologyHub() {
  return (
    <PageLayout
      title="Methodology Hub"
      subtitle="Proof ladder, legal context, causality rules, and limitations."
    >
      <SectionCard
        title="Method pages"
        subtitle="Open one of the methodology routes for details."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/methodology/proof-ladder"
          >
            Proof ladder
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/methodology/limitations"
          >
            Limitations and non-claims
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/methodology/legal-context"
          >
            Legal context
          </Link>
        </div>
      </SectionCard>
      <SectionCard
        title="Civic outcomes and use-case ranking"
        subtitle="Framework for measuring civic impact."
      >
        <TableExplorer
          columns={["Outcome", "Priority", "Validation signal"]}
          rows={[
            [
              "Understanding and clarity",
              "P0",
              "User can explain influence pathways in plain language",
            ],
            [
              "Accountability",
              "P0",
              "User can trace claims to source filings",
            ],
            [
              "Agency and actionability",
              "P1",
              "Higher rates of compare/share/action steps",
            ],
            [
              "Trust quality",
              "P1",
              "Confidence rises while uncertainty awareness remains high",
            ],
            [
              "Inclusion across low-information users",
              "P1",
              "Comprehension parity across user segments",
            ],
          ]}
        />
      </SectionCard>
      <SectionCard
        title="Value validation phase design"
        subtitle="Testing standards before major updates."
      >
        <TimelineRail
          events={[
            {
              date: "Phase 1",
              title: "Comprehension baseline and quick-check flows",
              detail:
                "Measure understanding lift from senator and state profile interactions.",
            },
            {
              date: "Phase 2",
              title: "Influence brief validation",
              detail:
                "Test whether evidence rails reduce unsupported speculation in country cases.",
            },
            {
              date: "Phase 3",
              title: "Actionability and trust checks",
              detail:
                "Track evidence-trace completion, compare saves, and brief sharing rates.",
            },
          ]}
        />
      </SectionCard>
    </PageLayout>
  );
}

function ProofLadderPage() {
  return (
    <PageLayout
      title="Proof Ladder"
      subtitle="Evidence hierarchy used to grade public claims and avoid overreach."
      quality="high"
    >
      <SectionCard
        title="Five-level evidence standard"
        subtitle="Claims must identify highest passed level."
      >
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-700">
          {proofLadder.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SectionCard>
    </PageLayout>
  );
}

function LimitationsPage() {
  return (
    <PageLayout
      title="Limitations and Non-Claims"
      subtitle="Guardrails for sensitive narratives and incomplete datasets."
    >
      <SectionCard
        title="Core limitations"
        subtitle="Included by default on influence pages."
      >
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Entity linkage does not establish causation.</li>
          <li>Coverage gaps can delay or obscure full pathways.</li>
          <li>
            Country-level analysis cannot be generalized to communities or
            identities.
          </li>
        </ul>
      </SectionCard>
      <CausalityWarningBlock />
    </PageLayout>
  );
}

function LegalContextPage() {
  return (
    <PageLayout
      title="Legal Context"
      subtitle="High-level legal baselines used for claim interpretation."
    >
      <TableExplorer
        columns={["Domain", "Baseline", "Interpretation note"]}
        rows={[
          [
            "FEC campaign law",
            "Foreign nationals cannot contribute or spend in elections",
            "Separate legal channels must be distinguished from violations.",
          ],
          [
            "Foreign-connected PACs",
            "U.S.-staffed subsidiary PAC channels may be legal",
            "Legal status depends on governance and contribution rules.",
          ],
          [
            "FARA",
            "Registered foreign influence disclosure channel",
            "Includes policy, trade, tourism, and opinion activity.",
          ],
        ]}
      />
    </PageLayout>
  );
}

export default async function MethodologyPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <MethodologyHub />;
  if (subsection === "proof-ladder") return <ProofLadderPage />;
  if (subsection === "limitations") return <LimitationsPage />;
  if (subsection === "legal-context") return <LegalContextPage />;

  notFound();
}
