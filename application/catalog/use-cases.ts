import {
  belongsToOrganization,
  createUnassignedFleet,
  reconcilePlacement,
  resolvePlacement,
  type Company,
  type Fleet,
  type PlacementCandidate,
  type Vehicle,
} from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type {
  AssignVehicleFleetResult,
  CreateCompanyResult,
  CreateFleetResult,
  CreateVehicleResult,
  GetCompanyHierarchyResult,
  PlaceVehicleCandidatesResult,
} from "./contracts";
import type { CatalogApplicationPorts } from "./ports";

export function createCatalogApplication(ports: CatalogApplicationPorts) {
  async function requireCompanyInTenant(companyId: string, organizationId: string): Promise<Company | undefined> {
    const company = await ports.companies.findById(companyId);
    return company && belongsToOrganization(company, organizationId) ? company : undefined;
  }

  async function createCompany({ actor, name }: { actor: AuthorizationContext; name: string }): Promise<CreateCompanyResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const company: Company = { id: ports.ids.create(), organizationId: actor.organizationId, name };
    const unassignedFleet = createUnassignedFleet(ports.ids.create(), company.id);
    await ports.transactions.run(async ({ companies, fleets }) => {
      await companies.save(company);
      await fleets.save(unassignedFleet);
    });
    return { kind: "created", company, unassignedFleet };
  }

  async function createFleet({ actor, companyId, name }: { actor: AuthorizationContext; companyId: string; name: string }): Promise<CreateFleetResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const company = await requireCompanyInTenant(companyId, actor.organizationId);
    if (!company) return { kind: "forbidden" };
    const fleet: Fleet = { id: ports.ids.create(), companyId, name, kind: "standard" };
    await ports.fleets.save(fleet);
    return { kind: "created", fleet };
  }

  async function createVehicle({ actor, companyId, fleetId, label, plate, internalCode }: { actor: AuthorizationContext; companyId: string; fleetId: string; label?: string; plate?: string; internalCode?: string }): Promise<CreateVehicleResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const company = await requireCompanyInTenant(companyId, actor.organizationId);
    if (!company) return { kind: "forbidden" };
    const fleet = await ports.fleets.findById(fleetId);
    if (!fleet || fleet.companyId !== companyId) return { kind: "forbidden" };
    const vehicle: Vehicle = { id: ports.ids.create(), companyId, origin: "native", placement: { fleetId, source: "admin" }, label, plate, internalCode };
    await ports.vehicles.save(vehicle);
    return { kind: "created", vehicle };
  }

  async function getCompanyHierarchy({ actor, companyId }: { actor: AuthorizationContext; companyId: string }): Promise<GetCompanyHierarchyResult> {
    const company = await requireCompanyInTenant(companyId, actor.organizationId);
    if (!company) return { kind: "forbidden" };
    const [fleets, vehicles] = await Promise.all([ports.fleets.listByCompany(companyId), ports.vehicles.listByCompany(companyId)]);
    return { kind: "found", hierarchy: { company, fleets, vehicles } };
  }

  async function placeVehicleCandidates({ organizationId, companyId, candidates }: { organizationId: string; companyId: string; candidates: Array<{ externalRef: string } & PlacementCandidate> }): Promise<PlaceVehicleCandidatesResult> {
    const company = await requireCompanyInTenant(companyId, organizationId);
    if (!company) return { kind: "forbidden" };
    const fleets = await ports.fleets.listByCompany(companyId);
    const unassigned = fleets.find((fleet) => fleet.kind === "unassigned");
    if (!unassigned) return { kind: "forbidden" };
    const placed: Vehicle[] = [];
    for (const candidate of candidates) {
      const existing = await ports.vehicles.findById(candidate.externalRef);
      if (existing && existing.companyId !== companyId) continue;
      const trustedFleetId = candidate.matchedFleetId && fleets.some((fleet) => fleet.id === candidate.matchedFleetId) ? candidate.matchedFleetId : undefined;
      const trustedCandidate: PlacementCandidate = { matchedFleetId: trustedFleetId };
      const placement = existing
        ? reconcilePlacement(existing.placement, trustedCandidate, unassigned.id)
        : resolvePlacement(trustedCandidate, unassigned.id);
      const vehicle: Vehicle = existing ? { ...existing, placement } : { id: candidate.externalRef, companyId, origin: "provider", placement };
      await ports.vehicles.save(vehicle);
      placed.push(vehicle);
    }
    return { kind: "placed", vehicles: placed };
  }

  async function assignVehicleFleet({ actor, vehicleId, fleetId }: { actor: AuthorizationContext; vehicleId: string; fleetId: string }): Promise<AssignVehicleFleetResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const vehicle = await ports.vehicles.findById(vehicleId);
    if (!vehicle) return { kind: "forbidden" };
    const company = await requireCompanyInTenant(vehicle.companyId, actor.organizationId);
    if (!company) return { kind: "forbidden" };
    const fleet = await ports.fleets.findById(fleetId);
    if (!fleet || fleet.companyId !== vehicle.companyId) return { kind: "forbidden" };
    const updated: Vehicle = { ...vehicle, placement: { fleetId, source: "admin" } };
    await ports.vehicles.save(updated);
    return { kind: "assigned", vehicle: updated };
  }

  return { createCompany, createFleet, createVehicle, getCompanyHierarchy, placeVehicleCandidates, assignVehicleFleet };
}
