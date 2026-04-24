import Link from "next/link";
import type { ShareCardData } from "@/lib/share-cards";

export function ShareCardSurface({ card }: { card: ShareCardData }) {
  return (
    <article className="pt-card relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,var(--civic),var(--accent),var(--danger))]" />
      <div className="relative space-y-6">
        <header className="space-y-3">
          <p className="pt-kicker">
            {card.eyebrow}
          </p>
          <div className="space-y-2">
            <h1 className="pt-title max-w-4xl text-4xl sm:text-5xl">
              {card.title}
            </h1>
            <p className="pt-muted text-sm font-semibold uppercase tracking-[0.12em]">
              {card.subtitle}
            </p>
          </div>
          <p className="pt-muted max-w-3xl text-base leading-7">{card.summary}</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {card.stats.map((stat) => (
            <div
              key={stat.label}
              className="pt-card p-4"
            >
              <p className="pt-kicker">
                {stat.label}
              </p>
              <p className="pt-title mt-2 text-2xl">
                {stat.value}
              </p>
            </div>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
          <div className="pt-card p-5">
            <p className="pt-kicker">
              What The Card Says
            </p>
            <ul className="pt-muted mt-4 space-y-3 text-sm leading-6">
              {card.bullets.map((bullet) => (
                <li
                  key={bullet}
                  className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-4 py-3"
                >
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-md border border-[var(--civic)] bg-[var(--civic)] p-5 text-white shadow-[var(--shadow-card)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
              Share Rules
            </p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-100">
              <p>The card is opinion-free by design. It states what the current public record shows.</p>
              <p>Use the canonical profile page when someone needs the detailed data, tables, or vote context behind the card.</p>
              <p>The legal and causality guardrails still apply after the image gets shared.</p>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={card.profileHref}
                className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
              >
                {card.profileLabel}
              </Link>
              <Link
                href="/methodology"
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Read methodology
              </Link>
            </div>
          </div>
        </section>

        <footer className="pt-muted flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] pt-4 text-xs">
          <p>Politired share card · public records, normalized for plain-English sharing.</p>
          <p>{card.shareHref}</p>
        </footer>
      </div>
    </article>
  );
}
