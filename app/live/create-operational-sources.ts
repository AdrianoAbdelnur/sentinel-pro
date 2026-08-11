import type { OperationalSource } from "@/application/live";
import { createHowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenOperationalSource } from "@/integrations/howen/howen-operational-source";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { inMemoryOperationalSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

type OperationalSourceRuntimeConfig = {
  includeDevelopmentFixtures: boolean;
};

type OperationalSourceDependencies = {
  howenSource?: OperationalSource;
  canonicalCatalogSource?: OperationalSource;
};

type HowenEnvironment = Record<string, string | undefined>;

function unavailableHowenSource(): OperationalSource {
  return {
    identity: { id: "howen", label: "HOWEN" },
    async loadSnapshot() {
      return { kind: "failure", code: "unavailable" };
    },
  };
}

export function createOperationalSourceRuntime(
  environment: HowenEnvironment = process.env,
) {
  let howenSource: OperationalSource | undefined;

  return {
    getHowenSource(): OperationalSource {
      if (!howenSource) {
        try {
          const config = readHowenConfig(environment);
          const session = createHowenSessionManager({ config });
          const client = createHowenClient({ config, session });
          howenSource = createHowenOperationalSource({ client });
        } catch {
          howenSource = unavailableHowenSource();
        }
      }

      return howenSource;
    },
  };
}

const operationalSourceRuntime = createOperationalSourceRuntime();

function getSharedHowenSource(): OperationalSource {
  return operationalSourceRuntime.getHowenSource();
}

export function createOperationalSources(
  config: OperationalSourceRuntimeConfig,
  dependencies: OperationalSourceDependencies = {},
): OperationalSource[] {
  const sources = [dependencies.howenSource ?? getSharedHowenSource()];

  if (dependencies.canonicalCatalogSource) {
    sources.push(dependencies.canonicalCatalogSource);
  }

  if (config.includeDevelopmentFixtures) {
    sources.push(inMemoryOperationalSource);
  }

  return sources;
}
