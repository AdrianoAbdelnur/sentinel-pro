import { NextResponse } from "next/server";
import { getIdentityApplication } from "../composition";
import { expireSession, forbidden, isSameOrigin, readSessionToken } from "../delivery";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const token = readSessionToken(request);
  if (token) await (await getIdentityApplication()).logout({ token });
  return expireSession(request, new NextResponse(null, { status: 204 }));
}
