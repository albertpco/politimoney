import { notFound } from "next/navigation";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
  ClaimCard,
  FilterChips,
} from "@/components/ui-primitives";
import { briefs, evidenceLinks } from "@/lib/site-data";

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

function BriefsHub() {
  return (
    <PageLayout
      title="Brief Library"
      subtitle="Public explainers with source rails and non-claim sections."
    >
      <SectionCard
        title="Available briefs"
        subtitle="Open any brief route for claim-level traceability."
      >
        <TableExplorer
          columns={["Title", "Type", "Summary", "Route"]}
          rows={briefs.map((brief) => [
            brief.title,
            brief.type,
            brief.summary,
            `/briefs/${brief.slug}`,
          ])}
        />
      </SectionCard>
    </PageLayout>
  );
}

function BriefDetail({ brief }: { brief: (typeof briefs)[number] }) {
  return (
    <PageLayout
      title={brief.title}
      subtitle="Narrative brief with confidence labels, source rails, and uncertainty disclosures."
    >
      <SectionCard title="Executive summary" subtitle={brief.type}>
        <p className="text-sm text-slate-700">{brief.summary}</p>
      </SectionCard>
      <SectionCard
        title="Claim cards"
        subtitle="All major assertions include non-claim text."
      >
        <ClaimCard
          claim="This brief summarizes public filings and documented entity relationships from the current dataset."
          level="medium"
          evidenceCount={4}
          nonClaim="This brief does not claim criminal conduct without direct, documented legal findings."
          sourceLinks={evidenceLinks}
        />
      </SectionCard>
      <SectionCard
        title="Unknowns and boundary conditions"
        subtitle="Speculation controls."
      >
        <FilterChips
          chips={[
            "Unknown: private channel effects",
            "Unknown: counterfactual policy outcomes",
            "Boundary: legal vs illegal channels separated",
          ]}
        />
      </SectionCard>
    </PageLayout>
  );
}

export default async function BriefsPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <BriefsHub />;

  const brief = briefs.find((entry) => entry.slug === subsection);
  if (!brief) notFound();

  return <BriefDetail brief={brief} />;
}
