import { describe, expect, it } from "vitest";

import type {
  CapabilityPolicy,
  ExternalFleetIdentity,
  ExternalVehicleIdentity,
  Fleet,
  ProviderConnection,
  Vehicle,
} from "@/domain/catalog";
import type { Device, DeviceTelemetry } from "@/domain/live";

import { projectCanonicalLive } from "./project-canonical-live";

const organizationId = "org-a";

const connectionHowenA: ProviderConnection = {
  id: "conn-howen-a",
  organizationId,
  credentialRef: "vault:howen/ref-a",
};
const connectionHowenB: ProviderConnection = {
  id: "conn-howen-b",
  organizationId,
  credentialRef: "vault:howen/ref-b",
};
const connectionCybermapa: ProviderConnection = {
  id: "conn-cyber",
  organizationId,
  credentialRef: "vault:cybermapa/ref",
};

const fleetOne: Fleet = { id: "fleet-1", companyId: "company-1", name: "Ruta Norte", kind: "standard" };

describe("projectCanonicalLive — union projection", () => {
  it("projects the union of Vehicles across every external Fleet identity bound to a canonical Fleet, keeping provider-only, native, and unbound-fleet Vehicles, while excluding pending and reassigned identities", () => {
    const fleets: Fleet[] = [
      fleetOne,
      { id: "fleet-unassigned", companyId: "company-1", name: "Unassigned", kind: "unassigned" },
      { id: "fleet-2", companyId: "company-1", name: "Ruta Sur", kind: "standard" },
    ];
    const vehicles: Vehicle[] = [
      { id: "vehicle-shared", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } },
      { id: "vehicle-only-a", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } },
      { id: "vehicle-only-b", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } },
      { id: "vehicle-native", companyId: "company-1", origin: "native", placement: { fleetId: "fleet-1", source: "admin" } },
      { id: "vehicle-unassigned", companyId: "company-1", origin: "native", placement: { fleetId: "fleet-unassigned", source: "system" } },
      { id: "vehicle-reassigned", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-2", source: "admin" } },
    ];
    const fleetIdentities: ExternalFleetIdentity[] = [
      { id: "fi-a", organizationId, connectionId: connectionHowenA.id, entityKind: "fleet", externalId: "FA", label: "ruta norte", fleetId: "fleet-1" },
      { id: "fi-b", organizationId, connectionId: connectionHowenB.id, entityKind: "fleet", externalId: "FB", label: "ruta norte b", fleetId: "fleet-1" },
    ];
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-shared-a", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "SA", vehicleId: "vehicle-shared" },
      { id: "vi-shared-b", organizationId, connectionId: connectionHowenB.id, entityKind: "vehicle", externalId: "SB", vehicleId: "vehicle-shared" },
      { id: "vi-only-a", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "OA", vehicleId: "vehicle-only-a" },
      { id: "vi-only-b", organizationId, connectionId: connectionHowenB.id, entityKind: "vehicle", externalId: "OB", vehicleId: "vehicle-only-b" },
      { id: "vi-pending", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "PENDING" },
      { id: "vi-reassigned", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "RA", vehicleId: "vehicle-reassigned" },
    ];

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionHowenA, connectionHowenB],
      fleets,
      vehicles,
      fleetIdentities,
      vehicleIdentities,
      capabilityPolicies: [],
      sourceSnapshots: {},
    });

    const rosterOne = state.fleets.find((fleet) => fleet.fleetId === "fleet-1");
    const rosterUnassigned = state.fleets.find((fleet) => fleet.fleetId === "fleet-unassigned");
    const rosterTwo = state.fleets.find((fleet) => fleet.fleetId === "fleet-2");

    expect(rosterOne?.vehicleIds.slice().sort()).toEqual(
      ["vehicle-native", "vehicle-only-a", "vehicle-only-b", "vehicle-shared"].sort(),
    );
    expect(rosterUnassigned?.vehicleIds).toEqual(["vehicle-unassigned"]);
    expect(rosterTwo?.vehicleIds).toEqual(["vehicle-reassigned"]);
  });
});

describe("projectCanonicalLive — canonical identity", () => {
  it("renders two provider identities linked to one canonical Vehicle as exactly one live entry, resolving GPS and video from their own default source", () => {
    const vehicle: Vehicle = { id: "vehicle-x", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" }, label: "Unidad X", plate: "AB123CD" };
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-howen", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "HX1", vehicleId: "vehicle-x", presence: "present", capabilityStates: { video: "eligible", videoAlerts: "eligible" } },
      { id: "vi-cyber", organizationId, connectionId: connectionCybermapa.id, entityKind: "vehicle", externalId: "CX1", vehicleId: "vehicle-x", presence: "present", capabilityStates: { gps: "eligible", operationalAlerts: "eligible" } },
    ];
    const device: Device = { id: "device-x", vehicleId: "vehicle-x", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true };
    const telemetry: DeviceTelemetry = { deviceId: "device-x", online: true, latitude: -34.6, longitude: -58.4 };

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionHowenA, connectionCybermapa],
      fleets: [fleetOne],
      vehicles: [vehicle],
      fleetIdentities: [],
      vehicleIdentities,
      capabilityPolicies: [],
      sourceSnapshots: {
        howen: { HX1: { device } },
        cybermapa: { CX1: { telemetry } },
      },
    });

    const matches = state.liveVehicles.filter((entry) => entry.vehicle.id === "vehicle-x");

    expect(matches).toHaveLength(1);
    expect(matches[0]).toEqual({
      vehicle: { id: "vehicle-x", fleetId: "fleet-1", label: "Unidad X", plate: "AB123CD", isActive: true },
      device,
      telemetry,
    });
  });
});

