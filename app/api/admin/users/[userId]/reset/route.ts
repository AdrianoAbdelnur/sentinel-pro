import { getIdentityApplication } from "@/app/api/auth/composition";
import { NextResponse } from "next/server";
import { adminForbidden, authorizeAdminRequest, badRequest } from "../../delivery";

type Context = { params: Promise<{ userId: string }> };

export async function POST(request: Request, { params }: Context) {
  const actor = await authorizeAdminRequest(request);
  if (actor instanceof NextResponse) return actor;
  const { userId } = await params;
  if (!userId.trim()) return badRequest();
  const result = await (await getIdentityApplication()).resetPassword({ actor, userId });
  switch (result.kind) {
    case "reset": return NextResponse.json({ temporaryPassword: result.temporaryPassword });
    case "shared_identity_reset_forbidden": case "forbidden": return adminForbidden();
    default: { const neverResult: never = result; return neverResult; }
  }
}
