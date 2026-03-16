import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db/raw-client", () => ({
  rawDb: { query: vi.fn() },
}));
vi.mock("@/lib/notifications/push-service", () => ({
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
}));

import { rawDb } from "@/lib/db/raw-client";
import { sendPushToUser } from "@/lib/notifications/push-service";
import {
  listAllCommunityPois,
  createCommunityPoi,
  approveCommunityPoi,
  rejectCommunityPoi,
  editCommunityPoi,
} from "./community-poi-service";

const mockDb = rawDb as { query: ReturnType<typeof vi.fn> };
const mockPush = sendPushToUser as ReturnType<typeof vi.fn>;

const samplePoi = {
  id: 1,
  user_id: 5,
  name: "Hidden Spring",
  category: "מים",
  description: "A lovely spring",
  latitude: 32.5,
  longitude: 35.1,
  photos: ["img1.jpg"],
  status: "pending",
  admin_note: null,
  reviewed_by: null,
  reviewed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listAllCommunityPois", () => {
  it("returns all POIs without status filter", async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] });
    const result = await listAllCommunityPois();
    expect(result).toHaveLength(1);
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(params).toHaveLength(0);
    expect(sql).not.toContain("WHERE");
  });

  it("filters by status=pending when provided", async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] });
    await listAllCommunityPois("pending");
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(params).toContain("pending");
    expect(sql).toContain("WHERE");
  });
});

describe("createCommunityPoi", () => {
  it("inserts with status=pending", async () => {
    mockDb.query.mockResolvedValue({ rows: [samplePoi] });
    const result = await createCommunityPoi({
      userId: 5,
      name: "Hidden Spring",
      category: "מים",
      latitude: 32.5,
      longitude: 35.1,
    });
    expect(result.status).toBe("pending");
    const [sql] = mockDb.query.mock.calls[0];
    expect(sql).toContain("'pending'");
    expect(sql).toContain("INSERT INTO community_pois");
  });
});

describe("approveCommunityPoi", () => {
  it("updates status to approved, copies to locations, awards XP, sends push", async () => {
    const approvedPoi = { ...samplePoi, status: "approved" };
    mockDb.query
      .mockResolvedValueOnce({ rows: [approvedPoi] }) // UPDATE community_pois
      .mockResolvedValueOnce({ rows: [] }) // INSERT into locations
      .mockResolvedValueOnce({ rows: [] }); // UPDATE users XP

    const result = await approveCommunityPoi(1, 99);
    expect(result.status).toBe("approved");

    // Should have made 3 DB calls
    expect(mockDb.query).toHaveBeenCalledTimes(3);

    // Should send push notification
    expect(mockPush).toHaveBeenCalledWith(
      approvedPoi.user_id,
      expect.objectContaining({ title: expect.stringContaining("אושר") }),
    );

    // Second call should be INSERT INTO locations
    const [locationSql] = mockDb.query.mock.calls[1];
    expect(locationSql).toContain("INSERT INTO locations");
  });
});

describe("rejectCommunityPoi", () => {
  it("updates status to rejected and sends push", async () => {
    const rejectedPoi = {
      ...samplePoi,
      status: "rejected",
      admin_note: "Duplicate",
    };
    mockDb.query.mockResolvedValue({ rows: [rejectedPoi] });

    const result = await rejectCommunityPoi(1, 99, "Duplicate");
    expect(result.status).toBe("rejected");

    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain("'rejected'");
    expect(params).toContain("Duplicate");

    expect(mockPush).toHaveBeenCalledWith(
      rejectedPoi.user_id,
      expect.objectContaining({
        data: expect.objectContaining({ type: "community_poi_rejected" }),
      }),
    );
  });
});

describe("editCommunityPoi", () => {
  it("updates specified fields", async () => {
    const updated = { ...samplePoi, name: "Updated Spring" };
    mockDb.query.mockResolvedValue({ rows: [updated] });

    const result = await editCommunityPoi(1, { name: "Updated Spring" });
    expect(result.name).toBe("Updated Spring");
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain("COALESCE");
    expect(params).toContain("Updated Spring");
  });
});
