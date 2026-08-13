import type { CatalogImportCandidate, CatalogImportSource, CatalogSnapshotResult, CompanyRepository, FleetRepository, IdGenerator, ProviderConnectionRepository } from "./ports";
import type { SynchronizeCatalogConnectionUseCase } from "./sync-contracts";
import type { Company, ProviderConnection } from "@/domain/catalog";
import { createUnassignedFleet, normalizeCompanyLabel } from "@/domain/catalog";

export type ImportProvider = "cybermapa" | "howen";
export type ProviderImportResult = { provider: ImportProvider; status: "succeeded"; companies: number; fleets: number; counts: { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number } } | { provider: ImportProvider; status: "failed"; code: "unsupported" | "provider-failure" | "configuration" };

type ProviderImportPorts = {
  companies: CompanyRepository & { listByOrganization(organizationId: string): Promise<Company[]> };
  fleets: FleetRepository;
  connections: ProviderConnectionRepository;
  ids: IdGenerator;
  loadSource(provider: ImportProvider, companyId?: string): Promise<CatalogImportSource>;
  synchronize: SynchronizeCatalogConnectionUseCase;
};

const emptyCounts = () => ({ processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 });
const sumCounts = (a: ReturnType<typeof emptyCounts>, b: ReturnType<typeof emptyCounts>) => ({ processed: a.processed + b.processed, created: a.created + b.created, linked: a.linked + b.linked, reviewed: a.reviewed + b.reviewed, rejected: a.rejected + b.rejected, absent: a.absent + b.absent });

function groupCandidates(provider: ImportProvider, candidates: CatalogImportCandidate[]): Map<string, CatalogImportCandidate[]> {
  const groups = new Map<string, CatalogImportCandidate[]>();
  for (const candidate of candidates) {
    const key = provider === "cybermapa" ? normalizeCompanyLabel(candidate.companyLabel ?? "") : "howen";
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), candidate]);
  }
  return groups;
}

export function createProviderImportApplication(ports: ProviderImportPorts) {
  return async function importProvider({ organizationId, provider }: { organizationId: string; provider: ImportProvider }): Promise<ProviderImportResult> {
    let preview: CatalogSnapshotResult;
    try {
      const source = await ports.loadSource(provider, provider === "howen" ? "preview" : undefined);
      preview = await source.loadCompleteSnapshot();
    } catch {
      return { provider, status: "failed", code: "configuration" };
    }
    if (preview.kind === "failed") return { provider, status: "failed", code: "provider-failure" };

    const existingCompanies = await ports.companies.listByOrganization(organizationId);
    const groups = groupCandidates(provider, preview.candidates);
    let counts = emptyCounts();
    let companiesCreated = 0;
    let fleetsCreated = 0;

    for (const [groupKey, candidates] of groups) {
      let company = existingCompanies.find((item) => normalizeCompanyLabel(item.name) === groupKey);
      if (!company) {
        company = { id: ports.ids.create(), organizationId, name: candidates[0].companyLabel?.trim() ?? "Howen" };
        await ports.companies.save(company);
        await ports.fleets.save(createUnassignedFleet(ports.ids.create(), company.id));
        existingCompanies.push(company);
        companiesCreated += 1;
        fleetsCreated += 1;
      }
      const source = await ports.loadSource(provider, company.id);
      const connection: ProviderConnection = {
        id: ports.ids.create(),
        organizationId,
        credentialRef: "vault:" + provider + "/" + organizationId,
        companyId: company.id,
        ...(provider === "cybermapa"
          ? { authorizedExternalCompanyLabels: [groupKey] }
          : { authorizedExternalFleetIds: [...new Set(candidates.flatMap((candidate) => candidate.externalFleetId ? [candidate.externalFleetId] : []))], authorizedExternalVehicleIds: candidates.map((candidate) => candidate.externalId) }),
      };
      await ports.connections.save(connection);
      const outcome = await ports.synchronize({ organizationId, connectionId: connection.id, trigger: "manual", source: { async loadCompleteSnapshot() { const result = await source.loadCompleteSnapshot(); return result.kind === "complete" ? { ...result, candidates: result.candidates.filter((candidate) => candidates.some((selected) => selected.externalId === candidate.externalId)) } : result; } } });
      if (outcome.kind === "succeeded") counts = sumCounts(counts, outcome.run.counts);
      else if (outcome.kind === "retryable-failure") return { provider, status: "failed", code: "provider-failure" };
    }
    return { provider, status: "succeeded", companies: companiesCreated, fleets: fleetsCreated, counts };
  };
}


