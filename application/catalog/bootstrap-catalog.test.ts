import { describe, expect, it } from "vitest";

import type { OrganizationVehicleAccess, Provider, ProviderConnection, CatalogVehicle } from "@/domain/catalog";

import { createCatalogBootstrapApplication, type CatalogBootstrapPorts } from "./bootstrap-catalog";

function fixture(vehicles: CatalogVehicle[] = []) {
  const providers = new Map<string, Provider>();
  const connections = new Map<string, ProviderConnection>();
  const grants = new Map<string, OrganizationVehicleAccess>();
  let sequence = 0;
  const ports = {
    ids: { create: () => `id-${++sequence}` },
    providers: {
      findByAdapterKey: async (adapterKey: string) => [...providers.values()].find((provider) => provider.adapterKey === adapterKey),
      save: async (provider: Provider) => { providers.set(provider.id, provider); },
    },
    connections: {
      findEnabledByProviderId: async (providerId: string) => [...connections.values()].find((connection) => connection.providerId === providerId && connection.enabled),
      save: async (connection: ProviderConnection) => { connections.set(connection.id, connection); },
    },
    vehicles: { list: async () => vehicles },
    grants: {
      find: async (organizationId: string, vehicleId: string) => grants.get(`${organizationId}:${vehicleId}`),
      save: async (grant: OrganizationVehicleAccess) => { grants.set(`${grant.organizationId}:${grant.vehicleId}`, grant); },
    },
  } as unknown as CatalogBootstrapPorts;
  return { ports, providers, connections, grants };
}

const adapters = [
  { adapterKey: "cybermapa", capabilities: ["gps", "operationalAlerts"], credentialRef: "env:cybermapa", cadenceMinutes: 60 },
  { adapterKey: "howen", capabilities: ["gps", "video", "videoAlerts"], credentialRef: "env:howen", cadenceMinutes: 60 },
];

describe("catalog bootstrap", () => {
  it("registers each adapter as a platform provider with one enabled connection", async () => {
    const { ports, providers, connections } = fixture();

    const result = await createCatalogBootstrapApplication(ports).registerAdapters(adapters);

    expect([...providers.values()].map((provider) => provider.adapterKey).sort()).toEqual(["cybermapa", "howen"]);
    expect([...connections.values()]).toHaveLength(2);
    expect([...connections.values()].every((connection) => connection.enabled)).toBe(true);
    expect(result).toMatchObject({ registered: 2, reused: 0 });
  });

  it("stays idempotent so a repeated bootstrap never duplicates a connection", async () => {
    const { ports, providers, connections } = fixture();
    const application = createCatalogBootstrapApplication(ports);
    await application.registerAdapters(adapters);

    const result = await application.registerAdapters(adapters);

    expect([...providers.values()]).toHaveLength(2);
    expect([...connections.values()]).toHaveLength(2);
    expect(result).toMatchObject({ registered: 0, reused: 2 });
  });

  it("grants every catalog vehicle to the requested organization exactly once", async () => {
    const vehicle = (id: string): CatalogVehicle => ({ id, normalizedPlate: id.toUpperCase(), plate: id.toUpperCase(), placementFleetId: "group-1" });
    const { ports, grants } = fixture([vehicle("abc123"), vehicle("xyz789")]);
    const application = createCatalogBootstrapApplication(ports);

    await application.grantAllVehicles("organization-1");
    const second = await application.grantAllVehicles("organization-1");

    expect([...grants.values()]).toEqual([
      { organizationId: "organization-1", vehicleId: "abc123" },
      { organizationId: "organization-1", vehicleId: "xyz789" },
    ]);
    expect(second).toMatchObject({ granted: 0, reused: 2 });
  });
});
