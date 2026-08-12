export type ProviderConnection = {
  id: string;
  organizationId: string;
  credentialRef: string;
  companyId?: string;
  authorizedExternalCompanyLabels?: string[];
  authorizedExternalFleetIds?: string[];
  authorizedExternalVehicleIds?: string[];
};

export type CompanyCandidate = {
  id: string;
  organizationId: string;
  connectionId: string;
  normalizedLabel: string;
  companyId?: string;
};

export function normalizeCompanyLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

export function stageCandidate(id: string, connection: ProviderConnection, externalLabel: string): CompanyCandidate {
  return {
    id,
    organizationId: connection.organizationId,
    connectionId: connection.id,
    normalizedLabel: normalizeCompanyLabel(externalLabel),
  };
}

export function bindCandidateToCompany(candidate: CompanyCandidate, companyId: string): CompanyCandidate {
  return { ...candidate, companyId };
}

export function assignCompanyToConnection(connection: ProviderConnection, companyId: string): ProviderConnection {
  return { ...connection, companyId };
}
