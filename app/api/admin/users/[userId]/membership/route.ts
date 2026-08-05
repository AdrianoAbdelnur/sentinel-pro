import { getIdentityApplication } from "@/app/api/auth/composition";
import { NextResponse } from "next/server";
import { authorizeAdminRequest, badRequest, isRole, lastAdmin, readJson } from "../../delivery";

type Context = { params: Promise<{ userId: string }> };

export async function DELETE(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { userId } = await params;
  if (!userId.trim()) return badRequest();
  const result = await (await getIdentityApplication()).deactivateMembership({ actor, userId });
  switch (result.kind) {
    case "deactivated": return new NextResponse(null, { status: 204 });
    case "last_admin": return lastAdmin();
    case "forbidden": case "changed": case "reactivated": return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    default: { const neverResult: never = result; return neverResult; }
  }
}

export async function PATCH(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { userId } = await params;
  const body = await readJson(request);
  if (!userId.trim() || !body || !isRole(body.role) || (body.status !== undefined && body.status !== "active")) return badRequest();
  const application = await getIdentityApplication();
  const result = await application.reactivateMembership({ actor, userId, role: body.role });
  switch (result.kind) {
    case "changed": case "reactivated": return new NextResponse(null, { status: 204 });
    case "last_admin": return lastAdmin();
    case "forbidden": case "deactivated": return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    default: { const neverResult: never = result; return neverResult; }
  }
}
