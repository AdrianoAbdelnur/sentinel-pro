import { createLoadLivePage, type OperationalSource } from "@/application/live";
import { loadLiveSnapshots } from "@/integrations/catalog/live-snapshot-adapters";
import { getMongoDatabase } from "@/integrations/persistence/mongodb/client";
import { createCatalogRepositories } from "@/integrations/persistence/mongodb/catalog-repositories";

async function loadCatalogPage(organizationId: string) {
  const database = await getMongoDatabase();
  const repositories = createCatalogRepositories(database);
  return createLoadLivePage({ ...repositories, loadSnapshots: loadLiveSnapshots })({
    organizationId,
    page: 1,
  });
}

export function createCatalogSource(organizationId: string): OperationalSource {
  return {
    identity: { id: "canonical-catalog", label: "Catálogo" },
    async loadSnapshot() {
      try {
        return { kind: "success", state: (await loadCatalogPage(organizationId)).state };
      } catch {
        return { kind: "failure", code: "unavailable" };
      }
    },
  };
}
