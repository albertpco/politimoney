import { NextResponse } from "next/server";
import { runIngestionPipeline } from "@/lib/ingest/pipeline";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const summary = await runIngestionPipeline();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown ingestion failure",
      },
      { status: 500 },
    );
  }
}
