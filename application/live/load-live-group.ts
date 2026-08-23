import type {
  CapabilityPolicy,
  CatalogGroup,
  CatalogVehicle,
  Provider,
  ProviderConnection,
  ProviderContribution,
} from "@/domain/catalog";

import type { LiveState } from "./contracts";
import { projectCatalogGroupVehicles, type CatalogLiveInput } from "./project-catalog-live";

type SnapshotMap = CatalogLiveInput["sourceSnapshots"];

export type LoadLiveGroupInput = {
  organizationId: string;
  groupId: string;
};

export type LoadLiveGroupDependencies = {
  groups: {
    findById(id: string): Promise<CatalogGroup | undefined>;
  };
  vehicles: {
    listByOrganizationAndGroupId(organizationId: string, groupId: string): Promise<CatalogVehicle[]>;
  };
  contributions: {
    listByVehicleId(vehicleId: string): Promise<ProviderContribution[]>;
  };
  connections: {
    findById(id: string): Promise<ProviderConnection | undefined>;
  };
  providers: {
    findById(id: string): Promise<Provider | undefined>;
  };
  policies: {
    list(): Promise<CapabilityPolicy[]>;
  };
  loadSnapshots(
    connections: readonly ProviderConnection[],
    providers: readonly Provider[],
    contributions: readonly ProviderContribution[],
    vehiclePlates: ReadonlyMap<string, string>,
  ): Promise<SnapshotMap>;
};

export type LoadLiveGroupResult =
  | { kind: "not-found" }
  | { kind: "success"; state: LiveState };

export function createLoadLiveGroup(dependencies: LoadLiveGroupDependencies) {
  return async ({ organizationId, groupId }: LoadLiveGroupInput): Promise<LoadLiveGroupResult> => {
    const group = await dependencies.groups.findById(groupId);
    if (!group) return { kind: "not-found" };

    const vehicles = await dependencies.vehicles.listByOrganizationAndGroupId(organizationId, groupId);
    const contributions = (await Promise.all(
      vehicles.map((vehicle) => dependencies.contributions.listByVehicleId(vehicle.id)),
    )).flat();
    const connectionIds = [...new Set(contributions.map(({ connectionId }) => connectionId))];
    const connections = (await Promise.all(connectionIds.map((id) => dependencies.connections.findById(id))))
      .filter((connection): connection is ProviderConnection => connection !== undefined);
    const providerIds = [...new Set(connections.map(({ providerId }) => providerId))];
    const providers = (await Promise.all(providerIds.map((id) => dependencies.providers.findById(id))))
      .filter((provider): provider is Provider => provider !== undefined);
    const [policies, sourceSnapshots] = await Promise.all([
      dependencies.policies.list(),
      dependencies.loadSnapshots(
        connections,
        providers,
        contributions,
        new Map(vehicles.flatMap((vehicle) => vehicle.plate ? [[vehicle.id, vehicle.plate] as const] : [])),
      ),
    ]);

    return {
      kind: "success",
      state: projectCatalogGroupVehicles(group, vehicles, { contributions, connections, policies, sourceSnapshots }),
    };
  };
}
