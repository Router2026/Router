import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/tokens", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/routes/route-service", () => ({
  getRouteById: vi.fn(),
  deleteRoute: vi.fn(),
  updateRoute: vi.fn(),
}));

import { DELETE, PATCH } from "./route";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { deleteRoute, getRouteById, updateRoute } from "@/lib/routes/route-service";

const mockUser = getUserFromRequest as ReturnType<typeof vi.fn>;
const mockGet = getRouteById as ReturnType<typeof vi.fn>;
const mockDelete = deleteRoute as ReturnType<typeof vi.fn>;
const mockUpdate = updateRoute as ReturnType<typeof vi.fn>;

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = (method: string, body?: unknown) =>
  new NextRequest("http://localhost/api/routes/5", { method, ...(body ? { body: JSON.stringify(body) } : {}) });

beforeEach(() => {
  vi.clearAllMocks();
  mockGet.mockResolvedValue({ id: 5, user_id: 7, stops: [] });
});

describe("DELETE /api/routes/:id", () => {
  it("rejects anonymous requests without deleting", async () => {
    mockUser.mockResolvedValue(null);
    expect((await DELETE(req("DELETE"), params("5"))).status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("rejects another user's route without deleting", async () => {
    mockUser.mockResolvedValue({ id: 8, is_admin: false });
    expect((await DELETE(req("DELETE"), params("5"))).status).toBe(403);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing route and 400 for a bad id", async () => {
    mockUser.mockResolvedValue({ id: 7, is_admin: false });
    mockGet.mockResolvedValueOnce(null);
    expect((await DELETE(req("DELETE"), params("5"))).status).toBe(404);
    expect((await DELETE(req("DELETE"), params("abc"))).status).toBe(400);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("lets the owner and admins delete", async () => {
    mockUser.mockResolvedValue({ id: 7, is_admin: false });
    expect((await DELETE(req("DELETE"), params("5"))).status).toBe(200);
    mockUser.mockResolvedValue({ id: 99, is_admin: true });
    expect((await DELETE(req("DELETE"), params("5"))).status).toBe(200);
    expect(mockDelete).toHaveBeenCalledTimes(2);
    expect(mockDelete).toHaveBeenCalledWith(5);
  });
});

describe("PATCH /api/routes/:id", () => {
  it("keeps the same owner check", async () => {
    mockUser.mockResolvedValue({ id: 8, is_admin: false });
    expect((await PATCH(req("PATCH", { name: "x" }), params("5"))).status).toBe(403);
    expect(mockUpdate).not.toHaveBeenCalled();

    mockUser.mockResolvedValue({ id: 7, is_admin: false });
    mockUpdate.mockResolvedValue({ id: 5, name: "x" });
    expect((await PATCH(req("PATCH", { name: "x" }), params("5"))).status).toBe(200);
    expect(mockUpdate).toHaveBeenCalledWith(5, { name: "x" });
  });
});
