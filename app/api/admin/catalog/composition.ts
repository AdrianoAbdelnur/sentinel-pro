import { randomUUID } from "node:crypto";

import { createAssignConnectionCompanyApplication, createCompanyBindingApplication } from "@/application/catalog";
import { createMongoCatalogRepositories, getMongoDatabase } from "@/integrations/persistence/mongodb";

async function createCatalogAdminRuntime() {
  const database = await getMongoDatabase();
  const repositories = createMongoCatalogRepositories(database);
  const ids = { create: randomUUID };
  const { bindProviderCompany } = createCompanyBindingApplication({ companies: repositories.companies, candidates: repositories.candidates, ids });
  const { assignConnectionCompany } = createAssignConnectionCompanyApplication({ companies: repositories.companies, connections: repositories.connections });
  return { bindProviderCompany, assignConnectionCompany };
}

let runtime: Awaited<ReturnType<typeof createCatalogAdminRuntime>> | undefined;

export async function getCatalogAdminRuntime() {
  if (runtime) return runtime;
  runtime = await createCatalogAdminRuntime();
  return runtime;
}
