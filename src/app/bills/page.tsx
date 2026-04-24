import Link from "next/link";
import { DirectoryPageTemplate } from "@/components/page-templates";
import { getLatestBillsRepository } from "@/lib/data/bill-repository";

export const revalidate = 3600;

function billLabel(billType: string, billNumber: string): string {
  return `${billType.toUpperCase()} ${billNumber}`;
}

function billRoute(billId: string): string {
  return `/bills/${billId.toLowerCase()}`;
}

export default async function BillsPage() {
  const bills = await getLatestBillsRepository();

  return (
    <DirectoryPageTemplate
      eyebrow="Public record"
      title="Bills"
      subtitle={`${bills.length} bills in the current dataset, ordered by latest action.`}
      columns={[
        { header: "Bill" },
        { header: "Title" },
        { header: "Sponsor" },
        { header: "Latest action" },
        { header: "Profile" },
      ]}
      rows={bills.map((bill) => [
        billLabel(bill.billType, bill.billNumber),
        bill.title,
        bill.sponsor || "Unknown sponsor",
        bill.status,
        <Link
          key={bill.id}
          className="font-semibold text-stone-900 underline decoration-dotted underline-offset-2"
          href={billRoute(bill.id)}
        >
          Open
        </Link>,
      ])}
      emptyState="No bills are available in the current dataset."
      actions={
        <div className="rounded-[1.25rem] border border-stone-200 bg-[linear-gradient(160deg,#fdfbf6_0%,#fff7ed_100%)] p-4 text-sm text-stone-700 shadow-sm">
          Start from a bill number or title, then open the profile for sponsorship and vote context.
        </div>
      }
    />
  );
}
