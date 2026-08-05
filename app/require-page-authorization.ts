import type { IdentityRole } from "@/domain/identity";
import { redirect } from "next/navigation";
import { getPageAuthorization } from "./authorization";
export async function requirePageAuthorization(requiredRole: IdentityRole) {
 const result = await getPageAuthorization(requiredRole);
 if (result.kind !== "authorized") redirect("/login");
 return result.context;
}
