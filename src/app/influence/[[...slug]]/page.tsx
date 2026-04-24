import { notFound } from "next/navigation";
import Link from "next/link";
import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
  MetricCard,
  EntityRelationshipGraph,
  FilterChips,
  ClaimCard,
  CausalityWarningBlock,
} from "@/components/ui-primitives";
import {
  getInfluenceNetworkSnapshotRepository,
  getLatestCountryInfluenceEntitiesRepository,
  getLatestOrganizationEntitiesRepository,
} from "@/lib/data/repository";
import { evidenceLinks } from "@/lib/site-data";

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

function InfluenceHub() {
  return (
    <PageLayout
      title="Influence Hub"
      subtitle="Money flows, FARA activity, foreign-connected PACs, and relationship graphs."
    >
      <SectionCard
        title="Influence routes"
        subtitle="Choose channel-specific or network-level analysis."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/influence/network"
          >
            Network view
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/influence/foreign-lobbying"
          >
            Foreign lobbying
          </Link>
          <Link
            className="rounded-lg border border-slate-200 bg-white p-3 hover:bg-slate-50"
            href="/influence/foreign-connected-pacs"
          >
            Foreign-connected PACs
          </Link>
        </div>
      </SectionCard>
    </PageLayout>
  );
}

async function NetworkPage() {
  const influenceNetworkSnapshot =
    await getInfluenceNetworkSnapshotRepository();
  return (
    <PageLayout
      title="Influence Network"
      subtitle="Node-edge exploration across entities, policy channels, and outcomes."
    >
      <SectionCard
        title="Graph filters"
        subtitle="Filter controls will be available when additional data sources are connected."
      >
        <FilterChips
          chips={[
            "Channel: FARA",
            "Channel: PAC",
            "Channel: LDA",
            "Range: 2024",
          ]}
        />
      </SectionCard>
      <EntityRelationshipGraph
        nodes={influenceNetworkSnapshot.nodes}
        edges={influenceNetworkSnapshot.edges}
      />
    </PageLayout>
  );
}

async function ForeignLobbyingPage() {
  const countryEntities = await getLatestCountryInfluenceEntitiesRepository();
  return (
    <PageLayout
      title="FARA / Foreign Influence View"
      subtitle="Registered principal and registrant channels with legal-context framing."
    >
      <SectionCard
        title="Country snapshots"
        subtitle="Government and non-government channels shown separately."
      >
        <TableExplorer
          columns={[
            "Country",
            "Principal rows",
            "Registrants",
            "Top principals",
          ]}
          rows={countryEntities.map((country) => [
            country.name,
            String(country.principalCount),
            String(country.registrantCount),
            country.topPrincipals.join(", "),
          ])}
        />
      </SectionCard>
      <SectionCard
        title="Legal boundary note"
        subtitle="Understand lobbying disclosures and election law."
      >
        <CausalityWarningBlock />
      </SectionCard>
    </PageLayout>
  );
}

async function ForeignConnectedPacsPage() {
  const organizationEntities =
    await getLatestOrganizationEntitiesRepository();
  const totalSampledPac = organizationEntities.reduce(
    (sum, org) => sum + org.cycleTotal,
    0,
  );
  return (
    <PageLayout
      title="Foreign-Connected PAC View"
      subtitle="U.S.-lawful PAC channel connected to foreign parent-company origins."
    >
      <SectionCard title="Channel summary" subtitle="Committee funding totals.">
        <MetricCard
          label="Sampled total"
          value={`$${Math.round(totalSampledPac).toLocaleString()}`}
          delta={`${organizationEntities.length} organizations`}
          period="latest data"
          quality="medium"
        />
      </SectionCard>
      <SectionCard
        title="Interpretation caveat"
        subtitle="Legal context before narrative claims."
      >
        <ClaimCard
          claim="Foreign-connected PAC pathways can represent legal indirect influence channels under current U.S. rules."
          level="high"
          evidenceCount={2}
          nonClaim="Presence in this channel does not constitute illegal foreign-national campaign donations."
          sourceLinks={evidenceLinks.slice(0, 2)}
        />
      </SectionCard>
    </PageLayout>
  );
}

export default async function InfluencePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const subsection = slug?.[0];

  if (!subsection) return <InfluenceHub />;
  if (subsection === "network") return <NetworkPage />;
  if (subsection === "foreign-lobbying") return <ForeignLobbyingPage />;
  if (subsection === "foreign-connected-pacs")
    return <ForeignConnectedPacsPage />;

  notFound();
}
