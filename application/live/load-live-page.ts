import { normalizeGroupLabel, type CapabilityPolicy, type CatalogVehicle, type Provider, type ProviderConnection, type ProviderContribution } from "@/domain/catalog";

import { LIVE_PAGE_SIZE } from "./pagination";
import { createCatalogLiveProjector, type CatalogGroupSummary, type CatalogLiveInput } from "./project-catalog-live";
import type { LiveState } from "./contracts";

type SnapshotMap = CatalogLiveInput["sourceSnapshots"];

export type LoadLivePageInput = { organizationId: string; page?: number; plate?: string; groupId?: string };

export type LoadLivePageDependencies = {
  groups: { listForOrganization(organizationId: string): Promise<CatalogGroupSummary[]> };
  vehicles: {
    countByOrganizationAndGroup(organizationId: string, groupIds: readonly string[], plate?: string): Promise<Readonly<Record<string, number>>>;
    listByOrganizationAndGroupRanges(organizationId: string, ranges: readonly { groupId: string; skip: number; limit: number }[], plate?: string): Promise<CatalogVehicle[]>;
  };
  contributions: { listByVehicleId(vehicleId: string): Promise<ProviderContribution[]> };
  connections: { findById(id: string): Promise<ProviderConnection | undefined> };
  providers: { findById(id: string): Promise<Provider | undefined> };
  policies: { list(): Promise<CapabilityPolicy[]> };
  loadSnapshots(connections: readonly ProviderConnection[], providers: readonly Provider[], contributions: readonly ProviderContribution[], vehiclePlates: ReadonlyMap<string, string>): Promise<SnapshotMap>;
};

export type LoadLivePageResult = { kind: "success"; state: LiveState };

export function createLoadLivePage(dependencies: LoadLivePageDependencies) {
  return async ({ organizationId, page = 1, plate, groupId }: LoadLivePageInput): Promise<LoadLivePageResult> => {
    const requestedPage = Number.isInteger(page) && page > 0 ? page : 1;
    const allGroups = (await dependencies.groups.listForOrganization(organizationId)).filter((group) => !groupId?.trim() || group.id === groupId.trim());
    const normalizedSearch = plate?.trim() ? normalizeGroupLabel(plate) : "";
    const matchingGroups = normalizedSearch === "" ? [] : allGroups.filter((group) => normalizeGroupLabel(group.label).includes(normalizedSearch));
    const groups = matchingGroups.length > 0 ? matchingGroups : allGroups;
    const vehiclePlateFilter = matchingGroups.length > 0 ? undefined : plate?.trim() || undefined;
    const counts = await dependencies.vehicles.countByOrganizationAndGroup(organizationId, groups.map((group) => group.id), vehiclePlateFilter);
    const pages = buildGroupPages(groups, counts);
    const totalPages = Math.max(1, pages.length);
    const resolvedPage = Math.min(requestedPage, totalPages);
    const pageRanges = pages[resolvedPage - 1] ?? [];
    const vehicles = await dependencies.vehicles.listByOrganizationAndGroupRanges(organizationId, pageRanges, vehiclePlateFilter);
    const contributions = (await Promise.all(vehicles.map((vehicle) => dependencies.contributions.listByVehicleId(vehicle.id)))).flat();
    const connectionIds = [...new Set(contributions.map(({ connectionId }) => connectionId))];
    const connections = (await Promise.all(connectionIds.map((id) => dependencies.connections.findById(id)))).filter((connection): connection is ProviderConnection => connection !== undefined);
    const providerIds = [...new Set(connections.map(({ providerId }) => providerId))];
    const providers = (await Promise.all(providerIds.map((id) => dependencies.providers.findById(id)))).filter((provider): provider is Provider => provider !== undefined);
    const [policies, sourceSnapshots] = await Promise.all([
      dependencies.policies.list(),
      vehicles.length === 0 ? Promise.resolve({}) : dependencies.loadSnapshots(connections, providers, contributions, new Map(vehicles.flatMap((vehicle) => vehicle.plate ? [[vehicle.id, vehicle.plate] as const] : []))),
    ]);
    const totalItems = Object.values(counts).reduce((total, count) => total + count, 0);
    const state = createCatalogLiveProjector()({ organizationId, fleets: groups, vehicles, contributions, connections, providers, policies, grants: vehicles.map((vehicle) => ({ organizationId, vehicleId: vehicle.id })), sourceSnapshots });
    return { kind: "success", state: { ...state, fleets: state.fleets.map((fleet) => ({ ...fleet, vehicleCount: counts[fleet.fleetId] ?? 0, isLoaded: true })), pagination: { page: resolvedPage, pageSize: LIVE_PAGE_SIZE, totalItems, totalPages, ...(plate?.trim() ? { plate: plate.trim() } : {}) } } };
  };
}

function buildGroupPages(groups: readonly CatalogGroupSummary[], counts: Readonly<Record<string, number>>): Array<Array<{ groupId: string; skip: number; limit: number }>> {
  const pages: Array<Array<{ groupId: string; skip: number; limit: number }>> = [];
  let current: Array<{ groupId: string; skip: number; limit: number }> = [];
  let currentSize = 0;
  for (const group of groups) {
    let remaining = counts[group.id] ?? 0;
    let skip = 0;
    while (remaining > 0) {
      const available = LIVE_PAGE_SIZE - currentSize;
      if (remaining > available && current.length > 0) {
        pages.push(current);
        current = [];
        currentSize = 0;
        continue;
      }
      const limit = Math.min(remaining, available);
      current.push({ groupId: group.id, skip, limit });
      currentSize += limit;
      remaining -= limit;
      skip += limit;
      if (currentSize === LIVE_PAGE_SIZE) {
        pages.push(current);
        current = [];
        currentSize = 0;
      }
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}
