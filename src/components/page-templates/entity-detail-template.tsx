import type { ReactNode } from "react";
import { PageScaffold } from "./page-scaffold";

export function EntityDetailTemplate({
  title,
  subtitle,
  summary,
  children,
  sidebar,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  summary?: ReactNode;
  children: ReactNode;
  sidebar?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <PageScaffold title={title} subtitle={subtitle} sidebar={sidebar} eyebrow={eyebrow}>
      {summary ? (
        <section className="pt-panel p-5">
          {summary}
        </section>
      ) : null}
      {children}
    </PageScaffold>
  );
}
