import {
  getLatestCongressMembersRepository,
  getLatestSenatorEntitiesRepository,
} from "@/lib/data/repository";

export async function getLatestMembersRepository() {
  return getLatestCongressMembersRepository();
}

export async function getLatestSenatorsRepository() {
  return getLatestSenatorEntitiesRepository();
}

export async function findMemberByBioguideIdRepository(bioguideId: string) {
  const members = await getLatestCongressMembersRepository();
  const normalized = bioguideId.trim().toLowerCase();
  return (
    members.find((member) => member.bioguideId.toLowerCase() === normalized) ?? null
  );
}

