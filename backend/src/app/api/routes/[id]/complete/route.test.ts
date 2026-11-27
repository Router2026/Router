import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/trip-collab/authorize", () => ({ authorizeRoute: vi.fn() }));
vi.mock("@/lib/db/raw-client", () => ({ rawDb: { query: vi.fn() } }));
vi.mock("@/lib/xp/xp-service", () => ({ awardXp: vi.fn(), XP_REWARDS: { TRIP_COMPLETED: 30 } }));

import { POST } from "./route";
import { authorizeRoute } from "@/lib/trip-collab/authorize";
import { rawDb } from "@/lib/db/raw-client";
import { awardXp } from "@/lib/xp/xp-service";
import { NextResponse } from "next/server";

const mockAuthz = authorizeRoute as ReturnType<typeof vi.fn>;
const mockQuery = rawDb.query as ReturnType<typeof vi.fn>;
const mockXp = awardXp as ReturnType<typeof vi.fn>;
const call = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/routes/5/complete", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "5" }) });

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthz.mockResolvedValue({ routeId: 5, userId: 7, isOwner: true });
});

describe("POST /api/routes/:id/complete", () => {
  it("awards XP the first time", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 3 }] }).mockResolvedValueOnce({ rows: [{}] });
    mockXp.mockResolvedValue({ new_xp: 130 });
    const res = await call({ stops_done: 2 });
    expect(res.status).toBe(200);
    expect((await res.json()).data).toMatchObject({ xp_awarded: true, xp: { new_xp: 130 } });
    expect(mockXp).toHaveBeenCalledWith(7, 30);
  });

  it("awards nothing on a repeat", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 3 }] }).mockResolvedValueOnce({ rows: [] });
    const res = await call({ stops_done: 3 });
    expect((await res.json()).data).toMatchObject({ xp_awarded: false, xp: null });
    expect(mockXp).not.toHaveBeenCalled();
  });

  it.each([0, 4, 1.5, "x", undefined])("rejects stops_done=%s", async (n) => {
    mockQuery.mockResolvedValueOnce({ rows: [{ n: 3 }] });
    expect((await call({ stops_done: n })).status).toBe(400);
    expect(mockXp).not.toHaveBeenCalled();
  });

  it("passes through an authorization failure", async () => {
    mockAuthz.mockResolvedValue({ error: NextResponse.json({}, { status: 403 }) });
    expect((await call({ stops_done: 1 })).status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
  });
});
