import { redirect } from "next/navigation";
import {
  getCandidateMemberCrosswalkRepository,
  getLatestCongressMembersRepository,
} from "@/lib/data/repository";
import type { CandidateMemberCrosswalk } from "@/lib/ingest/types";

type ExploreLegacyPageProps = {
  params: Promise<{ slug?: string[] }>;
};

function normalizeSegment(value: string): string {
  return value.trim().toLowerCase();
}

function resolveMemberId(
  rawId: string,
  crosswalkRows: CandidateMemberCrosswalk[],
): string {
  const normalized = normalizeSegment(rawId);
  const match = crosswalkRows.find(
    (row) =>
      normalizeSegment(row.bioguideId) === normalized ||
      normalizeSegment(row.candidateId) === normalized,
  );
  return match ? normalizeSegment(match.bioguideId) : normalized;
}

function buildSearchRedirect(slug: string[]): string {
  const query = slug.slice(1).filter(Boolean).join(" ").trim();
  return query ? `/search?q=${encodeURIComponent(query)}` : "/search";
}

export default async function ExploreLegacyRedirect({
  params,
}: ExploreLegacyPageProps) {
  const { slug } = await params;
  const path = (slug ?? []).filter(Boolean).map(normalizeSegment);

  if (!path.length) {
    redirect("/search");
  }

  const [section, detail, ...rest] = path;
  if (rest.length > 0) {
    redirect(buildSearchRedirect(path));
  }

  if (section === "members" || section === "senators") {
    if (!detail) redirect("/members");
    const members = await getLatestCongressMembersRepository();
    const memberIds = new Set(members.map((member) => normalizeSegment(member.bioguideId)));
    if (memberIds.has(detail)) {
      redirect(`/members/${detail}`);
    }
    const crosswalkRows = await getCandidateMemberCrosswalkRepository();
    const resolvedId = resolveMemberId(detail, crosswalkRows);
    if (resolvedId !== detail) {
      redirect(`/members/${resolvedId}`);
    }
    redirect(`/search?q=${encodeURIComponent(detail)}`);
  }

  if (section === "organizations" || section === "pacs" || section === "committees") {
    redirect(detail ? `/pacs/${encodeURIComponent(detail)}` : "/pacs");
  }

  if (section === "bills") {
    redirect(detail ? `/bills/${encodeURIComponent(detail)}` : "/bills");
  }

  if (section === "states") {
    redirect(detail ? `/states/${encodeURIComponent(detail)}` : "/states");
  }

  if (section === "donors") {
    redirect(detail ? `/donors/${encodeURIComponent(detail)}` : "/donors");
  }

  if (section === "countries") {
    redirect(detail ? `/countries/${encodeURIComponent(detail)}` : "/countries");
  }

  if (section === "lobbying") {
    redirect(detail ? `/lobbying/${encodeURIComponent(detail)}` : "/lobbying");
  }

  if (section === "contracts" || section === "contractors") {
    redirect(detail ? `/contracts/${encodeURIComponent(detail)}` : "/contracts");
  }

  if (section === "insider-trades") {
    redirect(detail ? `/insider-trades/${encodeURIComponent(detail)}` : "/insider-trades");
  }

  if (section === "congress-trades") {
    redirect("/congress-trades");
  }

  redirect(buildSearchRedirect(path));
}
