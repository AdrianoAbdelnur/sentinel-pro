import type { AuthorizationResult } from "@/application/identity";
import type { IdentityRole } from "@/domain/identity";
import { getIdentityApplication } from "@/app/api/auth/composition";
import { SESSION_COOKIE } from "@/app/api/auth/delivery";
import { cookies } from "next/headers";
export async function getPageAuthorization(requiredRole: IdentityRole): Promise<AuthorizationResult> {
 const token = (await cookies()).get(SESSION_COOKIE)?.value;
 if (!token) return { kind: "forbidden" };
 return (await getIdentityApplication()).authorize({ token, requiredRole });
}
