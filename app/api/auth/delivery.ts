import { NextResponse } from "next/server";

export const SESSION_COOKIE = "__Host-sentinel_session";
export const sessionCookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 12 * 60 * 60 };

export function readSessionToken(request: Request) {
  return request.headers.get("cookie")?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export function forbidden() { return NextResponse.json({ error: "No tenés permisos para realizar esta acción." }, { status: 403 }); }
export function expireSession(response: NextResponse) { response.cookies.set(SESSION_COOKIE, "", { ...sessionCookie, maxAge: 0 }); return response; }
