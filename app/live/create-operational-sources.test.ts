import { describe, expect, it } from "vitest";

import type { OperationalSource } from "@/application/live";
import { inMemoryOperationalSource } from "@/integrations/live/in-memory/in-memory-live-data-source";

import { createOperationalSources } from "./create-operational-sources";

const catalogSource: OperationalSource = {
  identity: { id: "canonical-catalog", label: "Catálogo" },
  async loadSnapshot() {
    return { kind: "success", state: { fleets: [], liveVehicles: [] } };
  },
};

describe("createOperationalSources", () => {
  it("uses only the canonical catalog in production", () => {
    expect(createOperationalSources({ includeDevelopmentFixtures: false }, { catalogSource })).toEqual([catalogSource]);
  });

  it("adds development fixtures after the canonical catalog only in development", () => {
    expect(createOperationalSources({ includeDevelopmentFixtures: true }, { catalogSource })).toEqual([catalogSource, inMemoryOperationalSource]);
  });
});
