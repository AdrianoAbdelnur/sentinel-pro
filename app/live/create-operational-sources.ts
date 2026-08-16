import type { OperationalSource } from "@/application/live";
import { createHowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenOperationalSource } from "@/integrations/howen/howen-operational-source";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { inMemoryOperationalSource } from "@/integrations/live/in-memory/in-memory-live-data-source";
import { createLiveCompatibilityLoader, readLiveCompatibilityMode, type LiveReadSwitch } from "@/application/live/live-compatibility-loader";

type OperationalSourceRuntimeConfig = {
  includeDevelopmentFixtures: boolean;
  liveReadSwitch?: LiveReadSwitch;
};

type OperationalSourceDependencies = {
  howenSource?: OperationalSource;
  canonicalCatalogSource?: OperationalSource;
  globalCatalogSource?: OperationalSource;
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
  const legacySources = [dependencies.howenSource ?? getSharedHowenSource()];
  const globalSources = dependencies.globalCatalogSource ? [...legacySources, dependencies.globalCatalogSource] : legacySources;
  const sources = createLiveCompatibilityLoader({
    mode: readLiveCompatibilityMode(),
    readSwitch: config.liveReadSwitch,
    loadLegacy: () => legacySources,
    loadGlobal: () => globalSources,
  });
  const selectedSources = sources();

  if (dependencies.canonicalCatalogSource) {
    selectedSources.push(dependencies.canonicalCatalogSource);
  }

  if (config.includeDevelopmentFixtures) {
    selectedSources.push(inMemoryOperationalSource);
  }

  return selectedSources;
}
