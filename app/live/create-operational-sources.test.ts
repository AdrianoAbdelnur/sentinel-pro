import { describe, expect, it } from "vitest";

import type { OperationalSource } from "@/application/live";

import { createOperationalSources } from "./create-operational-sources";

const catalogSource: OperationalSource = {
  identity: { id: "canonical-catalog", label: "Catálogo" },
  async loadSnapshot() {
    return { kind: "success", state: { fleets: [], liveVehicles: [] } };
  },
};

describe("createOperationalSources", () => {
  it("uses only the canonical catalog", () => {
    expect(createOperationalSources({ includeDevelopmentFixtures: false }, { catalogSource })).toEqual([catalogSource]);
  });

  it("does not add development fixtures", () => {
    expect(createOperationalSources({ includeDevelopmentFixtures: true }, { catalogSource })).toEqual([catalogSource]);
  });
});
