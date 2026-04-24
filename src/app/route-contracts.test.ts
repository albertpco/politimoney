import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BillEntity, OrganizationEntity } from "@/lib/data/repository";
import type { CandidateMemberCrosswalk, CongressMember } from "@/lib/ingest/types";

const routeData = vi.hoisted(() => ({
  committees: [] as OrganizationEntity[],
  bills: [] as BillEntity[],
  members: [] as CongressMember[],
  crosswalk: [] as CandidateMemberCrosswalk[],
}));

const navigation = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirect: vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`);
  }),
}));

vi.mock("next/navigation", () => navigation);

vi.mock("@/lib/data/committee-repository", () => ({
  findCommitteeByIdRepository: vi.fn(async (committeeId: string) => {
    const normalized = committeeId.trim().toLowerCase();
    return (
      routeData.committees.find(
        (committee) =>
          committee.committeeId.toLowerCase() === normalized ||
          committee.id.toLowerCase() === normalized,
      ) ?? null
    );
  }),
  getFundingProfileRepository: vi.fn(async () => null),
  getCommitteeRecipientsRepository: vi.fn(async () => []),
}));

vi.mock("@/lib/data/bill-repository", () => ({
  findBillByIdRepository: vi.fn(async (billId: string) => {
    const normalized = billId.trim().toLowerCase();
    return routeData.bills.find((bill) => bill.id.toLowerCase() === normalized) ?? null;
  }),
}));

vi.mock("@/lib/data/member-repository", () => ({
  getLatestMembersRepository: vi.fn(async () => []),
  getLatestSenatorsRepository: vi.fn(async () => []),
  findMemberByBioguideIdRepository: vi.fn(async (bioguideId: string) => {
    const normalized = bioguideId.trim().toLowerCase();
    return (
      routeData.members.find(
        (member) => member.bioguideId.toLowerCase() === normalized,
      ) ?? null
    );
  }),
}));

vi.mock("@/lib/data/state-repository", () => ({
  getLatestStatesRepository: vi.fn(async () => []),
}));

vi.mock("@/lib/data/repository", () => ({
  getCandidateMemberCrosswalkRepository: vi.fn(async () => routeData.crosswalk),
  getLatestCongressMembersRepository: vi.fn(async () => routeData.members),
  getRecentMemberVotePositionsRepository: vi.fn(async () => []),
}));

beforeEach(() => {
  routeData.committees = [];
  routeData.bills = [];
  routeData.members = [];
  routeData.crosswalk = [];
  navigation.notFound.mockClear();
  navigation.redirect.mockClear();
});

describe("detail route metadata contracts", () => {
  it("builds member metadata with role, party, and state", async () => {
    const { generateMetadata } = await import("./members/[id]/page");
    routeData.members = [
      member({
        bioguideId: "M001",
        name: "Jane Public",
        chamber: "H",
        partyCode: "D",
        state: "CA",
      }),
    ];

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "m001" }) });

    expect(metadata).toEqual({
      title: "Jane Public | Politired",
      description:
        "Representative Jane Public (D-CA). View funding profile, voting record, and linked PACs.",
    });
  });

  it("returns member not-found metadata when the member is missing", async () => {
    const { generateMetadata } = await import("./members/[id]/page");

    await expect(
      generateMetadata({ params: Promise.resolve({ id: "missing" }) }),
    ).resolves.toEqual({ title: "Member not found | Politired" });
  });

  it("builds PAC metadata from committee records", async () => {
    const { generateMetadata } = await import("./pacs/[id]/page");
    routeData.committees = [
      committee({
        id: "c001-public-accountability",
        committeeId: "C001",
        name: "Public Accountability PAC",
      }),
    ];

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "c001" }) });

    expect(metadata).toEqual({
      title: "Public Accountability PAC | Politired",
      description:
        "Public Accountability PAC (C001). View financial summary, top donors, and recipients.",
    });
  });

  it("returns a not-found PAC metadata title when the committee is missing", async () => {
    const { generateMetadata } = await import("./pacs/[id]/page");

    await expect(
      generateMetadata({ params: Promise.resolve({ id: "missing" }) }),
    ).resolves.toEqual({ title: "Committee not found | Politired" });
  });

  it("builds bill metadata with label and bill title", async () => {
    const { generateMetadata } = await import("./bills/[id]/page");
    routeData.bills = [
      bill({
        id: "119-hr-42",
        billType: "hr",
        billNumber: "42",
        title: "Public Records Transparency Act",
      }),
    ];

    const metadata = await generateMetadata({ params: Promise.resolve({ id: "119-hr-42" }) });

    expect(metadata).toEqual({
      title: "HR 42 | Politired",
      description:
        "HR 42: Public Records Transparency Act. View vote context, sponsor details, and funding analysis.",
    });
  });

  it("normalizes state codes and hyphenated state names in metadata", async () => {
    const { generateMetadata } = await import("./states/[id]/page");

    await expect(
      generateMetadata({ params: Promise.resolve({ id: "ca" }) }),
    ).resolves.toMatchObject({ title: "California | Politired" });
    await expect(
      generateMetadata({ params: Promise.resolve({ id: "new-york" }) }),
    ).resolves.toMatchObject({ title: "New York | Politired" });
  });

  it("returns state not-found metadata for unknown state ids", async () => {
    const { generateMetadata } = await import("./states/[id]/page");

    await expect(
      generateMetadata({ params: Promise.resolve({ id: "not-a-state" }) }),
    ).resolves.toEqual({ title: "State not found | Politired" });
  });
});

describe("detail route missing-record contracts", () => {
  it("returns notFound for missing member detail records", async () => {
    const { default: MemberPage } = await import("./members/[id]/page");

    await expect(MemberPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("returns notFound for missing PAC detail records", async () => {
    const { default: PacPage } = await import("./pacs/[id]/page");

    await expect(PacPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("returns notFound for missing bill detail records", async () => {
    const { default: BillPage } = await import("./bills/[id]/page");

    await expect(BillPage({ params: Promise.resolve({ id: "missing" }) })).rejects.toThrow(
      "NEXT_NOT_FOUND",
    );
  });

  it("returns notFound for invalid state detail ids", async () => {
    const { default: StatePage } = await import("./states/[id]/page");

    await expect(
      StatePage({ params: Promise.resolve({ id: "not-a-state" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});

describe("legacy route redirect contracts", () => {
  it("redirects empty /explore to /search", async () => {
    const { default: ExplorePage } = await import("./explore/[[...slug]]/page");

    await expect(ExplorePage({ params: Promise.resolve({}) })).rejects.toThrow(
      "NEXT_REDIRECT:/search",
    );
  });

  it("redirects legacy member detail paths by bioguide id", async () => {
    const { default: ExplorePage } = await import("./explore/[[...slug]]/page");
    routeData.members = [member({ bioguideId: "M001" })];

    await expect(
      ExplorePage({ params: Promise.resolve({ slug: ["members", "m001"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/members/m001");
  });

  it("redirects legacy candidate member paths through the crosswalk", async () => {
    const { default: ExplorePage } = await import("./explore/[[...slug]]/page");
    routeData.members = [member({ bioguideId: "M001" })];
    routeData.crosswalk = [
      {
        candidateId: "P001",
        bioguideId: "M001",
        matchType: "test",
        confidence: 1,
      },
    ];

    await expect(
      ExplorePage({ params: Promise.resolve({ slug: ["members", "p001"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/members/m001");
  });

  it("redirects legacy organization paths to the canonical PAC route", async () => {
    const { default: ExplorePage } = await import("./explore/[[...slug]]/page");

    await expect(
      ExplorePage({ params: Promise.resolve({ slug: ["organizations", "c001"] }) }),
    ).rejects.toThrow("NEXT_REDIRECT:/pacs/c001");
  });

  it("converts unsupported nested legacy paths into a search query", async () => {
    const { default: ExplorePage } = await import("./explore/[[...slug]]/page");

    await expect(
      ExplorePage({
        params: Promise.resolve({ slug: ["unknown", "public", "records"] }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/search?q=public%20records");
  });
});

describe("catch-all route contract", () => {
  it("returns notFound for unmatched paths", async () => {
    const { default: CatchAllPage } = await import("./[...path]/page");

    await expect(CatchAllPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(navigation.notFound).toHaveBeenCalledOnce();
  });
});

function committee(overrides: Partial<OrganizationEntity>): OrganizationEntity {
  return {
    id: "c-test",
    committeeId: "C_TEST",
    name: "Test Committee",
    issue: "General",
    cycleTotal: 0,
    donorCount: 0,
    contributionCount: 0,
    linkedOfficials: 0,
    note: "Fixture",
    ...overrides,
  };
}

function bill(overrides: Partial<BillEntity>): BillEntity {
  return {
    id: "119-hr-1",
    congress: 119,
    billType: "hr",
    billNumber: "1",
    title: "Test Bill",
    status: "Introduced",
    sponsor: "Sponsor",
    summary: "Fixture",
    ...overrides,
  };
}

function member(overrides: Partial<CongressMember>): CongressMember {
  return {
    bioguideId: "M_TEST",
    name: "Test Member",
    state: "CA",
    chamber: "H",
    ...overrides,
  };
}
