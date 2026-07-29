import { DEFAULT_STALE_AFTER_MS } from "@/domain/live";

const STALE_AFTER_MS_ENV_VAR = "SENTINEL_LIVE_STALE_AFTER_MS";

export type LiveRuntimeConfig = {
  staleAfterMs: number;
};

export function readLiveRuntimeConfig(): LiveRuntimeConfig {
  const rawValue = process.env[STALE_AFTER_MS_ENV_VAR];

  if (rawValue === undefined) {
    return { staleAfterMs: DEFAULT_STALE_AFTER_MS };
  }

  const parsedValue = Number(rawValue);
  const isValid = Number.isFinite(parsedValue) && parsedValue > 0;

  if (!isValid) {
    console.warn(
      `[live-runtime-config] Ignoring invalid ${STALE_AFTER_MS_ENV_VAR}="${rawValue}"; ` +
        `falling back to the default of ${DEFAULT_STALE_AFTER_MS}ms.`,
    );
    return { staleAfterMs: DEFAULT_STALE_AFTER_MS };
  }

  return { staleAfterMs: parsedValue };
}
