import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/tokens", () => ({ getUserFromRequest: vi.fn() }));
vi.mock("@/lib/trip-collab/collab-service", () => ({
  getAccess: vi.fn(),
  toggleVote: vi.fn(),
  acceptSuggestion: vi.fn(),
  dismissSuggestion: vi.fn(),
  removeMember: vi.fn(),
  createInvite: vi.fn(),
  revokeInvite: vi.fn(),
  acceptInvite: vi.fn(),
  previewInvite: vi.fn(),
}));

import { authorizeRoute, parseId } from "./authorize";
import { getUserFromRequest } from "@/lib/auth/tokens";
import * as svc from "@/lib/trip-collab/collab-service";
import { POST as suggestionAction } from "@/app/api/routes/[id]/suggestions/[sid]/route";
import { DELETE as removeMemberRoute } from "@/app/api/routes/[id]/members/[userId]/route";
import { POST as createInviteRoute } from "@/app/api/routes/[id]/invite/route";
import { POST as joinRoute } from "@/app/api/invites/[token]/route";

const mockUser = getUserFromRequest as ReturnType<typeof vi.fn>;
const mockAccess = svc.getAccess as ReturnType<typeof vi.fn>;
const req = (body?: unknown) => new NextRequest("http://localhost/api/x", { method: "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
const owner = { exists: true, isOwner: true, isMember: true };
const member = { exists: true, isOwner: false, isMember: true };
const outsider = { exists: true, isOwner: false, isMember: false };

beforeEach(() => {
  vi.clearAllMocks();
  mockUser.mockResolvedValue({ id: 7, email: "a@b.c", is_admin: false });
});

describe("parseId", () => {
  it.each([["12", 12], ["0", null], ["-3", null], ["12abc", null], ["1.5", null]])("%s → %s", (raw, out) => {
    expect(parseId(raw)).toBe(out);
  });
});

describe("authorizeRoute", () => {
  it("401 when signed out", async () => {
    mockUser.mockResolvedValue(null);
    const r = await authorizeRoute(req(), "5", "member");
    expect("error" in r && r.error.status).toBe(401);
  });
  it("404 for a missing route, 403 for an outsider", async () => {
    mockAccess.mockResolvedValueOnce({ exists: false, isOwner: false, isMember: false });
    expect(("error" in (await authorizeRoute(req(), "5", "member")) ? 404 : 0)).toBe(404);
    mockAccess.mockResolvedValueOnce(outsider);
    const r = await authorizeRoute(req(), "5", "member");
    expect("error" in r && r.error.status).toBe(403);
  });
  it("a member passes member checks but not owner checks", async () => {
    mockAccess.mockResolvedValue(member);
    expect(await authorizeRoute(req(), "5", "member")).toEqual({ routeId: 5, userId: 7, isOwner: false });
    const r = await authorizeRoute(req(), "5", "owner");
    expect("error" in r && r.error.status).toBe(403);
  });
});

describe("route handlers enforce roles", () => {
  const sp = (sid = "3") => ({ params: Promise.resolve({ id: "5", sid }) });

  it("members may vote", async () => {
    mockAccess.mockResolvedValue(member);
    (svc.toggleVote as ReturnType<typeof vi.fn>).mockResolvedValue({ my_vote: true });
    const res = await suggestionAction(req({ action: "vote" }), sp());
    expect(res.status).toBe(200);
  });

  it("members may not accept or dismiss", async () => {
    mockAccess.mockResolvedValue(member);
    for (const action of ["accept", "dismiss"]) {
      const res = await suggestionAction(req({ action }), sp());
      expect(res.status).toBe(403);
    }
    expect(svc.acceptSuggestion).not.toHaveBeenCalled();
    expect(svc.dismissSuggestion).not.toHaveBeenCalled();
  });

  it("owner accepts", async () => {
    mockAccess.mockResolvedValue(owner);
    (svc.acceptSuggestion as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    expect((await suggestionAction(req({ action: "accept" }), sp())).status).toBe(200);
  });

  it("rejects an unknown action before touching the DB", async () => {
    expect((await suggestionAction(req({ action: "delete" }), sp())).status).toBe(400);
    expect(mockAccess).not.toHaveBeenCalled();
  });

  it("only the owner creates invite links", async () => {
    mockAccess.mockResolvedValue(member);
    expect((await createInviteRoute(req(), { params: Promise.resolve({ id: "5" }) })).status).toBe(403);
    expect(svc.createInvite).not.toHaveBeenCalled();
  });

  it("a member can remove only themselves", async () => {
    mockAccess.mockResolvedValue(member);
    (svc.removeMember as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    const other = await removeMemberRoute(req(), { params: Promise.resolve({ id: "5", userId: "8" }) });
    expect(other.status).toBe(403);
    const self = await removeMemberRoute(req(), { params: Promise.resolve({ id: "5", userId: "7" }) });
    expect(self.status).toBe(200);
  });

  it("joining needs sign-in", async () => {
    mockUser.mockResolvedValue(null);
    expect((await joinRoute(req(), { params: Promise.resolve({ token: "x".repeat(32) }) })).status).toBe(401);
    expect(svc.acceptInvite).not.toHaveBeenCalled();
  });
});
