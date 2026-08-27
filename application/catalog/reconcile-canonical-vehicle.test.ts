import { describe, expect, it } from "vitest";
import { reconcileCanonicalVehicle } from "./reconcile-canonical-vehicle";
import { createCatalogDevice, createCatalogVehicle, type ProviderVehicleObservation } from "@/domain/catalog";

const observation = (connectionId: string, company: string): ProviderVehicleObservation => ({ id: connectionId, contributionId: connectionId, connectionId, deviceId: connectionId, company, companyResolution: "direct", observedAt: new Date("2026-01-01") });

describe("reconcileCanonicalVehicle", () => {
  it("uses configured precedence while retaining conflicting current companies", () => {
    const result = reconcileCanonicalVehicle(createCatalogVehicle({ id: "v", normalizedPlate: "ABC123", plate: "ABC123", placementFleetId: "g" }), [observation("howen", "Howen Co"), observation("cybermapa", "Cyber Co")]);
    expect(result.vehicle.company).toBe("Cyber Co");
    expect(result.conflict?.values).toEqual(["Howen Co", "Cyber Co"]);
  });

  it("is order independent", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "ABC123", plate: "ABC123", placementFleetId: "g" });
    expect(reconcileCanonicalVehicle(vehicle, [observation("howen", "H"), observation("cybermapa", "C")]).vehicle.company).toBe(reconcileCanonicalVehicle(vehicle, [observation("cybermapa", "C"), observation("howen", "H")]).vehicle.company);
  });

  it("projects current descriptive fields and active state from present observations", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "", plate: "", placementFleetId: "g", active: false });
    const device = createCatalogDevice({ id: "device", vehicleId: "v", connectionId: "cybermapa", deviceId: "device", status: "active", capabilities: {}, presence: "present" });
    const result = reconcileCanonicalVehicle(vehicle, [{ ...observation("cybermapa", "C"), providerKey: "cybermapa", name: "Truck", make: "Ford", model: "Cargo", plate: "AB123CD", normalizedPlate: "AB123CD", active: true, presence: "present" }], undefined, [device]);
    expect(result.vehicle).toMatchObject({ company: "C", name: "Truck", make: "Ford", model: "Cargo", plate: "AB123CD", normalizedPlate: "AB123CD", active: true });
  });

  it("ignores absent observations when deriving canonical state", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "", plate: "", placementFleetId: "g", active: true });
    const result = reconcileCanonicalVehicle(vehicle, [{ ...observation("cybermapa", "Old"), presence: "absent", active: false }]);
    expect(result.vehicle.active).toBe(false);
    expect(result.vehicle.company).toBeUndefined();
  });

  it("compares company observations by their normalized value", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "", plate: "", placementFleetId: "g" });
    const result = reconcileCanonicalVehicle(vehicle, [observation("cybermapa", " Acme S.A. "), observation("howen", "acme-sa")]);

    expect(result.vehicle.company).toBe("Acme S.A.");
    expect(result.conflict).toBeUndefined();
  });

  it("uses the only current provider company and reflects its next value", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "", plate: "", placementFleetId: "g" });

    const first = reconcileCanonicalVehicle(vehicle, [observation("howen", "First")]);
    const changed = reconcileCanonicalVehicle(first.vehicle, [observation("howen", "Changed")]);

    expect(first.vehicle.company).toBe("First");
    expect(changed.vehicle.company).toBe("Changed");
    expect(changed.conflict).toBeUndefined();
  });

  it("selects every descriptive field independently by source precedence", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "OLD123", plate: "OLD 123", placementFleetId: "g" });
    const result = reconcileCanonicalVehicle(vehicle, [
      { ...observation("cybermapa", "Primary"), providerKey: "cybermapa", name: "Primary name" },
      { ...observation("howen", "Fallback"), providerKey: "howen", plate: "NEW 456", normalizedPlate: "NEW456", make: "Ford", model: "Cargo" },
    ]);

    expect(result.vehicle).toMatchObject({ name: "Primary name", make: "Ford", model: "Cargo", plate: "NEW 456", normalizedPlate: "NEW456" });
  });

  it("clears stale canonical fields when current observations no longer provide them", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "OLD123", plate: "OLD 123", placementFleetId: "g", name: "Old", make: "Old", model: "Old", company: "Old" });
    const result = reconcileCanonicalVehicle(vehicle, [{ ...observation("cybermapa", ""), providerKey: "cybermapa" }]);

    expect(result.vehicle).toEqual(expect.objectContaining({ normalizedPlate: "", plate: "" }));
    expect(result.vehicle.name).toBeUndefined();
    expect(result.vehicle.make).toBeUndefined();
    expect(result.vehicle.model).toBeUndefined();
    expect(result.vehicle.company).toBeUndefined();
  });

  it("requires an explicitly active present device to make the vehicle active", () => {
    const vehicle = createCatalogVehicle({ id: "v", normalizedPlate: "", plate: "", placementFleetId: "g", active: true });
    const base = { vehicleId: "v", connectionId: "connection", capabilities: {}, presence: "present" as const };
    const unknown = createCatalogDevice({ ...base, id: "unknown", deviceId: "unknown" });
    const inactive = createCatalogDevice({ ...base, id: "inactive", deviceId: "inactive", status: "inactive" });
    const active = createCatalogDevice({ ...base, id: "active", deviceId: "active", status: "active" });

    expect(reconcileCanonicalVehicle(vehicle, [], undefined, [unknown, inactive]).vehicle.active).toBe(false);
    expect(reconcileCanonicalVehicle(vehicle, [], undefined, [unknown, inactive, active]).vehicle.active).toBe(true);
  });
});
