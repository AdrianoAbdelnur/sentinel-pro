import { DEFAULT_STALE_AFTER_MS } from "@/domain/live";

const STALE_AFTER_MS_ENV_VAR = "SENTINEL_LIVE_STALE_AFTER_MS";

export type LiveRuntimeConfig = {
  staleAfterMs: number;
};

/**
 * The single sanctioned reader of `process.env` in this repo. `domain/live` and
 * `application/live` must never read the environment or the clock.
 */
export function readLiveRuntimeConfig(): LiveRuntimeConfig {
  const rawValue = process.env[STALE_AFTER_MS_ENV_VAR];

  if (rawValue === undefined) {
    // Absence is the documented default, so it stays silent -- warning here
    // would log on every request in every environment that never set it.
    return { staleAfterMs: DEFAULT_STALE_AFTER_MS };
  }

  const parsedValue = Number(rawValue);
  const isValid = Number.isFinite(parsedValue) && parsedValue > 0;

  if (!isValid) {
    // An explicitly unusable value is an operator mistake: fall back so the
    // screen stays up, but warn so the mistake does not go unnoticed.
    console.warn(
      `[live-runtime-config] Ignoring invalid ${STALE_AFTER_MS_ENV_VAR}="${rawValue}"; ` +
        `falling back to the default of ${DEFAULT_STALE_AFTER_MS}ms.`,
    );
    return { staleAfterMs: DEFAULT_STALE_AFTER_MS };
  }

  return { staleAfterMs: parsedValue };
}
