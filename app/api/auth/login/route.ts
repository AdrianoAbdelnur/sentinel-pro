import type { LoginResult } from "@/application/identity";
import { NextResponse } from "next/server";

import { getIdentityApplication } from "../composition";
import { expireSession, getSessionCookieName, getSessionCookieOptions } from "../delivery";

const authDebugEnabled = process.env.SENTINEL_AUTH_DEBUG === "true";

const invalidCredentials = { error: "El correo electrónico o la contraseña no son válidos." };
const noActiveMembership = { error: "No tenés una membresía activa en una organización." };

function sessionResponse(request: Request, next: string, token: string) {
  const response = NextResponse.json({ next });
  response.cookies.set(getSessionCookieName(request), token, getSessionCookieOptions(request));
  return response;
}

async function toLoginResponse(request: Request, result: LoginResult, logout: (input: { token: string }) => Promise<{ kind: "logged_out" }>) {
  switch (result.kind) {
    case "invalid_credentials":
    case "temporarily_blocked":
      return NextResponse.json(invalidCredentials, { status: 401 });
    case "password_change_required":
      return sessionResponse(request, "/change-password", result.token);
    case "tenant_selection_required":
      return sessionResponse(request, "/select-organization", result.token);
    case "authenticated":
      return sessionResponse(request, "/live", result.token);
    case "no_active_membership":
      await logout({ token: result.token });
      return expireSession(request, NextResponse.json(noActiveMembership, { status: 403 }));
    default: {
      const unhandledResult: never = result;
      return unhandledResult;
    }
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (authDebugEnabled) console.log("[auth:server] request", { email, passwordLength: password.length });
  try {
    const application = await getIdentityApplication();
    const result = await application.login({ email, password });
    if (authDebugEnabled) console.log("[auth:server] result", { email, kind: result.kind });
    return toLoginResponse(request, result, application.logout);
  } catch {
    return NextResponse.json({ error: "No pudimos continuar. Intentá nuevamente." }, { status: 500 });
  }
}
