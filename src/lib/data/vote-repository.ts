import {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getHouseVoteMemberVotesRepository,
  getLatestHouseVotesRepository as getLatestHouseVotesRepositoryBase,
  getLatestSenateVotesRepository as getLatestSenateVotesRepositoryBase,
  getSenateVoteMemberVotesRepository,
} from "@/lib/data/repository";

export async function getLatestHouseVotesRepository(limit?: number) {
  return getLatestHouseVotesRepositoryBase(limit);
}

export async function getLatestSenateVotesRepository(limit?: number) {
  return getLatestSenateVotesRepositoryBase(limit);
}

export async function findHouseVoteByIdRepository(voteId: string) {
  const votes = await getLatestHouseVotesRepositoryBase();
  const normalized = voteId.trim().toLowerCase();
  return votes.find((vote) => vote.voteId.toLowerCase() === normalized) ?? null;
}

export async function findSenateVoteByIdRepository(voteId: string) {
  const votes = await getLatestSenateVotesRepositoryBase();
  const normalized = voteId.trim().toLowerCase();
  return votes.find((vote) => vote.voteId.toLowerCase() === normalized) ?? null;
}

export {
  analyzeHouseVoteFundingRepository,
  analyzeSenateVoteFundingRepository,
  getHouseVoteMemberVotesRepository,
  getSenateVoteMemberVotesRepository,
};
