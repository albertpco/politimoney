import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Link from "../components/link";
import { ProvenancePanel } from "../components/page-templates";
import {
  PageTitle,
  CoverageStatusBar,
  SectionCard,
  ClaimCard,
  UtilityRail,
} from "../components/ui-primitives";
import { loadCongressTrade, type CongressTradeDetail } from "../lib/feed";

function transactionLabel(t: string | undefined): string {
  if (!t) return "—";
  const lower = t.toLowerCase();
  if (lower.includes("purchase") || lower === "p") return "Purchase";
  if (lower.includes("sale") || lower === "s") return "Sale";
  if (lower.includes("exchange") || lower === "e") return "Exchange";
  return t;
}

export function CongressTradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CongressTradeDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    loadCongressTrade(id)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load trade");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (error) {
    return (
      <main className="space-y-4">
        <SectionCard title="Trade not found" subtitle={error}>
          <Link className="pt-link" href="/congress-trades">Back to congressional trades</Link>
        </SectionCard>
      </main>
    );
  }
  if (!data) {
    return <p className="pt-muted">Loading trade record…</p>;
  }

  const trade = data.trade;
  const title = `${trade.ticker ?? trade.assetName ?? "Trade"} · ${transactionLabel(trade.transactionType ?? trade.transactionLabel)}`;
  const subtitle = `${trade.memberName ?? "Unknown filer"}${trade.chamber ? ` · ${trade.chamber === "S" ? "Senate" : "House"}` : ""}${trade.state ? ` · ${trade.state}${trade.district ? `-${trade.district}` : ""}` : ""}`;

  const sourceLinks = trade.documentUrl
    ? [{ label: "Filing PDF", href: trade.documentUrl }]
    : [{ label: "House STOCK Act disclosures", href: "https://disclosures-clerk.house.gov/" }];

  return (
    <div className="flex gap-4">
      <main className="min-w-0 flex-1 space-y-4">
        <PageTitle title={title} subtitle={subtitle} />
        <CoverageStatusBar freshness="Latest ingestion cycle" quality="medium" />

        <div className="grid gap-4">
          <ProvenancePanel
            title="Trade provenance"
            backend="static-feed"
            runId={undefined}
            freshness="Latest public STOCK Act disclosure snapshot"
            coverage="House and Senate STOCK Act periodic transaction reports parsed from public PDF filings."
            sourceSystems={["House Clerk PTR PDFs", "Senate eFD"]}
            notes="Amount values are reported ranges, not exact transaction values."
          />
        </div>

        <SectionCard title="Trade details" subtitle="Fields parsed from the source filing.">
          <dl className="grid gap-3 text-sm text-stone-700 md:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Filer</dt>
              <dd className="mt-1">
                {trade.bioguideId ? (
                  <Link className="pt-link" href={`/members/${trade.bioguideId.toLowerCase()}`}>
                    {trade.memberName ?? trade.bioguideId}
                  </Link>
                ) : (
                  trade.memberName ?? "Unknown"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Asset</dt>
              <dd className="mt-1">{trade.assetName ?? trade.ticker ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Ticker</dt>
              <dd className="mt-1">{trade.ticker ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Asset type</dt>
              <dd className="mt-1">{trade.assetType ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Transaction</dt>
              <dd className="mt-1">{transactionLabel(trade.transactionType ?? trade.transactionLabel)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Amount range</dt>
              <dd className="mt-1">{trade.amountRange ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Transaction date</dt>
              <dd className="mt-1">{trade.transactionDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Notification date</dt>
              <dd className="mt-1">{trade.notificationDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Filing date</dt>
              <dd className="mt-1">{trade.filingDate ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Source</dt>
              <dd className="mt-1">{trade.source ?? "—"}</dd>
            </div>
          </dl>
          {trade.documentUrl ? (
            <p className="mt-4 text-sm">
              <a className="pt-link" href={trade.documentUrl} target="_blank" rel="noopener noreferrer">
                View original filing PDF →
              </a>
            </p>
          ) : null}
        </SectionCard>

        <ClaimCard
          claim={`${trade.memberName ?? "A member"} disclosed a ${transactionLabel(trade.transactionType ?? trade.transactionLabel).toLowerCase()} of ${trade.assetName ?? trade.ticker ?? "an asset"}${trade.amountRange ? ` (${trade.amountRange})` : ""}${trade.transactionDate ? ` on ${trade.transactionDate}` : ""}.`}
          level="medium"
          evidenceCount={sourceLinks.length}
          nonClaim="STOCK Act disclosures are routine filings. They do not on their own establish illegal trading or insider knowledge."
          sourceLinks={sourceLinks}
        />

        <SectionCard title="Next step" subtitle="Browse more trades or the filer's profile.">
          <div className="flex flex-wrap gap-3">
            <Link href="/congress-trades" className="pt-button-secondary px-4 py-2 text-sm">Back to trades</Link>
            {trade.bioguideId ? (
              <Link href={`/members/${trade.bioguideId.toLowerCase()}`} className="pt-button-primary px-4 py-2 text-sm">
                Open member profile
              </Link>
            ) : null}
          </div>
        </SectionCard>
      </main>
      <UtilityRail />
    </div>
  );
}

export default CongressTradeDetailPage;
