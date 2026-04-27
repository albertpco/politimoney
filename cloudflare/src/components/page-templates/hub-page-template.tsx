import Link from "../link";
import type { ReactNode } from "react";
import { PageScaffold } from "./page-scaffold";

export function HubPageTemplate({
  title,
  subtitle,
  cards,
  sidebar,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  cards: Array<{
    title: string;
    description?: string;
    href: string;
    actionLabel?: string;
  }>;
  sidebar?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <PageScaffold title={title} subtitle={subtitle} sidebar={sidebar} eyebrow={eyebrow}>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={`${card.href}-${card.title}`}
            href={card.href}
            className="pt-card group flex h-full flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow-lift)]"
          >
            <div className="space-y-2">
              <h2 className="pt-title text-base">{card.title}</h2>
              {card.description ? (
                <p className="pt-muted text-sm leading-6">{card.description}</p>
              ) : null}
            </div>
            <p className="mt-6 text-sm font-semibold text-[var(--accent-strong)] transition group-hover:text-slate-950">
              {card.actionLabel ?? "Open"}
            </p>
          </Link>
        ))}
      </section>
    </PageScaffold>
  );
}
