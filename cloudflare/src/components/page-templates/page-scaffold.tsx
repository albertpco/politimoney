import type { ReactNode } from "react";

export function PageScaffold({
  title,
  subtitle,
  children,
  sidebar,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  sidebar?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <main className="min-w-0 flex-1 space-y-5">
        <header className="border-b border-[var(--line)] pb-4">
          {eyebrow ? (
            <p className="pt-kicker">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="pt-title mt-2 text-3xl">{title}</h1>
          {subtitle ? <p className="pt-muted mt-2 max-w-3xl text-sm leading-6">{subtitle}</p> : null}
        </header>
        {children}
      </main>
      {sidebar ? <aside className="hidden w-80 shrink-0 xl:block">{sidebar}</aside> : null}
    </div>
  );
}
