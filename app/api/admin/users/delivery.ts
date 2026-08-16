import type { AuthorizationContext, PlatformAuthorizationContext } from "@/application/identity";
import type { IdentityRole } from "@/domain/identity";
import { getIdentityApplication } from "@/app/api/auth/composition";
import { forbidden, isSameOrigin, readSessionToken } from "@/app/api/auth/delivery";
import { NextResponse } from "next/server";

export async function authorizeAdminRequest(request: Request): Promise<AuthorizationContext | NextResponse> {
  if (!isSameOrigin(request)) return forbidden();
  const token = readSessionToken(request);
  if (!token) return forbidden();
  const result = await (await getIdentityApplication()).authorize({ token, requiredRole: "admin" });
  return result.kind === "authorized" ? result.context : forbidden();
}

export async function authorizePlatformRequest(request: Request): Promise<PlatformAuthorizationContext | NextResponse> {
  if (!isSameOrigin(request)) return forbidden();
  const token = readSessionToken(request);
  if (!token) return forbidden();
  const result = await (await getIdentityApplication()).authorizePlatform({ token });
  return result.kind === "authorized" ? result.context : forbidden();
}

export async function readJson(request: Request): Promise<Record<string, unknown> | undefined> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

export function isRole(value: unknown): value is IdentityRole { return value === "admin" || value === "operator"; }
export function badRequest() { return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 }); }
export function lastAdmin() { return NextResponse.json({ error: "No se puede modificar al último administrador." }, { status: 409 }); }
export function adminForbidden() { return NextResponse.json({ error: "No tenés permisos para realizar esta acción." }, { status: 403 }); }
