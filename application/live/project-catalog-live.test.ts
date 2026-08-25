import { describe, expect, it } from "vitest";

import {
  createCatalogOperationalSource,
  createCatalogLiveProjector,
  createCatalogSummaryOperationalSource,
  type CatalogLiveInput,
} from "./project-catalog-live";

it("exposes the canonical projection through the provider-neutral operational source contract", async () => {
  const source = createCatalogOperationalSource(async () => input);

  await expect(source.loadSnapshot()).resolves.toEqual({ kind: "success", state: createCatalogLiveProjector()(input) });
  expect(source.identity).toEqual({ id: "canonical-catalog", label: "Catálogo" });
});

it("translates catalog loading failures to the provider-neutral unavailable result", async () => {
  const source = createCatalogOperationalSource(async () => {
    throw new Error("mongodb secret failure");
  });

  await expect(source.loadSnapshot()).resolves.toEqual({ kind: "failure", code: "unavailable" });
});

it("projects group summaries without loading vehicles", async () => {
  const source = createCatalogSummaryOperationalSource(async () => [
    { id: "fleet-1", label: "North", vehicleCount: 7 },
  ]);

  await expect(source.loadSnapshot()).resolves.toEqual({
    kind: "success",
    state: {
      fleets: [{ fleetId: "fleet-1", label: "North", vehicleIds: [], vehicleCount: 7, isLoaded: false }],
      liveVehicles: [],
    },
  });
});

const input: CatalogLiveInput = {
  organizationId: "org-1",
  fleets: [{ id: "fleet-1", label: "North" }],
  vehicles: [
    { id: "vehicle-assigned", normalizedPlate: "AAA", plate: "AAA", placementFleetId: "fleet-1" },
    { id: "vehicle-hidden", normalizedPlate: "BBB", plate: "BBB", placementFleetId: "fleet-1" },
  ],
  contributions: [
    {
      id: "contribution-gps",
      connectionId: "connection-gps",
      externalId: "gps-1",
      vehicleId: "vehicle-assigned",
      capabilities: { gps: "eligible" },
      presence: "present",
    },
  ],
  connections: [{ id: "connection-gps", providerId: "cybermapa", credentialRef: "ref", enabled: true, cadenceMinutes: 60 }],
  policies: [],
  grants: [{ organizationId: "org-1", vehicleId: "vehicle-assigned" }],
  sourceSnapshots: {
    "connection-gps": { "gps-1": { telemetry: { deviceId: "device-1", latitude: -34.6, longitude: -58.4 } } },
  },
};

