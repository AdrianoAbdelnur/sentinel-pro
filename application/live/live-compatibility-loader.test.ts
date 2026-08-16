import { describe, expect, it } from "vitest";

import { createLiveCompatibilityLoader, createLiveReadSwitch, readLiveCompatibilityMode } from "./live-compatibility-loader";

describe("createLiveCompatibilityLoader", () => {
  it("keeps legacy Live as the default", async () => {
    const load = createLiveCompatibilityLoader({
      loadLegacy: async () => ({ source: "legacy" }),
      loadGlobal: async () => ({ source: "global" }),
    });

    await expect(load()).resolves.toEqual({ source: "legacy" });
  });

  it("uses the global loader only when explicitly enabled", async () => {
    const load = createLiveCompatibilityLoader({
      mode: "global",
      loadLegacy: async () => ({ source: "legacy" }),
      loadGlobal: async () => ({ source: "global" }),
    });

    await expect(load()).resolves.toEqual({ source: "global" });
  });

  it("supports an immediate rollback to legacy without changing either loader", async () => {
    const load = createLiveCompatibilityLoader({
      mode: "legacy",
      loadLegacy: async () => ({ source: "legacy" }),
      loadGlobal: async () => ({ source: "global" }),
    });

    await expect(load()).resolves.toEqual({ source: "legacy" });
  });

  it("accepts only the explicit global switch and rolls back every other value to legacy", () => {
    expect(readLiveCompatibilityMode({ SENTINEL_LIVE_CATALOG_MODE: "global" })).toBe("global");
    expect(readLiveCompatibilityMode({ SENTINEL_LIVE_CATALOG_MODE: "legacy" })).toBe("legacy");
    expect(readLiveCompatibilityMode({ SENTINEL_LIVE_CATALOG_MODE: "unexpected" })).toBe("legacy");
    expect(readLiveCompatibilityMode({})).toBe("legacy");
  });
});

describe("createLiveReadSwitch", () => {
  it("requires passing parity gates before cutover and rolls back immediately", () => {
    const readSwitch = createLiveReadSwitch();
    expect(readSwitch.mode()).toBe("legacy");
    expect(() => readSwitch.enableGlobal({ passed: false })).toThrow("parity");
    expect(readSwitch.mode()).toBe("legacy");
    readSwitch.enableGlobal({ passed: true });
    expect(readSwitch.mode()).toBe("global");
    readSwitch.rollback();
    expect(readSwitch.mode()).toBe("legacy");
  });
});
