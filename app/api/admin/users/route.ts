import { getIdentityApplication } from "@/app/api/auth/composition";
import { NextResponse } from "next/server";
import { authorizeAdminRequest, badRequest, isRole, readJson } from "./delivery";

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
    case "last_admin": return NextResponse.json({ error: "The last administrator cannot be changed." }, { status: 409 });
    case "forbidden": return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    default: { const neverResult: never = result; return neverResult; }
  }
}
