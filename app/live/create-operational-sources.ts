import type { OperationalSource } from "@/application/live";

type OperationalSourceRuntimeConfig = {
  includeDevelopmentFixtures: boolean;
};

type OperationalSourceDependencies = {
  catalogSource: OperationalSource;
};

export function createOperationalSources(
  _config: OperationalSourceRuntimeConfig,
  dependencies: OperationalSourceDependencies,
): OperationalSource[] {
  return [dependencies.catalogSource];
}
