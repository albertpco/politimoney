import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  readCongressBills,
  readCongressMembers,
  readFundingReadModels,
  readHouseVoteMemberVotes,
  readHouseVotes,
  readLatestSummary,
  readOutcomeStates,
  readSenateVoteMemberVotes,
  readSenateVotes,
  readVoteFundingSummaries,
} from "@/lib/ingest/storage";

type FeedEntry = {
  id: string;
  label: string;
  href: string;
  datasetPath: string;
  summary?: string;
  amount?: number;
  tags?: string[];
};

type FeedManifest = {
  schemaVersion: 1;
  generatedAt: string;
  runId?: string;
  source: {
    kind: "public-record-read-models";
    note: string;
  };
  datasets: Record<
    string,
    {
      path: string;
      count: number;
      description: string;
    }
  >;
  caveats: string[];
};

const OUT_DIR = path.resolve(
  process.env.POLITIMONEY_FEED_OUT_DIR ??
    process.env.POLITIRED_FEED_OUT_DIR ??
    path.join(process.cwd(), "dist", "public-feed", "latest"),
);

function safeSegment(value: string | number): string {
  return encodeURIComponent(String(value).trim().toLowerCase());
}

async function writeJson(relativePath: string, payload: unknown) {
  const filePath = path.join(OUT_DIR, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function memberName(member: { name?: string; firstName?: string; lastName?: string; bioguideId: string }) {
  return member.name ?? `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() ?? member.bioguideId;
}

async function main() {
  const [
    summary,
    funding,
    voteFunding,
    members,
    bills,
    houseVotes,
    senateVotes,
    houseMemberVotes,
    senateMemberVotes,
    states,
  ] = await Promise.all([
    readLatestSummary(),
    readFundingReadModels(),
    readVoteFundingSummaries(),
    readCongressMembers(),
    readCongressBills(),
    readHouseVotes(),
    readSenateVotes(),
    readHouseVoteMemberVotes(),
    readSenateVoteMemberVotes(),
    readOutcomeStates(),
  ]);

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const profileByMember = new Map(
    (funding?.profiles ?? [])
      .filter((profile) => profile.entityType === "member")
      .map((profile) => [profile.entityId.toLowerCase(), profile]),
  );
  const committeeProfiles = (funding?.profiles ?? []).filter(
    (profile) => profile.entityType === "committee",
  );

  const memberIndex: FeedEntry[] = members.map((member) => {
    const id = safeSegment(member.bioguideId);
    const profile = profileByMember.get(member.bioguideId.toLowerCase());
    return {
      id: member.bioguideId,
      label: memberName(member),
      href: `/members/${id}`,
      datasetPath: `members/${id}.json`,
      summary: `${member.partyCode ?? member.party ?? "Unknown"}-${member.state}`,
      amount: profile?.totalReceipts,
      tags: [member.chamber, member.state, member.partyCode ?? member.party ?? ""].filter(Boolean),
    };
  });

  for (const member of members) {
    const id = safeSegment(member.bioguideId);
    await writeJson(`members/${id}.json`, {
      entityType: "member",
      member,
      funding: profileByMember.get(member.bioguideId.toLowerCase()) ?? null,
      recentVotes: [...houseMemberVotes, ...senateMemberVotes]
        .filter((vote) => vote.bioguideId.toLowerCase() === member.bioguideId.toLowerCase())
        .slice(0, 100),
      caveats: [
        "Funding records are campaign and committee filings, not proof of motive.",
        "Vote records and funding records are colocated for inspection, not causal inference.",
      ],
    });
  }

  const pacIndex: FeedEntry[] = committeeProfiles.map((profile) => {
    const id = safeSegment(profile.entityId);
    return {
      id: profile.entityId,
      label: profile.label,
      href: `/pacs/${id}`,
      datasetPath: `pacs/${id}.json`,
      amount: profile.totalReceipts,
      tags: ["committee"],
    };
  });

  for (const profile of committeeProfiles) {
    const id = safeSegment(profile.entityId);
    await writeJson(`pacs/${id}.json`, {
      entityType: "committee",
      profile,
      caveats: [
        "Committee totals reflect public FEC filings loaded into this feed.",
        "Independent expenditures, transfers, and direct receipts should be interpreted separately.",
      ],
    });
  }

  const donorIndex: FeedEntry[] = (funding?.donors ?? []).map((donor) => {
    const id = safeSegment(donor.id);
    return {
      id: donor.id,
      label: donor.donor,
      href: `/donors/${id}`,
      datasetPath: `donors/${id}.json`,
      amount: donor.totalContributed,
      tags: [donor.donorType, donor.donorState ?? ""].filter(Boolean),
    };
  });

  for (const donor of funding?.donors ?? []) {
    await writeJson(`donors/${safeSegment(donor.id)}.json`, {
      entityType: "donor",
      donor,
      caveats: [
        "Donor names can collide; use employer, occupation, state, recipient, and source records before drawing conclusions.",
        "Contribution records do not establish policy influence or quid pro quo arrangements.",
      ],
    });
  }

  const billKey = (bill: (typeof bills)[number]) =>
    `${bill.congress}-${bill.billType}-${bill.billNumber}`;

  const billIndex: FeedEntry[] = bills.map((bill) => {
    const key = billKey(bill);
    const id = safeSegment(key);
    return {
      id: key,
      label: bill.title,
      href: `/bills/${id}`,
      datasetPath: `bills/${id}.json`,
      summary: `${bill.billType?.toUpperCase?.() ?? "Bill"} ${bill.billNumber ?? ""}`.trim(),
      tags: [String(bill.congress), bill.billType ?? ""].filter(Boolean),
    };
  });

  for (const bill of bills) {
    const key = billKey(bill);
    await writeJson(`bills/${safeSegment(key)}.json`, {
      entityType: "bill",
      bill,
      linkedVotes: [...houseVotes, ...senateVotes].filter((vote) => vote.billId === key),
      caveats: ["Bill metadata comes from congressional public records and may lag official updates."],
    });
  }

  const houseFundingByVote = new Map((voteFunding?.house ?? []).map((vote) => [vote.voteId, vote]));
  const senateFundingByVote = new Map((voteFunding?.senate ?? []).map((vote) => [vote.voteId, vote]));
  const voteIndex: FeedEntry[] = [
    ...houseVotes.map((vote) => ({
      id: vote.voteId,
      label: vote.voteQuestion ?? `House roll call ${vote.rollCallNumber}`,
      href: `/votes/house/${safeSegment(vote.voteId)}`,
      datasetPath: `votes/house/${safeSegment(vote.voteId)}.json`,
      summary: vote.result,
      tags: ["house", String(vote.congress), String(vote.rollCallNumber)],
    })),
    ...senateVotes.map((vote) => ({
      id: vote.voteId,
      label: vote.question ?? `Senate roll call ${vote.rollCallNumber}`,
      href: `/votes/senate/${safeSegment(vote.voteId)}`,
      datasetPath: `votes/senate/${safeSegment(vote.voteId)}.json`,
      summary: vote.resultText ?? vote.result,
      tags: ["senate", String(vote.congress), String(vote.rollCallNumber)],
    })),
  ];

  for (const vote of houseVotes) {
    await writeJson(`votes/house/${safeSegment(vote.voteId)}.json`, {
      entityType: "vote",
      chamber: "H",
      vote,
      memberVotes: houseMemberVotes.filter((memberVote) => memberVote.voteId === vote.voteId),
      funding: houseFundingByVote.get(vote.voteId) ?? null,
      caveats: ["Funding groups show association across vote positions, not causation."],
    });
  }

  for (const vote of senateVotes) {
    await writeJson(`votes/senate/${safeSegment(vote.voteId)}.json`, {
      entityType: "vote",
      chamber: "S",
      vote,
      memberVotes: senateMemberVotes.filter((memberVote) => memberVote.voteId === vote.voteId),
      funding: senateFundingByVote.get(vote.voteId) ?? null,
      caveats: ["Funding groups show association across vote positions, not causation."],
    });
  }

  const stateIndex: FeedEntry[] = states.map((state) => {
    const id = safeSegment(state.stateCode);
    return {
      id: state.stateCode,
      label: state.stateName,
      href: `/states/${id}`,
      datasetPath: `states/${id}.json`,
      summary: "State outcome metrics",
      tags: ["state-outcomes"],
    };
  });

  for (const state of states) {
    await writeJson(`states/${safeSegment(state.stateCode)}.json`, {
      entityType: "state",
      state,
      caveats: ["Outcome metrics are contextual benchmarks and should not be treated as single-cause policy proof."],
    });
  }

  await writeJson("indexes/members.json", memberIndex);
  await writeJson("indexes/pacs.json", pacIndex);
  await writeJson("indexes/donors.json", donorIndex);
  await writeJson("indexes/bills.json", billIndex);
  await writeJson("indexes/votes.json", voteIndex);
  await writeJson("indexes/states.json", stateIndex);

  const manifest: FeedManifest = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    runId: summary?.runId,
    source: {
      kind: "public-record-read-models",
      note: "Portable public feed for static hosting, R2, Workers, MCP clients, and local LLM workflows.",
    },
    datasets: {
      members: {
        path: "indexes/members.json",
        count: memberIndex.length,
        description: "Member index with links to per-member funding and vote records.",
      },
      pacs: {
        path: "indexes/pacs.json",
        count: pacIndex.length,
        description: "Committee/PAC index with links to per-committee funding profiles.",
      },
      donors: {
        path: "indexes/donors.json",
        count: donorIndex.length,
        description: "Donor index derived from loaded FEC contribution records.",
      },
      bills: {
        path: "indexes/bills.json",
        count: billIndex.length,
        description: "Congressional bill index with linked vote references.",
      },
      votes: {
        path: "indexes/votes.json",
        count: voteIndex.length,
        description: "House and Senate vote index with per-vote member positions and funding groups.",
      },
      states: {
        path: "indexes/states.json",
        count: stateIndex.length,
        description: "State outcome metric index.",
      },
    },
    caveats: [
      "This feed intentionally excludes raw bulk contribution files by default to keep public hosting cheap and route reads small.",
      "Users can regenerate larger local datasets from public APIs and bulk files with their own free API keys.",
      "Records show public filings and official actions; they do not assert motive, loyalty, or causation.",
    ],
  };

  await writeJson("manifest.json", manifest);
  console.log(`Exported public feed to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
