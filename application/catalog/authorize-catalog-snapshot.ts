import { normalizeCompanyLabel, resolveCredentialRefProvider, type ProviderConnection } from "@/domain/catalog";

import type { CatalogImportCandidate } from "./ports";

function includesAuthorizedId(ids: string[] | undefined, externalId: string): boolean {
  return ids?.includes(externalId) ?? false;
}

export function hasCatalogImportAuthorization(connection: ProviderConnection): boolean {
  if (connection.companyId === undefined) return false;
  if (resolveCredentialRefProvider(connection.credentialRef) === "cybermapa") return (connection.authorizedExternalCompanyLabels?.length ?? 0) > 0;
  return (connection.authorizedExternalFleetIds?.length ?? 0) > 0 || (connection.authorizedExternalVehicleIds?.length ?? 0) > 0;
}

export function authorizeCatalogSnapshot(connection: ProviderConnection, candidates: CatalogImportCandidate[]): CatalogImportCandidate[] {
  if (!hasCatalogImportAuthorization(connection)) return [];
  return candidates.flatMap((candidate) => {
    const authorized = resolveCredentialRefProvider(connection.credentialRef) === "cybermapa"
      ? candidate.companyLabel !== undefined && includesAuthorizedId(connection.authorizedExternalCompanyLabels, normalizeCompanyLabel(candidate.companyLabel))
      : candidate.externalFleetId !== undefined
      ? includesAuthorizedId(connection.authorizedExternalFleetIds, candidate.externalFleetId)
      : includesAuthorizedId(connection.authorizedExternalVehicleIds, candidate.externalId);
    return authorized ? [{ ...candidate, companyId: connection.companyId }] : [];
  });
}
