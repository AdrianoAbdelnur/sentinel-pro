import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookie } from "@/app/api/auth/delivery";
export function proxy(request: NextRequest) {
 const token = request.cookies.get(SESSION_COOKIE)?.value;
 if (!token) return NextResponse.redirect(new URL("/login", request.url));
 const response = NextResponse.next();
 response.cookies.set(SESSION_COOKIE, token, sessionCookie);
 return response;
}
export const config = { matcher: ["/", "/live/:path*", "/admin/:path*"] };
