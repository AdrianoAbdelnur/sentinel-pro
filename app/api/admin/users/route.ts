import { getIdentityApplication } from "@/app/api/auth/composition";
import { NextResponse } from "next/server";
import { adminForbidden, authorizeAdminRequest, badRequest, isRole, lastAdmin, readJson } from "./delivery";

export async function POST(request: Request) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const body = await readJson(request);
  if (!body || typeof body.firstName !== "string" || typeof body.lastName !== "string" || typeof body.email !== "string" || (body.role !== undefined && !isRole(body.role)) || (body.temporaryPassword !== undefined && typeof body.temporaryPassword !== "string")) return badRequest();
  const result = await (await getIdentityApplication()).addUser({ actor, firstName: body.firstName, lastName: body.lastName, email: body.email, role: body.role, temporaryPassword: body.temporaryPassword });
  switch (result.kind) {
    case "created": return NextResponse.json({ userId: result.userId, temporaryPassword: result.temporaryPassword }, { status: 201 });
    case "membership_attached": return NextResponse.json({ userId: result.userId });
    case "invalid_email": return badRequest();
    case "last_admin": return lastAdmin();
    case "forbidden": return adminForbidden();
    default: { const neverResult: never = result; return neverResult; }
  }
}
