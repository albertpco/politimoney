import {
  PageTitle,
  CoverageStatusBar,
  UtilityRail,
  SectionCard,
  TableExplorer,
} from "@/components/ui-primitives";
import { instrumentationEvents } from "@/lib/site-data";

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

export default function InstrumentationPage() {
  return (
    <PageLayout
      title="Instrumentation Event Catalog"
      subtitle="UI analytics events used to measure civic value outcomes."
    >
      <SectionCard
        title="Event list"
        subtitle="Events with sources, dates, and context."
      >
        <TableExplorer
          columns={["Event", "Purpose"]}
          rows={instrumentationEvents.map((event) => [
            event,
            "Tracked in UI analytics layer",
          ])}
        />
      </SectionCard>
    </PageLayout>
  );
}
