import {
  getCommitteeRecipientsRepository,
  getFundingProfileRepository,
  getLatestOrganizationEntitiesRepository,
} from "@/lib/data/repository";

export async function getLatestCommitteesRepository() {
  return getLatestOrganizationEntitiesRepository();
}

export async function findCommitteeByIdRepository(committeeId: string) {
  const committees = await getLatestOrganizationEntitiesRepository();
  const normalized = committeeId.trim().toLowerCase();
  return (
    committees.find(
      (committee) =>
        committee.committeeId.toLowerCase() === normalized ||
        committee.id.toLowerCase() === normalized,
    ) ?? null
  );
}

export { getCommitteeRecipientsRepository, getFundingProfileRepository };

