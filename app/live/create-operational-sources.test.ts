import { describe, expect, it } from "vitest";

import type { OperationalSource } from "@/application/live";
import { inMemoryOperationalSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

import {
  createOperationalSourceRuntime,
  createOperationalSources,
} from "./create-operational-sources";

const howenSource: OperationalSource = {
  identity: { id: "howen", label: "HOWEN" },
  async loadSnapshot() {
    return {
      kind: "success",
      state: { fleets: [], liveVehicles: [] },
    };
  },
};

describe("createOperationalSources", () => {
  it("composes real Howen and development fixtures locally", () => {
    expect(
      createOperationalSources(
        { includeDevelopmentFixtures: true },
        { howenSource },
      ),
    ).toEqual([howenSource, inMemoryOperationalSource]);
  });

  it("excludes development fixtures from production composition", () => {
    expect(
      createOperationalSources(
        { includeDevelopmentFixtures: false },
        { howenSource },
      ),
    ).toEqual([howenSource]);
  });

  it("adds the canonical catalog source at the seam only when one is injected, keeping the Howen fallback first", () => {
    const canonicalCatalogSource: OperationalSource = {
      identity: { id: "canonical-catalog", label: "Catálogo canónico" },
      async loadSnapshot() {
        return { kind: "success", state: { fleets: [], liveVehicles: [] } };
      },
    };

    expect(
      createOperationalSources(
        { includeDevelopmentFixtures: false },
        { howenSource, canonicalCatalogSource },
      ),
    ).toEqual([howenSource, canonicalCatalogSource]);
  });

  it("reuses one real Howen source when configuration is valid", () => {
    const runtime = createOperationalSourceRuntime({
      HOWEN_BASE_URL: "https://howen.example",
      HOWEN_USERNAME: "operator",
      HOWEN_PASSWORD: "raw-secret",
    });

    expect(runtime.getHowenSource()).toBe(runtime.getHowenSource());
    expect(runtime.getHowenSource().identity).toEqual({
      id: "howen",
      label: "HOWEN",
    });
  });

  it("caches invalid configuration as a neutral failing source", async () => {
    const runtime = createOperationalSourceRuntime({});
    const first = runtime.getHowenSource();

    expect(first).toBe(runtime.getHowenSource());
    await expect(first.loadSnapshot()).resolves.toEqual({
      kind: "failure",
      code: "unavailable",
    });
    expect(first.identity).toEqual({ id: "howen", label: "HOWEN" });
  });
});
