import { NextResponse } from "next/server";
import { getIdentityApplication } from "../composition";
import { forbidden, isSameOrigin, readSessionToken } from "../delivery";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const token = readSessionToken(request);
  const body = await request.json().catch(() => ({}));
  if (!token || typeof body.organizationId !== "string") return forbidden();
  const result = await (await getIdentityApplication()).selectOrganization({ token, organizationId: body.organizationId });
  return result.kind === "selected" ? NextResponse.json({ next: "/live" }) : forbidden();
}
