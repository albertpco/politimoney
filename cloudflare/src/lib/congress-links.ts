const BILL_TYPE_SLUGS: Record<string, string> = {
  HR: "house-bill",
  HRES: "house-resolution",
  HJRES: "house-joint-resolution",
  HCONRES: "house-concurrent-resolution",
  S: "senate-bill",
  SRES: "senate-resolution",
  SJRES: "senate-joint-resolution",
  SCONRES: "senate-concurrent-resolution",
};

export function normalizeBillType(value?: string) {
  return value?.toUpperCase().replace(/[^A-Z]/g, "");
}

export function congressBillUrl({
  congress,
  billType,
  billNumber,
  billId,
}: {
  congress?: number | string;
  billType?: string;
  billNumber?: string | number;
  billId?: string;
}) {
  let nextCongress = congress ? String(congress) : "";
  let nextType = normalizeBillType(billType);
  let nextNumber = billNumber ? String(billNumber).replace(/[^0-9]/g, "") : "";

  if ((!nextCongress || !nextType || !nextNumber) && billId) {
    const match = billId.toUpperCase().match(/^(\d+)-([A-Z]+)-(\d+)$/);
    if (match) {
      nextCongress = nextCongress || match[1];
      nextType = nextType || match[2];
      nextNumber = nextNumber || match[3];
    }
  }

  const slug = nextType ? BILL_TYPE_SLUGS[nextType] : undefined;
  if (!nextCongress || !slug || !nextNumber) return null;
  return `https://www.congress.gov/bill/${nextCongress}th-congress/${slug}/${nextNumber}`;
}
