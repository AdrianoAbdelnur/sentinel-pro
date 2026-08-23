import { describe, expect, it, vi } from "vitest";

const loadSnapshot = vi.fn();
const fetchCurrentData = vi.fn();

vi.mock("@/integrations/howen/config", () => ({ readHowenConfig: () => ({}) }));
vi.mock("@/integrations/howen/session", () => ({ createHowenSessionManager: () => ({}) }));
vi.mock("@/integrations/howen/client", () => ({ createHowenClient: () => ({}) }));
vi.mock("@/integrations/howen/howen-operational-source", () => ({
  createHowenOperationalSource: () => ({ identity: { id: "howen", label: "HOWEN" }, loadSnapshot }),
}));
vi.mock("@/integrations/cybermapa/config", () => ({ readCybermapaConfig: () => ({}) }));
vi.mock("@/integrations/cybermapa/client", () => ({ createCybermapaClient: () => ({ fetchCurrentData }) }));

import { loadLiveSnapshots, mapCybermapaCurrentDataToCatalogSnapshots, mapHowenOperationalStateToCatalogSnapshots } from "./live-snapshot-adapters";

const howenProvider = { id: "provider-howen", adapterKey: "howen", capabilities: ["video"] };
const cybermapaProvider = { id: "provider-cybermapa", adapterKey: "cybermapa", capabilities: ["gps"] };
const connection = (id: string, providerId: string) => ({ id, providerId, credentialRef: "ref", enabled: true, cadenceMinutes: 60 });

describe("catalog Live snapshot adapters", () => {
  it("maps Cybermapa current GPS data to the canonical telemetry contract", () => {
    expect(mapCybermapaCurrentDataToCatalogSnapshots([
      { gps: "gps-1", patente: "AB 123 CD", latitud: "-34.6", longitud: "-58.4", fecha: "21/09/2016 11:48:32", velocidad: "12", sentido: "217" },
    ], [{ id: "contribution-1", connectionId: "connection-cybermapa", externalId: "gps-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" }], new Map([["vehicle-1", "AB123CD"]]))).toEqual({
      "gps-1": {
        telemetry: {
          deviceId: "cybermapa:gps-1",
          gpsAt: "2016-09-21T14:48:32.000Z",
          latitude: -34.6,
          longitude: -58.4,
          speedKmH: 12,
          headingDeg: 217,
        },
      },
    });
  });

  it("loads Cybermapa only for the contributions of the group", async () => {
    fetchCurrentData.mockResolvedValueOnce([{ gps: "gps-1", patente: "AB123CD", latitud: "-34.6", longitud: "-58.4" }]);

    await expect(loadLiveSnapshots(
      [connection("connection-cybermapa", cybermapaProvider.id)],
      [cybermapaProvider],
      [{ id: "contribution-1", connectionId: "connection-cybermapa", externalId: "gps-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" }],
      new Map([["vehicle-1", "AB123CD"]]),
    )).resolves.toEqual({
      "connection-cybermapa": {
        "gps-1": { telemetry: expect.objectContaining({ latitude: -34.6, longitude: -58.4 }) },
      },
    });
    expect(fetchCurrentData).toHaveBeenCalledWith(["AB123CD"], "patente");
  });

  it("maps Howen operational data by contribution without exposing provider roster ownership", () => {
    const snapshots = mapHowenOperationalStateToCatalogSnapshots(
      {
        fleets: [{ fleetId: "howen:fleet:external", label: "Provider fleet", vehicleIds: ["howen:vehicle:device-1"] }],
        liveVehicles: [{
          vehicle: { id: "howen:vehicle:device-1", fleetId: "howen:fleet:external", isActive: true },
          device: { id: "howen:device:device-1", vehicleId: "howen:vehicle:device-1", externalId: "device-1", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true },
          telemetry: { deviceId: "howen:device:device-1", online: true },
        }],
      },
      [{ id: "contribution-1", connectionId: "connection-1", externalId: "device-1", vehicleId: "canonical-vehicle", capabilities: { video: "eligible" }, presence: "present" }],
    );

    expect(snapshots).toEqual({
      "device-1": {
        device: expect.objectContaining({ vehicleId: "canonical-vehicle", externalId: "device-1" }),
        telemetry: { deviceId: "howen:device:device-1", online: true },
      },
    });
    expect(JSON.stringify(snapshots)).not.toContain("Provider fleet");
  });

  it("keeps the canonical catalog loadable when a provider operational source fails", async () => {
    loadSnapshot.mockResolvedValue({ kind: "failure", code: "unavailable" });

    await expect(loadLiveSnapshots(
      [connection("connection-howen", howenProvider.id)],
      [howenProvider],
      [{ id: "contribution-1", connectionId: "connection-howen", externalId: "device-1", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "present" }],
    )).resolves.toEqual({ "connection-howen": {} });
  });

  it("isolates one failing connection from the snapshots of the others", async () => {
    loadSnapshot
      .mockRejectedValueOnce(new Error("provider exploded"))
      .mockResolvedValueOnce({ kind: "success", state: { fleets: [], liveVehicles: [{ vehicle: { id: "v", isActive: true }, telemetry: { deviceId: "d", online: true }, device: { id: "d", vehicleId: "v", externalId: "device-2", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true } }] } });

    const snapshots = await loadLiveSnapshots(
      [connection("connection-broken", howenProvider.id), connection("connection-healthy", howenProvider.id)],
      [howenProvider],
      [
        { id: "contribution-1", connectionId: "connection-broken", externalId: "device-1", vehicleId: "vehicle-1", capabilities: { video: "eligible" }, presence: "present" },
        { id: "contribution-2", connectionId: "connection-healthy", externalId: "device-2", vehicleId: "vehicle-2", capabilities: { video: "eligible" }, presence: "present" },
      ],
    );

    expect(snapshots["connection-broken"]).toEqual({});
    expect(snapshots["connection-healthy"]).toHaveProperty("device-2");
  });

  it("returns an empty snapshot set for a provider without an operational adapter", async () => {
    await expect(loadLiveSnapshots(
      [connection("connection-cybermapa", cybermapaProvider.id)],
      [cybermapaProvider],
      [{ id: "contribution-1", connectionId: "connection-cybermapa", externalId: "gps-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" }],
    )).resolves.toEqual({ "connection-cybermapa": {} });
  });
});
