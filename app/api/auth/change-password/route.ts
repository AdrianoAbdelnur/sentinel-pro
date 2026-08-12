import { NextResponse } from "next/server";
import { getIdentityApplication } from "../composition";
import { expireSession, forbidden, isSameOrigin, readSessionToken } from "../delivery";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return forbidden();
  const token = readSessionToken(request);
  const body = await request.json().catch(() => ({}));
  if (!token) return forbidden();
  const result = await (await getIdentityApplication()).changePassword({ token, password: typeof body.password === "string" ? body.password : "" });
  if (result.kind !== "changed") return NextResponse.json({ error: result.kind === "invalid_password" ? "La contraseña debe tener al menos 8 caracteres." : "No tenés permisos para realizar esta acción." }, { status: result.kind === "invalid_password" ? 400 : 403 });
  return expireSession(request, NextResponse.json({ next: "/login" }));
}
