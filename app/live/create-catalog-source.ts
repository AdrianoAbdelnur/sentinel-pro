import {
  createCatalogSummaryOperationalSource,
  type OperationalSource,
} from "@/application/live";
import { getMongoDatabase } from "@/integrations/persistence/mongodb/client";
import { createCatalogRepositories } from "@/integrations/persistence/mongodb/catalog-repositories";

async function loadCatalogGroups(organizationId: string) {
  const database = await getMongoDatabase();
  const repositories = createCatalogRepositories(database);
  return repositories.groups.listForOrganization(organizationId);
}

export function createCatalogSource(organizationId: string): OperationalSource {
  return createCatalogSummaryOperationalSource(() => loadCatalogGroups(organizationId));
}
