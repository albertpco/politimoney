import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-semibold text-slate-900">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The requested route is not currently mapped in the public web v1 information architecture.
      </p>
      <div className="mt-4 flex justify-center gap-3">
        <Link href="/" className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
          Go Home
        </Link>
        <Link
          href="/search"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          Search
        </Link>
      </div>
    </div>
  );
}
