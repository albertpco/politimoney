import { getLatestBillEntitiesRepository } from "@/lib/data/repository";

export async function getLatestBillsRepository() {
  return getLatestBillEntitiesRepository();
}

export async function findBillByIdRepository(billId: string) {
  const bills = await getLatestBillEntitiesRepository();
  const normalized = billId.trim().toLowerCase();
  return bills.find((bill) => bill.id.toLowerCase() === normalized) ?? null;
}

