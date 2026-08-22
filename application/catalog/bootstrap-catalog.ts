import { createOrganizationVehicleAccess, createProvider, createProviderConnection, type CatalogVehicle, type OrganizationVehicleAccess, type Provider, type ProviderConnection } from "@/domain/catalog";

export type CatalogAdapterRegistration = {
  adapterKey: string;
  capabilities: readonly string[];
  credentialRef: string;
  cadenceMinutes: number;
};

export const CATALOG_ADAPTER_REGISTRATIONS: readonly CatalogAdapterRegistration[] = [
  { adapterKey: "cybermapa", capabilities: ["gps", "operationalAlerts"], credentialRef: "env:cybermapa", cadenceMinutes: 60 },
  { adapterKey: "howen", capabilities: ["gps", "video", "videoAlerts"], credentialRef: "env:howen", cadenceMinutes: 60 },
];

export type CatalogBootstrapPorts = {
  ids: { create(): string };
  providers: {
    findByAdapterKey(adapterKey: string): Promise<Provider | undefined>;
    save(provider: Provider): Promise<void>;
  };
  connections: {
    findEnabledByProviderId(providerId: string): Promise<ProviderConnection | undefined>;
    save(connection: ProviderConnection): Promise<void>;
  };
  vehicles: { list(): Promise<CatalogVehicle[]> };
  grants: {
    find(organizationId: string, vehicleId: string): Promise<OrganizationVehicleAccess | undefined>;
    save(grant: OrganizationVehicleAccess): Promise<void>;
  };
};

export type AdapterRegistrationResult = { registered: number; reused: number };
export type VehicleGrantResult = { granted: number; reused: number };

export function createCatalogBootstrapApplication(ports: CatalogBootstrapPorts) {
  async function resolveProvider(registration: CatalogAdapterRegistration): Promise<{ provider: Provider; created: boolean }> {
    const existing = await ports.providers.findByAdapterKey(registration.adapterKey);
    if (existing) return { provider: existing, created: false };
    const provider = createProvider({ id: ports.ids.create(), adapterKey: registration.adapterKey, capabilities: [...registration.capabilities] });
    await ports.providers.save(provider);
    return { provider, created: true };
  }

  async function resolveConnection(provider: Provider, registration: CatalogAdapterRegistration): Promise<boolean> {
    if (await ports.connections.findEnabledByProviderId(provider.id)) return false;
    await ports.connections.save(createProviderConnection({
      id: ports.ids.create(),
      providerId: provider.id,
      credentialRef: registration.credentialRef,
      enabled: true,
      cadenceMinutes: registration.cadenceMinutes,
    }));
    return true;
  }

  return {
    async registerAdapters(registrations: readonly CatalogAdapterRegistration[]): Promise<AdapterRegistrationResult> {
      let registered = 0;
      let reused = 0;
      for (const registration of registrations) {
        const { provider } = await resolveProvider(registration);
        if (await resolveConnection(provider, registration)) registered += 1;
        else reused += 1;
      }
      return { registered, reused };
    },

    async grantAllVehicles(organizationId: string): Promise<VehicleGrantResult> {
      let granted = 0;
      let reused = 0;
      for (const vehicle of await ports.vehicles.list()) {
        if (await ports.grants.find(organizationId, vehicle.id)) { reused += 1; continue; }
        await ports.grants.save(createOrganizationVehicleAccess({ organizationId, vehicleId: vehicle.id }));
        granted += 1;
      }
      return { granted, reused };
    },
  };
}
