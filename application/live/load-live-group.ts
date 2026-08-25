import type {
  CapabilityPolicy,
  CatalogGroup,
  CatalogVehicle,
  Provider,
  ProviderConnection,
  ProviderContribution,
} from "@/domain/catalog";

import type { LiveState } from "./contracts";
import { LIVE_PAGE_SIZE } from "./pagination";
import { projectCatalogGroupVehicles, type CatalogLiveInput } from "./project-catalog-live";

type SnapshotMap = CatalogLiveInput["sourceSnapshots"];

export type LoadLiveGroupInput = {
  organizationId: string;
  groupId: string;
  page?: number;
  plate?: string;
};

export type LoadLiveGroupDependencies = {
  groups: {
    findById(id: string): Promise<CatalogGroup | undefined>;
  };
  vehicles: {
    listByOrganizationAndGroupId(organizationId: string, groupId: string, input?: { page: number; pageSize: number; plate?: string }): Promise<{ items: CatalogVehicle[]; total: number }>;
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
  return async ({ organizationId, groupId, page = 1, plate }: LoadLiveGroupInput): Promise<LoadLiveGroupResult> => {
    const group = await dependencies.groups.findById(groupId);
    if (!group) return { kind: "not-found" };

    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const input = { page: requestedPage, pageSize: LIVE_PAGE_SIZE, ...(plate?.trim() ? { plate: plate.trim() } : {}) };
    let result = await dependencies.vehicles.listByOrganizationAndGroupId(organizationId, groupId, input);
    const totalPages = Math.max(1, Math.ceil(result.total / LIVE_PAGE_SIZE));
    const resolvedPage = Math.min(requestedPage, totalPages);
    if (resolvedPage !== requestedPage) {
      result = await dependencies.vehicles.listByOrganizationAndGroupId(organizationId, groupId, { ...input, page: resolvedPage });
    }
    const vehicles = result.items;
    if (vehicles.length === 0) {
      return { kind: "success", state: { fleets: [{ fleetId: group.id, label: group.label, vehicleIds: [], vehicleCount: result.total, isLoaded: true, pagination: { page: resolvedPage, pageSize: LIVE_PAGE_SIZE, totalItems: result.total, totalPages, ...(plate?.trim() ? { plate: plate.trim() } : {}) } }], liveVehicles: [] } };
    }
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
      state: withPagination(projectCatalogGroupVehicles(group, vehicles, { contributions, connections, providers, policies, sourceSnapshots }), { page: resolvedPage, totalItems: result.total, totalPages, plate }),
    };
  };
}

function withPagination(state: LiveState, input: { page: number; totalItems: number; totalPages: number; plate?: string }): LiveState {
  return { ...state, fleets: state.fleets.map((fleet) => ({ ...fleet, vehicleCount: input.totalItems, pagination: { page: input.page, pageSize: LIVE_PAGE_SIZE, totalItems: input.totalItems, totalPages: input.totalPages, ...(input.plate?.trim() ? { plate: input.plate.trim() } : {}) } })) };
}
