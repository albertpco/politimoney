import { getLatestStateOutcomesRepository } from "@/lib/data/repository";

export async function getLatestStatesRepository() {
  return getLatestStateOutcomesRepository();
}

export async function findStateByCodeRepository(stateCode: string) {
  const states = await getLatestStateOutcomesRepository();
  const normalized = stateCode.trim().toUpperCase();
  return (
    states.find((state) => state.stateCode.toUpperCase() === normalized) ?? null
  );
}

