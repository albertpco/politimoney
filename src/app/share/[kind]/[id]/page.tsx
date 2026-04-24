import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShareCardSurface } from "@/components/share-card-surface";
import { getShareCardData } from "@/lib/share-cards";

export const dynamic = "force-dynamic";

type ShareCardPageProps = {
  params: Promise<{ kind: string; id: string }>;
};

export async function generateMetadata({
  params,
}: ShareCardPageProps): Promise<Metadata> {
  const { kind, id } = await params;
  const card = await getShareCardData(kind, id);

  if (!card) {
    return {
      title: "Share Card Not Found | Politired",
      description: "The requested Politired share card could not be found.",
    };
  }

  const imagePath = `${card.shareHref}/opengraph-image`;

  return {
    title: `${card.title} | Politired Share Card`,
    description: card.summary,
    alternates: {
      canonical: card.shareHref,
    },
    openGraph: {
      title: `${card.title} | Politired`,
      description: card.summary,
      url: card.shareHref,
      type: "article",
      images: [
        {
          url: imagePath,
          width: 1200,
          height: 630,
          alt: `Politired share card for ${card.title}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${card.title} | Politired`,
      description: card.summary,
      images: [imagePath],
    },
  };
}

export default async function ShareCardPage({ params }: ShareCardPageProps) {
  const { kind, id } = await params;
  const card = await getShareCardData(kind, id);

  if (!card) notFound();

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-stone-500">
            Share Surface
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
            Card-ready summary for {card.title}
          </h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={card.profileHref}
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-amber-300"
          >
            {card.profileLabel}
          </Link>
          <Link
            href="/share"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-amber-300"
          >
            More share cards
          </Link>
        </div>
      </div>

      <ShareCardSurface card={card} />
    </main>
  );
}
