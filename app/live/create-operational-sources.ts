import type { OperationalSource } from "@/application/live";
import { inMemoryOperationalSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

type OperationalSourceRuntimeConfig = {
  includeDevelopmentFixtures: boolean;
};

type OperationalSourceDependencies = {
  catalogSource: OperationalSource;
};

export function createOperationalSources(
  config: OperationalSourceRuntimeConfig,
  dependencies: OperationalSourceDependencies,
): OperationalSource[] {
  return config.includeDevelopmentFixtures
    ? [dependencies.catalogSource, inMemoryOperationalSource]
    : [dependencies.catalogSource];
}
