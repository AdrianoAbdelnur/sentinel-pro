import { describe, expect, it } from "vitest";

import { toCompanyCandidateDocument, toVehicleDocument } from "./catalog-documents";

describe("catalog document mapping", () => {
  it("omits undefined optional vehicle fields so strict MongoDB validation accepts native vehicles without them", () => {
    const now = new Date("2026-08-09T00:00:00.000Z");
    const document = toVehicleDocument({ id: "v", companyId: "c", origin: "native", placement: { fleetId: "f", source: "admin" }, label: undefined, plate: undefined, internalCode: undefined }, now);

    expect(document).not.toHaveProperty("label");
    expect(document).not.toHaveProperty("plate");
    expect(document).not.toHaveProperty("internalCode");
  });

  it("omits an undefined companyId so strict MongoDB validation accepts unbound company candidates", () => {
    const now = new Date("2026-08-09T00:00:00.000Z");
    const document = toCompanyCandidateDocument({ id: "cand", organizationId: "org", connectionId: "conn", normalizedLabel: "acme", companyId: undefined }, now);

    expect(document).not.toHaveProperty("companyId");
  });
});
