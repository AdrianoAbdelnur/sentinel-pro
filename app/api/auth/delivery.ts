import { NextResponse } from "next/server";

export const SESSION_COOKIE = "__Host-sentinel_session";
export const LOCAL_SESSION_COOKIE = "sentinel_session";
const sessionCookie = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 12 * 60 * 60 };

export function getSessionCookieName(request: Request) {
  return new URL(request.url).protocol === "https:" ? SESSION_COOKIE : LOCAL_SESSION_COOKIE;
}

export function getSessionCookieOptions(request: Request) {
  return { ...sessionCookie, secure: new URL(request.url).protocol === "https:" };
}

export function readSessionToken(request: Request) {
  const cookieName = getSessionCookieName(request);
  return request.headers.get("cookie")?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
}

export function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin === new URL(request.url).origin;
}

export function forbidden() { return NextResponse.json({ error: "No tenés permisos para realizar esta acción." }, { status: 403 }); }
export function expireSession(request: Request, response: NextResponse) { response.cookies.set(getSessionCookieName(request), "", { ...getSessionCookieOptions(request), maxAge: 0 }); return response; }
