import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookieName, getSessionCookieOptions } from "@/app/api/auth/delivery";
export function proxy(request: NextRequest) {
 const cookieName = getSessionCookieName(request);
 const token = request.cookies.get(cookieName)?.value;
 if (!token) return NextResponse.redirect(new URL("/login", request.url));
 const response = NextResponse.next();
 response.cookies.set(cookieName, token, getSessionCookieOptions(request));
 return response;
}
export const config = { matcher: ["/", "/live/:path*", "/admin/:path*"] };
