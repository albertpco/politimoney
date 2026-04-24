import { notFound } from "next/navigation";

/**
 * Catch-all fallback route.
 *
 * All content sections have been extracted to dedicated App Router pages:
 *   /bills, /members, /pacs, /states, /votes, /search,
 *   /donors, /lobbying, /contracts, /countries, /insider-trades, /congress-trades,
 *   /compare, /influence, /outcomes, /briefs, /methodology, /data-coverage,
 *   /instrumentation
 *
 * Legacy /explore/* routes are handled by the redirect layer at /explore/[[...slug]].
 * Any unmatched path reaches here and returns a 404.
 */

export default async function CatchAllPage() {
  notFound();
}
