import { DEFAULT_STALE_AFTER_MS } from "@/domain/live";

const STALE_AFTER_MS_ENV_VAR = "SENTINEL_LIVE_STALE_AFTER_MS";

export type LiveRuntimeConfig = {
  staleAfterMs: number;
  includeDevelopmentFixtures: boolean;
};

type LiveEnvironment = Record<string, string | undefined>;

export function readLiveRuntimeConfig(
  environment: LiveEnvironment = process.env,
): LiveRuntimeConfig {
  const includeDevelopmentFixtures =
    environment.NODE_ENV === "development";
  const rawValue = environment[STALE_AFTER_MS_ENV_VAR];

  if (rawValue === undefined) {
    return {
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      includeDevelopmentFixtures,
    };
  }

  const parsedValue = Number(rawValue);
  const isValid = Number.isFinite(parsedValue) && parsedValue > 0;

  if (!isValid) {
    console.warn(
      `[live-runtime-config] Ignoring invalid ${STALE_AFTER_MS_ENV_VAR}="${rawValue}"; ` +
        `falling back to the default of ${DEFAULT_STALE_AFTER_MS}ms.`,
    );
    return {
      staleAfterMs: DEFAULT_STALE_AFTER_MS,
      includeDevelopmentFixtures,
    };
  }

  return { staleAfterMs: parsedValue, includeDevelopmentFixtures };
}
