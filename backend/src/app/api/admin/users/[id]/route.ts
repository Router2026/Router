import { NextRequest, NextResponse } from "next/server";
import { rawDb } from "@/lib/db/raw-client";
import { getUserFromRequest } from "@/lib/auth/tokens";
import { successResponse, errorResponse } from "@/lib/api/response";

const unauth = () =>
  NextResponse.json(errorResponse("Unauthorized", "UNAUTHORIZED"), {
    status: 401,
  });

async function requireAdmin(req: NextRequest) {
  const user = await getUserFromRequest(req);
  return user?.is_admin ? user : null;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireAdmin(req);
  if (!admin) return unauth();
  const { id } = await params;
  if (String(admin.id) === id) {
    return NextResponse.json(
      errorResponse("Cannot delete your own account", "FORBIDDEN"),
      {
        status: 403,
      },
    );
  }
  try {
    await rawDb.query("DELETE FROM users WHERE id = $1", [id]);
    return NextResponse.json(successResponse({ deleted: true }));
  } catch (err) {
    console.error("[DELETE /api/admin/users/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to delete user", "DB_ERROR"),
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireAdmin(req))) return unauth();
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["is_admin", "level", "xp_points"] as const;
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;
    for (const key of allowed) {
      if (key in body) {
        sets.push(`${key} = $${idx++}`);
        vals.push(body[key]);
      }
    }
    if (sets.length === 0) {
      return NextResponse.json(
        errorResponse("No valid fields to update", "VALIDATION_ERROR"),
        {
          status: 400,
        },
      );
    }
    vals.push(id);
    const { rows } = await rawDb.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx} RETURNING id, email, full_name, username, is_admin, xp_points, level`,
      vals,
    );
    if (!rows.length)
      return NextResponse.json(errorResponse("User not found", "NOT_FOUND"), {
        status: 404,
      });
    return NextResponse.json(successResponse(rows[0]));
  } catch (err) {
    console.error("[PATCH /api/admin/users/[id]]", err);
    return NextResponse.json(
      errorResponse("Failed to update user", "DB_ERROR"),
      { status: 500 },
    );
  }
}
