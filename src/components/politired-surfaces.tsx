import Link from "next/link";

export function QueryHero({
  title,
  subtitle,
  examples,
}: {
  title: string;
  subtitle: string;
  examples: Array<{ label: string; href: string }>;
}) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-[var(--civic)] bg-[var(--civic)] px-6 py-8 text-white shadow-[var(--shadow-lift)] sm:px-8">
      <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#ffffff,var(--accent-soft),var(--danger-soft))]" />
      <div className="absolute bottom-0 right-0 h-40 w-2/3 bg-[linear-gradient(135deg,transparent,rgba(255,255,255,0.10))]" />
      <div className="relative space-y-6">
        <div className="space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--accent-soft)]">
            Political Money, Without The Spin
          </p>
          <h1 className="max-w-4xl text-4xl font-black text-white sm:text-5xl">
            {title}
          </h1>
          <p className="max-w-3xl text-base leading-7 text-slate-100">{subtitle}</p>
        </div>
        <form
          action="/search"
          className="flex flex-col gap-3 rounded-md border border-white/25 bg-white/10 p-4 backdrop-blur sm:flex-row sm:items-center"
        >
          <input
            name="q"
            placeholder="Rank PACs by receipts, compare states on poverty, find a member's funding profile"
            className="min-w-0 flex-1 rounded-md border border-white/30 bg-white px-4 py-3 text-sm text-slate-950 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-[var(--accent-soft)]"
          />
          <button
            type="submit"
            className="rounded-md bg-white px-5 py-3 text-sm font-black text-[var(--civic)] hover:bg-[var(--accent-soft)]"
          >
            Ask PolitiMoney
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {examples.map((example) => (
            <Link
              key={example.href}
              href={example.href}
              className="rounded-md border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20"
            >
              {example.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function WorkflowCard({
  kicker,
  title,
  body,
  href,
  actionLabel,
}: {
  kicker: string;
  title: string;
  body: string;
  href: string;
  actionLabel: string;
}) {
  return (
    <Link
      href={href}
      className="pt-card group flex h-full flex-col justify-between p-5 transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:shadow-[var(--shadow-lift)]"
    >
      <div className="space-y-3">
        <p className="pt-kicker">
          {kicker}
        </p>
        <h3 className="pt-title text-lg">{title}</h3>
        <p className="pt-muted text-sm leading-6">{body}</p>
      </div>
      <p className="mt-6 text-sm font-semibold text-[var(--accent-strong)] transition group-hover:text-slate-950">
        {actionLabel}
      </p>
    </Link>
  );
}

export function SignalTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="pt-card p-4">
      <p className="pt-kicker">
        {label}
      </p>
      <p className="pt-title mt-2 text-3xl">{value}</p>
      <p className="pt-muted mt-2 text-xs leading-5">{note}</p>
    </div>
  );
}

export function CompactRanking({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: Array<{ rank: number; label: string; detail: string; href?: string; rawValue?: number }>;
}) {
  const maxValue = Math.max(...items.map((i) => i.rawValue ?? 0), 1);

  return (
    <section className="pt-card p-5">
      <header className="mb-4 space-y-1">
        <h3 className="pt-title text-lg">{title}</h3>
        <p className="pt-muted text-sm">{subtitle}</p>
      </header>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = item.rawValue ? Math.max((item.rawValue / maxValue) * 100, 4) : 0;
          const content = (
            <div className="relative overflow-hidden rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3">
              {pct > 0 ? (
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--accent-soft)]"
                  style={{ width: `${pct}%` }}
                />
              ) : null}
              <div className="relative flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--civic)] text-xs font-semibold text-white">
                  {item.rank}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-950">{item.label}</p>
                  <p className="pt-muted text-xs">{item.detail}</p>
                </div>
              </div>
            </div>
          );

          return item.href ? (
            <Link key={`${title}-${item.rank}-${item.label}`} href={item.href} className="block">
              {content}
            </Link>
          ) : (
            <div key={`${title}-${item.rank}-${item.label}`}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}

export function ProfileBanner({
  eyebrow,
  title,
  subtitle,
  badges,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  badges: string[];
}) {
  return (
    <section className="pt-card p-6">
      <div className="space-y-3">
        <p className="pt-kicker">
          {eyebrow}
        </p>
        <h1 className="pt-title text-3xl sm:text-4xl">
          {title}
        </h1>
        <p className="pt-muted max-w-3xl text-sm leading-6">{subtitle}</p>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge}
            className="pt-badge px-3 py-1 text-xs text-slate-700"
          >
            {badge}
          </span>
        ))}
      </div>
    </section>
  );
}

export function FactCheckPanel({
  title,
  summary,
  dataPoints,
  href,
  actionLabel = "Open record",
  visual,
}: {
  title: string;
  summary: string;
  dataPoints: string[];
  href?: string;
  actionLabel?: string;
  visual?: React.ReactNode;
}) {
  const body = (
    <section className="pt-card p-5">
      <div className="space-y-3">
        <p className="pt-kicker">
          Data Context
        </p>
        <h3 className="pt-title text-lg">{title}</h3>
        {visual}
        <p className="pt-muted text-sm leading-6">{summary}</p>
        <ul className="pt-muted space-y-2 text-xs">
          {dataPoints.map((point) => (
            <li key={point} className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-2">
              {point}
            </li>
          ))}
        </ul>
        {href ? (
          <p className="text-sm font-bold text-[var(--source)]">
            {actionLabel} <span aria-hidden="true">-&gt;</span>
          </p>
        ) : null}
      </div>
    </section>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

export function AiHandoffPanel({
  prompt,
}: {
  prompt: string;
}) {
  const encoded = encodeURIComponent(prompt);
  const links = [
    {
      label: "ChatGPT",
      href: `https://chatgpt.com/?q=${encoded}`,
      note: "Open with this evidence prompt.",
    },
    {
      label: "Claude",
      href: `https://claude.ai/new?q=${encoded}`,
      note: "Open a new Claude chat.",
    },
    {
      label: "Gemini",
      href: "https://gemini.google.com/app",
      note: "Open Gemini and use the prompt below.",
    },
  ];

  return (
    <div className="pt-card p-5">
      <p className="pt-kicker">Bring Your Own LLM</p>
      <h3 className="pt-title mt-2 text-lg">Chat with ChatGPT, Claude, or Gemini</h3>
      <p className="pt-muted mt-2 text-sm leading-6">
        Use PolitiMoney as the evidence layer, then ask another model to reason over the public-record question.
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-[var(--line)] bg-[var(--surface-soft)] px-3 py-3 text-sm font-bold text-slate-950 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-white"
          >
            {link.label}
            <span className="pt-muted mt-1 block text-xs font-normal">{link.note}</span>
          </a>
        ))}
      </div>
      <details className="mt-4 rounded-md border border-[var(--line)] bg-white px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold text-slate-700">
          View neutral prompt
        </summary>
        <p className="pt-muted mt-2 whitespace-pre-wrap text-xs leading-5">{prompt}</p>
      </details>
    </div>
  );
}
