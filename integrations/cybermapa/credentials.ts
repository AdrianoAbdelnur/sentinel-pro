import { toCredentialRef } from "@/domain/catalog";

export function buildCybermapaCredentialRef(organizationId: string): string {
  return toCredentialRef("cybermapa", organizationId);
}
