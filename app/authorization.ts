import type { AuthorizationResult } from "@/application/identity";
import type { IdentityRole } from "@/domain/identity";
import { getIdentityApplication } from "@/app/api/auth/composition";
import { LOCAL_SESSION_COOKIE, SESSION_COOKIE } from "@/app/api/auth/delivery";
import { cookies } from "next/headers";
export async function getPageAuthorization(requiredRole: IdentityRole): Promise<AuthorizationResult> {
 const cookieStore = await cookies();
 const token = cookieStore.get(SESSION_COOKIE)?.value ?? (process.env.NODE_ENV === "production" ? undefined : cookieStore.get(LOCAL_SESSION_COOKIE)?.value);
 if (!token) return { kind: "forbidden" };
 return (await getIdentityApplication()).authorize({ token, requiredRole });
}
