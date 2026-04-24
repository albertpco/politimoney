import { NextResponse } from "next/server";
import { readLatestArtifacts, readLatestSummary } from "@/lib/ingest/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const [summary, artifacts] = await Promise.all([
    readLatestSummary(),
    readLatestArtifacts(),
  ]);

  if (!summary || !artifacts) {
    return NextResponse.json(
      {
        ok: false,
        message: "No ingestion snapshot available yet.",
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    summary,
    preview: {
      fecCandidates: artifacts.fec.candidates.slice(0, 5),
      fecContributions: artifacts.fec.contributions.slice(0, 5),
      faraRegistrants: artifacts.fara.registrants.slice(0, 5),
      faraForeignPrincipals: artifacts.fara.foreignPrincipals.slice(0, 5),
      bills: artifacts.congress.bills.slice(0, 5),
      congressMembers: artifacts.congress.members.slice(0, 5),
      outcomes: artifacts.outcomes.states.slice(0, 5),
    },
  });
}
