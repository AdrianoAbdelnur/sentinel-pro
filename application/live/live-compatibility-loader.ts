export type LiveCompatibilityMode = "legacy" | "global";

export function readLiveCompatibilityMode(environment: Record<string, string | undefined> = process.env): LiveCompatibilityMode {
  return environment.SENTINEL_LIVE_CATALOG_MODE === "global" ? "global" : "legacy";
}

export type LiveCompatibilityLoaderInput<T> = {
  mode?: LiveCompatibilityMode;
  readSwitch?: LiveReadSwitch;
  loadLegacy: () => T;
  loadGlobal: () => T;
};

export function createLiveCompatibilityLoader<T>(input: LiveCompatibilityLoaderInput<T>): () => T {
  return () => (input.readSwitch?.mode() === "global" || input.mode === "global" ? input.loadGlobal() : input.loadLegacy());
}

export type LiveReadSwitch = {
  mode(): LiveCompatibilityMode;
  enableGlobal(parity: { passed: boolean }): void;
  rollback(): void;
};

export function createLiveReadSwitch(initialMode: LiveCompatibilityMode = "legacy"): LiveReadSwitch {
  let currentMode: LiveCompatibilityMode = initialMode;
  return {
    mode: () => currentMode,
    enableGlobal(parity) {
      if (!parity.passed) throw new Error("Cannot enable global Live before parity gates pass");
      currentMode = "global";
    },
    rollback() {
      currentMode = "legacy";
    },
  };
}