describe("projectCanonicalLive — source-local capability loss", () => {
  it("degrades only the capability a provider stopped reporting, keeping the Vehicle present and the other capability resolving normally", () => {
    const vehicle: Vehicle = { id: "vehicle-x", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } };
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-howen", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "HX1", vehicleId: "vehicle-x", presence: "absent", capabilityStates: { video: "absent", videoAlerts: "absent" } },
      { id: "vi-cyber", organizationId, connectionId: connectionCybermapa.id, entityKind: "vehicle", externalId: "CX1", vehicleId: "vehicle-x", presence: "present", capabilityStates: { gps: "eligible", operationalAlerts: "eligible" } },
    ];
    const device: Device = { id: "device-x", vehicleId: "vehicle-x", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true };
    const telemetry: DeviceTelemetry = { deviceId: "device-x", online: true, latitude: -34.6, longitude: -58.4 };

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionHowenA, connectionCybermapa],
      fleets: [fleetOne],
      vehicles: [vehicle],
      fleetIdentities: [],
      vehicleIdentities,
      capabilityPolicies: [],
      sourceSnapshots: {
        howen: { HX1: { device } },
        cybermapa: { CX1: { telemetry } },
      },
    });

    const [entry] = state.liveVehicles.filter((candidate) => candidate.vehicle.id === "vehicle-x");

    expect(entry).toBeDefined();
    expect(entry.device).toBeUndefined();
    expect(entry.telemetry).toEqual(telemetry);
  });

  it("keeps a capability one connection reports eligible when a second connection of the same provider omits that capability entirely", () => {
    const vehicle: Vehicle = { id: "vehicle-x", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } };
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-howen-a", organizationId, connectionId: connectionHowenA.id, entityKind: "vehicle", externalId: "HXA", vehicleId: "vehicle-x", presence: "present", capabilityStates: { video: "eligible" } },
      { id: "vi-howen-b", organizationId, connectionId: connectionHowenB.id, entityKind: "vehicle", externalId: "HXB", vehicleId: "vehicle-x", presence: "present", capabilityStates: { gps: "eligible" } },
    ];
    const device: Device = { id: "device-x", vehicleId: "vehicle-x", provider: "HOWEN", origin: "howen", kind: "mdvr", isActive: true };

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionHowenA, connectionHowenB],
      fleets: [fleetOne],
      vehicles: [vehicle],
      fleetIdentities: [],
      vehicleIdentities,
      capabilityPolicies: [],
      sourceSnapshots: { howen: { HXA: { device } } },
    });

    const [entry] = state.liveVehicles.filter((candidate) => candidate.vehicle.id === "vehicle-x");

    expect(entry).toBeDefined();
    expect(entry.device).toEqual(device);
  });
});

describe("projectCanonicalLive — capability fallback", () => {
  it("falls back to the next declared source in a Vehicle-level policy's order when the preferred source cannot serve, reusing domain/catalog/precedence", () => {
    const connectionLegacyGps: ProviderConnection = { id: "conn-legacy-gps", organizationId, credentialRef: "vault:legacygps/ref" };
    const connectionBackupGps: ProviderConnection = { id: "conn-backup-gps", organizationId, credentialRef: "vault:backupgps/ref" };
    const vehicle: Vehicle = { id: "vehicle-y", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } };
    const policies: CapabilityPolicy[] = [
      { id: "policy-gps", organizationId, scope: "vehicle", scopeId: "vehicle-y", capability: "gps", sourceOrder: ["legacygps", "backupgps"] },
    ];
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-legacy", organizationId, connectionId: connectionLegacyGps.id, entityKind: "vehicle", externalId: "LG1", vehicleId: "vehicle-y", capabilityStates: { gps: "absent" } },
      { id: "vi-backup", organizationId, connectionId: connectionBackupGps.id, entityKind: "vehicle", externalId: "BG1", vehicleId: "vehicle-y", capabilityStates: { gps: "eligible" } },
    ];
    const backupTelemetry: DeviceTelemetry = { deviceId: "device-backup", latitude: -31, longitude: -64 };

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionLegacyGps, connectionBackupGps],
      fleets: [fleetOne],
      vehicles: [vehicle],
      fleetIdentities: [],
      vehicleIdentities,
      capabilityPolicies: policies,
      sourceSnapshots: { backupgps: { BG1: { telemetry: backupTelemetry } } },
    });

    const [entry] = state.liveVehicles;

    expect(entry.telemetry).toEqual(backupTelemetry);
  });

  it("resolves telemetry as undefined without throwing when a capability resolves to a source that has no snapshot data supplied at all", () => {
    const vehicle: Vehicle = { id: "vehicle-w", companyId: "company-1", origin: "provider", placement: { fleetId: "fleet-1", source: "system" } };
    const vehicleIdentities: ExternalVehicleIdentity[] = [
      { id: "vi-w", organizationId, connectionId: connectionCybermapa.id, entityKind: "vehicle", externalId: "CW1", vehicleId: "vehicle-w", capabilityStates: { gps: "eligible" } },
    ];

    const state = projectCanonicalLive({
      organizationId,
      connections: [connectionCybermapa],
      fleets: [fleetOne],
      vehicles: [vehicle],
      fleetIdentities: [],
      vehicleIdentities,
      capabilityPolicies: [],
      sourceSnapshots: {},
    });

    expect(state.liveVehicles[0].telemetry).toBeUndefined();
  });
});

