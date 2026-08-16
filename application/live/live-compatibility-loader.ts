export type LiveCompatibilityMode = "legacy" | "global";

export function readLiveCompatibilityMode(environment: Record<string, string | undefined> = process.env): LiveCompatibilityMode {
  return environment.SENTINEL_LIVE_CATALOG_MODE === "global" ? "global" : "legacy";
}

export type LiveCompatibilityLoaderInput<T> = {
  mode?: LiveCompatibilityMode;
  loadLegacy: () => Promise<T>;
  loadGlobal: () => Promise<T>;
};

export function createLiveCompatibilityLoader<T>(input: LiveCompatibilityLoaderInput<T>): () => Promise<T> {
  return input.mode === "global" ? input.loadGlobal : input.loadLegacy;
}