describe("projectCatalogLive", () => {
  it("resolves a provider by adapter key when persistence uses a provider UUID", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      providers: [{ id: "provider-uuid", adapterKey: "cybermapa", capabilities: ["gps"] }],
      connections: [{ id: "connection-gps", providerId: "provider-uuid", credentialRef: "ref", enabled: true, cadenceMinutes: 60 }],
    });

    expect(state.liveVehicles[0].telemetry).toMatchObject({ deviceId: "device-1" });
  });

  it("falls back to eligible Howen telemetry when no preferred Cybermapa contribution exists", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      contributions: [{
        id: "contribution-howen",
        connectionId: "connection-howen",
        externalId: "howen-1",
        vehicleId: "vehicle-assigned",
        capabilities: { gps: "eligible", video: "eligible" },
        presence: "present",
      }],
      connections: [{ id: "connection-howen", providerId: "howen", credentialRef: "ref", enabled: true, cadenceMinutes: 60 }],
      sourceSnapshots: {
        "connection-howen": {
          "howen-1": {
            device: { id: "device-howen", vehicleId: "vehicle-assigned", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true },
            telemetry: { deviceId: "device-howen", online: true, latitude: -34.6, longitude: -58.4 },
          },
        },
      },
    });

    expect(state.liveVehicles[0]).toMatchObject({
      device: { id: "device-howen" },
      telemetry: { deviceId: "device-howen", latitude: -34.6, longitude: -58.4 },
    });
  });

  it("falls back to Howen telemetry when the preferred Cybermapa contribution has no live snapshot", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      contributions: [
        ...input.contributions,
        {
          id: "contribution-howen",
          connectionId: "connection-howen",
          externalId: "howen-1",
          vehicleId: "vehicle-assigned",
          capabilities: { gps: "eligible", video: "eligible" },
          presence: "present",
        },
      ],
      connections: [
        ...input.connections,
        { id: "connection-howen", providerId: "howen", credentialRef: "ref", enabled: true, cadenceMinutes: 60 },
      ],
      sourceSnapshots: {
        "connection-howen": {
          "howen-1": {
            telemetry: { deviceId: "device-howen", online: true, latitude: -34.6, longitude: -58.4 },
          },
        },
      },
    });

    expect(state.liveVehicles[0].telemetry).toMatchObject({ deviceId: "device-howen", latitude: -34.6 });
  });

  it("discloses only vehicles assigned to the requesting organization", () => {
    const state = createCatalogLiveProjector()(input);

    expect(state.liveVehicles.map(({ vehicle }) => vehicle.id)).toEqual(["vehicle-assigned"]);
    expect(state.fleets).toEqual([{ fleetId: "fleet-1", label: "North", vehicleIds: ["vehicle-assigned"] }]);
  });

  it("does not let an unassigned catalog vehicle affect the organization projection", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      grants: [],
    });

    expect(state).toEqual({ fleets: [], liveVehicles: [] });
  });

  it("keeps an assigned catalog vehicle visible without provider data", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      sourceSnapshots: {},
    });

    expect(state).toEqual({
      fleets: [{ fleetId: "fleet-1", label: "North", vehicleIds: ["vehicle-assigned"] }],
      liveVehicles: [{
        vehicle: {
          id: "vehicle-assigned",
          fleetId: "fleet-1",
          plate: "AAA",
          isActive: true,
        },
        device: undefined,
        telemetry: undefined,
        operationalAlerts: { kind: "unavailable" },
        videoAlerts: { kind: "unavailable" },
      }],
    });
  });

  it("resolves capability sources independently without changing the Live contract", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      contributions: [
        ...input.contributions,
        {
          id: "contribution-video",
          connectionId: "connection-video",
          externalId: "video-1",
          vehicleId: "vehicle-assigned",
          capabilities: { video: "eligible" },
          presence: "present",
        },
      ],
      connections: [
        ...input.connections,
        { id: "connection-video", providerId: "howen", credentialRef: "ref", enabled: true, cadenceMinutes: 60 },
      ],
      sourceSnapshots: {
        ...input.sourceSnapshots,
        "connection-video": { "video-1": { device: { id: "device-1", vehicleId: "vehicle-assigned", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true } } },
      },
    });

    expect(state.liveVehicles[0]).toMatchObject({
      vehicle: { id: "vehicle-assigned" },
      telemetry: { latitude: -34.6 },
      device: { provider: "HOWEN" },
    });
  });

  it("uses the policy order and the selected contribution snapshot for each capability", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      policies: [{ id: "gps-policy", capability: "gps", sourceOrder: ["backup", "cybermapa"] }],
      contributions: [
        ...input.contributions,
        {
          id: "contribution-backup",
          connectionId: "connection-backup",
          externalId: "backup-1",
          vehicleId: "vehicle-assigned",
          capabilities: { gps: "eligible" },
          presence: "present",
        },
        {
          id: "contribution-cybermapa-other",
          connectionId: "connection-cyber-other",
          externalId: "gps-2",
          vehicleId: "vehicle-assigned",
          capabilities: { gps: "eligible" },
          presence: "present",
        },
      ],
      connections: [
        ...input.connections,
        { id: "connection-backup", providerId: "backup", credentialRef: "ref", enabled: true, cadenceMinutes: 60 },
        { id: "connection-cyber-other", providerId: "cybermapa", credentialRef: "ref", enabled: true, cadenceMinutes: 60 },
      ],
      sourceSnapshots: {
        ...input.sourceSnapshots,
        "connection-backup": { "backup-1": { telemetry: { deviceId: "backup-device", latitude: -31, longitude: -64 } } },
        "connection-cyber-other": {
          "gps-2": { telemetry: { deviceId: "other-device", latitude: -30, longitude: -63 } },
        },
      },
    });

    expect(state.liveVehicles[0].telemetry).toEqual({ deviceId: "backup-device", latitude: -31, longitude: -64 });
  });

  it("keeps snapshots isolated when same-provider connections reuse an external id", () => {
    const state = createCatalogLiveProjector()({
      ...input,
      contributions: [
        ...input.contributions,
        {
          id: "contribution-gps-other",
          connectionId: "connection-gps-other",
          externalId: "gps-1",
          vehicleId: "vehicle-assigned",
          capabilities: { gps: "eligible" },
          presence: "present",
        },
      ],
      connections: [
        ...input.connections,
        { id: "connection-gps-other", providerId: "cybermapa", credentialRef: "ref", enabled: true, cadenceMinutes: 60 },
      ],
      sourceSnapshots: {
        ...input.sourceSnapshots,
        "connection-gps-other": { "gps-1": { telemetry: { deviceId: "other-device", latitude: -30, longitude: -63 } } },
      },
    });

    expect(state.liveVehicles[0].telemetry).toEqual({ deviceId: "other-device", latitude: -30, longitude: -63 });
  });
});
