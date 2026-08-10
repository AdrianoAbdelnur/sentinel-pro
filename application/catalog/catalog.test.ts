import { describe, expect, it } from "vitest";

import type { Company, Fleet, Vehicle } from "@/domain/catalog";

import type { CatalogApplicationPorts } from "./ports";
import { createCatalogApplication } from "./index";

function createFixture() {
  const companies = new Map<string, Company>();
  const fleets = new Map<string, Fleet>();
  const vehicles = new Map<string, Vehicle>();
  let sequence = 0;
  const companyPort = {
    findById: async (id: string) => companies.get(id),
    save: async (company: Company) => { companies.set(company.id, company); },
  };
  const fleetPort = {
    findById: async (id: string) => fleets.get(id),
    listByCompany: async (companyId: string) => [...fleets.values()].filter((fleet) => fleet.companyId === companyId),
    save: async (fleet: Fleet) => { fleets.set(fleet.id, fleet); },
  };
  const vehiclePort = {
    findById: async (id: string) => vehicles.get(id),
    listByCompany: async (companyId: string) => [...vehicles.values()].filter((vehicle) => vehicle.companyId === companyId),
    save: async (vehicle: Vehicle) => { vehicles.set(vehicle.id, vehicle); },
  };
  const noopIdentities = { findByConnectionAndExternalId: async () => undefined, listByConnection: async () => [], listStaleByRun: async () => [], save: async () => {} };
  const noopImportItems = { findByRunAndExternalId: async () => undefined, listPendingByRun: async () => [], save: async () => {} };
  const ports: CatalogApplicationPorts = {
    companies: companyPort,
    fleets: fleetPort,
    vehicles: vehiclePort,
    ids: { create: () => `id-${++sequence}` },
    transactions: { run: async (work) => work({ companies: companyPort, fleets: fleetPort, vehicles: vehiclePort, vehicleIdentities: noopIdentities, importItems: noopImportItems }) },
  };
  return { app: createCatalogApplication(ports), companies, fleets, vehicles };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

describe("catalog application use cases", () => {
  it("lets an authorized tenant administrator create a native Company, Fleet, and Vehicle without provider identities", async () => {
    const fixture = createFixture();

    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const fleet = await fixture.app.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (fleet.kind !== "created") throw new Error("expected fleet creation");
    const vehicle = await fixture.app.createVehicle({ actor: admin, companyId: company.company.id, fleetId: fleet.fleet.id, plate: "ABC123" });

    expect(vehicle).toEqual({ kind: "created", vehicle: { id: "id-4", companyId: company.company.id, origin: "native", placement: { fleetId: fleet.fleet.id, source: "admin" }, label: undefined, plate: "ABC123", internalCode: undefined } });
  });

  it("keeps another tenant's Company hierarchy undisclosed and unchanged on cross-tenant reads and mutations", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");

    await expect(fixture.app.getCompanyHierarchy({ actor: otherTenantAdmin, companyId: company.company.id })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.app.createFleet({ actor: otherTenantAdmin, companyId: company.company.id, name: "Intruder" })).resolves.toEqual({ kind: "forbidden" });
    expect(fixture.fleets.size).toBe(1);
  });

  it("gives each Company exactly one system-managed Unassigned fleet that is administratively visible", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");

    const hierarchy = await fixture.app.getCompanyHierarchy({ actor: operator, companyId: company.company.id });
    if (hierarchy.kind !== "found") throw new Error("expected hierarchy");
    expect(hierarchy.hierarchy.fleets.filter((fleet) => fleet.kind === "unassigned")).toEqual([company.unassignedFleet]);
  });

  it("places an unmatched import candidate into the Company's Unassigned fleet", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");

    const placed = await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:900" }] });
    if (placed.kind !== "placed") throw new Error("expected placement");
    expect(placed.vehicles).toEqual([{ id: "cybermapa:900", companyId: company.company.id, origin: "provider", placement: { fleetId: company.unassignedFleet.id, source: "system" } }]);
  });

  it("keeps an administrator's Fleet assignment across repeated provider synchronization", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const realFleet = await fixture.app.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (realFleet.kind !== "created") throw new Error("expected fleet creation");
    await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:900" }] });
    await fixture.app.assignVehicleFleet({ actor: admin, vehicleId: "cybermapa:900", fleetId: realFleet.fleet.id });

    const resynced = await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:900", matchedFleetId: company.unassignedFleet.id }] });
    if (resynced.kind !== "placed") throw new Error("expected placement");

    expect(resynced.vehicles[0].placement).toEqual({ fleetId: realFleet.fleet.id, source: "admin" });
  });

  it("keeps native and provider-exclusive vehicles valid and visible together in the Company catalog", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    await fixture.app.createVehicle({ actor: admin, companyId: company.company.id, fleetId: company.unassignedFleet.id, internalCode: "NATIVE-1" });
    await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:900" }] });

    const hierarchy = await fixture.app.getCompanyHierarchy({ actor: operator, companyId: company.company.id });
    if (hierarchy.kind !== "found") throw new Error("expected hierarchy");
    expect(hierarchy.hierarchy.vehicles.map((vehicle) => vehicle.origin).sort()).toEqual(["native", "provider"]);
  });

  it("keeps a canonical Vehicle in its Fleet when a later roster omits it while a sibling Vehicle is still reported", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const realFleet = await fixture.app.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (realFleet.kind !== "created") throw new Error("expected fleet creation");
    await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [
      { externalRef: "cybermapa:900", matchedFleetId: realFleet.fleet.id },
      { externalRef: "cybermapa:901", matchedFleetId: realFleet.fleet.id },
    ] });

    await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:901", matchedFleetId: realFleet.fleet.id }] });

    const hierarchy = await fixture.app.getCompanyHierarchy({ actor: operator, companyId: company.company.id });
    if (hierarchy.kind !== "found") throw new Error("expected hierarchy");
    expect(hierarchy.hierarchy.vehicles).toContainEqual({ id: "cybermapa:900", companyId: company.company.id, origin: "provider", placement: { fleetId: realFleet.fleet.id, source: "system" } });
    expect(hierarchy.hierarchy.vehicles).toHaveLength(2);
  });

  it("keeps a canonical Vehicle's Company and placement unchanged when its externalRef collides with another Company's candidate", async () => {
    const fixture = createFixture();
    const companyA = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (companyA.kind !== "created") throw new Error("expected company creation");
    const companyB = await fixture.app.createCompany({ actor: otherTenantAdmin, name: "Globex" });
    if (companyB.kind !== "created") throw new Error("expected company creation");
    await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: companyA.company.id, candidates: [{ externalRef: "shared:1" }] });

    const placedB = await fixture.app.placeVehicleCandidates({ organizationId: otherTenantAdmin.organizationId, companyId: companyB.company.id, candidates: [{ externalRef: "shared:1" }] });
    if (placedB.kind !== "placed") throw new Error("expected placement");

    expect(placedB.vehicles).toEqual([]);
    const hierarchyA = await fixture.app.getCompanyHierarchy({ actor: admin, companyId: companyA.company.id });
    if (hierarchyA.kind !== "found") throw new Error("expected hierarchy");
    expect(hierarchyA.hierarchy.vehicles).toEqual([{ id: "shared:1", companyId: companyA.company.id, origin: "provider", placement: { fleetId: companyA.unassignedFleet.id, source: "system" } }]);
  });

  it("treats a matchedFleetId outside the Company's own fleets as untrustworthy hierarchy and falls back to Unassigned", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");
    const otherCompany = await fixture.app.createCompany({ actor: otherTenantAdmin, name: "Globex" });
    if (otherCompany.kind !== "created") throw new Error("expected company creation");
    const foreignFleet = await fixture.app.createFleet({ actor: otherTenantAdmin, companyId: otherCompany.company.id, name: "Foreign" });
    if (foreignFleet.kind !== "created") throw new Error("expected fleet creation");

    const placed = await fixture.app.placeVehicleCandidates({ organizationId: admin.organizationId, companyId: company.company.id, candidates: [
      { externalRef: "cybermapa:1", matchedFleetId: "fleet-does-not-exist" },
      { externalRef: "cybermapa:2", matchedFleetId: foreignFleet.fleet.id },
    ] });
    if (placed.kind !== "placed") throw new Error("expected placement");

    expect(placed.vehicles.map((vehicle) => vehicle.placement)).toEqual([
      { fleetId: company.unassignedFleet.id, source: "system" },
      { fleetId: company.unassignedFleet.id, source: "system" },
    ]);
  });

  it("rejects placement synchronization for a Company outside the caller's tenant and changes nothing", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");

    await expect(fixture.app.placeVehicleCandidates({ organizationId: otherTenantAdmin.organizationId, companyId: company.company.id, candidates: [{ externalRef: "cybermapa:900" }] })).resolves.toEqual({ kind: "forbidden" });

    const hierarchy = await fixture.app.getCompanyHierarchy({ actor: admin, companyId: company.company.id });
    if (hierarchy.kind !== "found") throw new Error("expected hierarchy");
    expect(hierarchy.hierarchy.vehicles).toEqual([]);
  });

  it("rejects Fleet and Vehicle creation from an operator without administrator rights", async () => {
    const fixture = createFixture();
    const company = await fixture.app.createCompany({ actor: admin, name: "Acme" });
    if (company.kind !== "created") throw new Error("expected company creation");

    await expect(fixture.app.createFleet({ actor: operator, companyId: company.company.id, name: "North" })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.app.createVehicle({ actor: operator, companyId: company.company.id, fleetId: company.unassignedFleet.id })).resolves.toEqual({ kind: "forbidden" });
  });
});
