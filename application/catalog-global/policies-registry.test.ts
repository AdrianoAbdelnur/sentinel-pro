import { describe, expect, it } from "vitest";
import { createGlobalCapabilityPolicyApplication } from "./capability-policy";
import { createProviderAdapterRegistry } from "./provider-adapter-registry";
import type { GlobalCapabilityPolicy } from "@/domain/catalog-global";

describe("global capability policies", () => {
  it("resolves the default GPS and video sources", async () => {
    const app = createGlobalCapabilityPolicyApplication({ policies: { find: async () => undefined, save: async () => undefined } });
    await expect(app.resolve("gps")).resolves.toEqual(["cybermapa", "howen"]);
    await expect(app.resolve("video")).resolves.toEqual(["howen"]);
  });

  it("puts a direct GPS source before the default source", async () => {
    let policy: GlobalCapabilityPolicy | undefined;
    const app = createGlobalCapabilityPolicyApplication({ policies: { find: async () => policy, save: async (value) => { policy = value; } } });
    await app.overrideDirectGps("direct-gps");
    await expect(app.resolve("gps")).resolves.toEqual(["direct-gps", "cybermapa", "howen"]);
  });
});

describe("provider adapter registry", () => {
  it("returns undefined for unknown adapters and resolves registered adapters", () => {
    const registry = createProviderAdapterRegistry();
    const source = { loadCompleteSnapshot: async () => ({ kind: "complete" as const, candidates: [] }) };
    registry.register("known", () => source);
    expect(registry.resolve("unknown", {} as never)).toBeUndefined();
    expect(registry.resolve("known", {} as never)).toBe(source);
  });
});
