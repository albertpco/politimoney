import Link from "../link";
import type { ReactNode } from "react";

type ProvenanceLink = {
  label: string;
  href: string;
  external?: boolean;
};

function renderLink(link: ProvenanceLink) {
  if (link.external || link.href.startsWith("http://") || link.href.startsWith("https://")) {
    return (
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        className="pt-link"
      >
        {link.label}
      </a>
    );
  }

  return <Link className="pt-link" href={link.href}>{link.label}</Link>;
}

export function ProvenancePanel({
  freshness,
  coverage,
  runId,
  backend,
  sourceSystems,
  sourceLinks,
  notes,
  title = "Provenance",
}: {
  freshness?: string;
  coverage?: string;
  runId?: string;
  backend?: string;
  sourceSystems?: string[];
  sourceLinks?: ProvenanceLink[];
  notes?: ReactNode;
  title?: string;
}) {
  return (
    <section className="pt-card p-4">
      <div className="space-y-2">
        <h3 className="pt-title text-sm">{title}</h3>
        <dl className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
          {freshness ? (
            <div>
              <dt className="pt-kicker">
                Freshness
              </dt>
              <dd className="mt-1">{freshness}</dd>
            </div>
          ) : null}
          {coverage ? (
            <div>
              <dt className="pt-kicker">
                Coverage
              </dt>
              <dd className="mt-1">{coverage}</dd>
            </div>
          ) : null}
          {backend ? (
            <div>
              <dt className="pt-kicker">
                Backend
              </dt>
              <dd className="mt-1">{backend}</dd>
            </div>
          ) : null}
          {runId ? (
            <div>
              <dt className="pt-kicker">
                Run
              </dt>
              <dd className="mt-1">{runId}</dd>
            </div>
          ) : null}
        </dl>
        {sourceSystems?.length ? (
          <div>
            <p className="pt-kicker">
              Source systems
            </p>
            <p className="pt-muted mt-1 text-sm leading-6">{sourceSystems.join(", ")}</p>
          </div>
        ) : null}
        {sourceLinks?.length ? (
          <div>
            <p className="pt-kicker">
              Sources
            </p>
            <ul className="mt-2 space-y-1 text-sm">
              {sourceLinks.map((link) => (
                <li key={`${link.label}-${link.href}`}>{renderLink(link)}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {notes ? <div className="pt-muted text-sm leading-6">{notes}</div> : null}
      </div>
    </section>
  );
}
