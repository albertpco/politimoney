import type { ReactNode } from "react";

export function CaveatPanel({
  title = "What this does not prove",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm text-slate-950">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 space-y-2 leading-6 text-slate-800">{children}</div>
    </section>
  );
}
