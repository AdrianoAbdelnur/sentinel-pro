import {
  createGlobalCatalogOperationalSource,
  type GlobalCatalogLiveInput,
  type OperationalSource,
} from "@/application/live";
import { getMongoDatabase } from "@/integrations/persistence/mongodb/client";
import { createGlobalCatalogRepositories } from "@/integrations/persistence/mongodb/catalog-global-repositories";
import { loadGlobalLiveSnapshots } from "@/integrations/catalog/global-live-snapshot-adapters";

async function loadCatalog(organizationId: string): Promise<GlobalCatalogLiveInput> {
  const database = await getMongoDatabase();
  const repositories = createGlobalCatalogRepositories(database);
  const [fleets, vehicles, connections, grants, policies, providers] = await Promise.all([
    repositories.groups.list(),
    repositories.vehicles.list(),
    repositories.connections.listEnabled(),
    repositories.grants.listByOrganizationId(organizationId),
    repositories.policies.list(),
    repositories.providers.list(),
  ]);
  const contributions = (
    await Promise.all(connections.map(({ id }) => repositories.contributions.listByConnectionId(id)))
  ).flat();
  const sourceSnapshots = await loadGlobalLiveSnapshots(connections, providers, contributions);

  return {
    organizationId,
    fleets,
    vehicles,
    connections,
    contributions,
    grants,
    policies,
    sourceSnapshots,
  };
}

export function createGlobalCatalogSource(organizationId: string): OperationalSource {
  return createGlobalCatalogOperationalSource(() => loadCatalog(organizationId));
}
