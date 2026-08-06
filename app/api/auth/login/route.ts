import type { LoginResult } from "@/application/identity";
import { NextResponse } from "next/server";

import { getIdentityApplication } from "../composition";
import { expireSession, SESSION_COOKIE, sessionCookie } from "../delivery";

const invalidCredentials = { error: "Invalid email or password." };
const noActiveMembership = { error: "No active organization membership." };

function sessionResponse(next: string, token: string) {
  const response = NextResponse.json({ next });
  response.cookies.set(SESSION_COOKIE, token, sessionCookie);
  return response;
}

async function toLoginResponse(result: LoginResult, logout: (input: { token: string }) => Promise<{ kind: "logged_out" }>) {
  switch (result.kind) {
    case "invalid_credentials":
    case "temporarily_blocked":
      return NextResponse.json(invalidCredentials, { status: 401 });
    case "password_change_required":
      return sessionResponse("/change-password", result.token);
    case "tenant_selection_required":
      return sessionResponse("/select-organization", result.token);
    case "authenticated":
      return sessionResponse("/live", result.token);
    case "no_active_membership":
      await logout({ token: result.token });
      return expireSession(NextResponse.json(noActiveMembership, { status: 403 }));
    default: {
      const unhandledResult: never = result;
      return unhandledResult;
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const application = await getIdentityApplication();
  const result = await application.login({ email: typeof body.email === "string" ? body.email : "", password: typeof body.password === "string" ? body.password : "" });
  return toLoginResponse(result, application.logout);
}
