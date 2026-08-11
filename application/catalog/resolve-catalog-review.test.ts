import { describe, expect, it } from "vitest";

import type { CatalogReview, ExternalFleetIdentity, ExternalVehicleIdentity, Fleet, FleetBindingReview, Vehicle, VehicleMatchReview } from "@/domain/catalog";

import type { CatalogReviewApplicationPorts } from "./ports";
import { createCatalogReviewApplication } from "./resolve-catalog-review";

function createFixture() {
  const reviews = new Map<string, CatalogReview>();
  const fleets = new Map<string, Fleet>([[targetFleet.id, targetFleet], [foreignFleet.id, foreignFleet], ["fleet-target-2", { ...targetFleet, id: "fleet-target-2" }], [unassignedFleetA.id, unassignedFleetA]]);
  const vehicles = new Map<string, Vehicle>([[targetVehicle.id, targetVehicle], [foreignVehicle.id, foreignVehicle], ["vehicle-target-2", { ...targetVehicle, id: "vehicle-target-2" }]]);
  const fleetIdentities = new Map<string, ExternalFleetIdentity>();
  const vehicleIdentities = new Map<string, ExternalVehicleIdentity>();
  const vehicleSaves: Vehicle[] = [];
  let sequence = 0;
  const ports: CatalogReviewApplicationPorts = {
    reviews: {
      findById: async (id) => reviews.get(id),
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId, subject) => [...reviews.values()].find((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.externalId === externalId && r.subject === subject),
      listPendingByOrganization: async (organizationId) => [...reviews.values()].filter((r) => r.organizationId === organizationId && r.status === "pending"),
      save: async (review) => { reviews.set(review.id, review); },
      resolve: async (review) => {
        const existing = reviews.get(review.id);
        if (existing?.status !== "pending") return "already-resolved";
        reviews.set(review.id, review);
        return "resolved";
      },
    },
    fleets: { findById: async (id) => fleets.get(id), listByCompany: async (companyId) => [...fleets.values()].filter((fleet) => fleet.companyId === companyId) },
    vehicles: { findById: async (id) => vehicles.get(id), save: async (vehicle) => { vehicles.set(vehicle.id, vehicle); vehicleSaves.push(vehicle); } },
    fleetIdentities: {
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId) => [...fleetIdentities.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
      save: async (identity) => { fleetIdentities.set(identity.id, identity); },
    },
    vehicleIdentities: { save: async (identity) => { vehicleIdentities.set(identity.id, identity); } },
    ids: { create: () => `id-${++sequence}` },
  };
  return { app: createCatalogReviewApplication(ports), reviews, fleets, vehicles, vehicleSaves, fleetIdentities, vehicleIdentities };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

const targetFleet: Fleet = { id: "fleet-target", companyId: "company-a", name: "North Route", kind: "standard" };
const foreignFleet: Fleet = { id: "fleet-foreign", companyId: "company-other", name: "Other", kind: "standard" };
const unassignedFleetA: Fleet = { id: "fleet-unassigned-a", companyId: "company-a", name: "Unassigned", kind: "unassigned" };
const targetVehicle: Vehicle = { id: "vehicle-target", companyId: "company-a", origin: "native", placement: { fleetId: "fleet-target", source: "admin" } };
const foreignVehicle: Vehicle = { id: "vehicle-foreign", companyId: "company-other", origin: "native", placement: { fleetId: "fleet-foreign", source: "admin" } };

function fleetBindingReview(): FleetBindingReview {
  return { id: "review-fleet", organizationId: "org-a", connectionId: "conn-a", companyId: "company-a", externalId: "F1", status: "pending", subject: "fleet-binding", label: "north route", candidateFleetIds: [] };
}

function vehicleMatchReview(): VehicleMatchReview {
  return { id: "review-vehicle", organizationId: "org-a", connectionId: "conn-a", companyId: "company-a", externalId: "V1", status: "pending", subject: "vehicle-match", normalizedPlate: "ABC123", candidateVehicleIds: [] };
}

describe("resolving a pending review requires an authorized, fresh tenant administrator", () => {
  it.each([
    ["fleet-binding", fleetBindingReview, "fleet-target"],
    ["vehicle-match", vehicleMatchReview, "vehicle-target"],
  ])("rejects an operator and another tenant's administrator for a %s review, leaving it pending", async (_label, buildReview, targetId) => {
    const fixture = createFixture();
    fixture.reviews.set(buildReview().id, buildReview());

    const byOperator = await fixture.app.resolveCatalogReview({ actor: operator, reviewId: buildReview().id, target: { kind: "existing", targetId } });
    const byOtherTenant = await fixture.app.resolveCatalogReview({ actor: otherTenantAdmin, reviewId: buildReview().id, target: { kind: "existing", targetId } });

    expect(byOperator).toEqual({ kind: "forbidden" });
    expect(byOtherTenant).toEqual({ kind: "not-found" });
    expect(fixture.reviews.get(buildReview().id)?.status).toBe("pending");
  });

  it.each([
    ["fleet-binding", fleetBindingReview, "fleet-foreign"],
    ["vehicle-match", vehicleMatchReview, "vehicle-foreign"],
  ])("rejects a %s target that belongs to a different canonical Company than the review's bound Company", async (_label, buildReview, targetId) => {
    const fixture = createFixture();
    fixture.reviews.set(buildReview().id, buildReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { kind: "existing", targetId } });

    expect(result).toEqual({ kind: "not-found" });
  });

  it("lets a fresh tenant administrator resolve a fleet-binding review to an existing Fleet in the bound Company, and binds the underlying external Fleet identity", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", fleetBindingReview());
    fixture.fleetIdentities.set("identity-1", { id: "identity-1", organizationId: "org-a", connectionId: "conn-a", entityKind: "fleet", externalId: "F1", label: "north route" });

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-fleet", target: { kind: "existing", targetId: targetFleet.id } });

    expect(result.kind).toBe("resolved");
    expect(result.kind === "resolved" ? (result.review as FleetBindingReview).resolvedFleetId : undefined).toBe(targetFleet.id);
    expect(fixture.fleetIdentities.get("identity-1")?.fleetId).toBe(targetFleet.id);
  });

  it("lets a fresh tenant administrator resolve a vehicle-match review to an existing Vehicle in the bound Company, creating the external Vehicle identity that never existed for a reviewed record", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-vehicle", vehicleMatchReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { kind: "existing", targetId: targetVehicle.id } });

    expect(result.kind).toBe("resolved");
    expect(result.kind === "resolved" ? (result.review as VehicleMatchReview).resolvedVehicleId : undefined).toBe(targetVehicle.id);
    const created = [...fixture.vehicleIdentities.values()].find((identity) => identity.externalId === "V1");
    expect(created?.vehicleId).toBe(targetVehicle.id);
  });

  it.each([
    ["fleet-binding", fleetBindingReview, "fleet-target", "fleet-target-2"],
    ["vehicle-match", vehicleMatchReview, "vehicle-target", "vehicle-target-2"],
  ])("resolves a %s review exactly once under two genuinely concurrent resolution attempts (Promise.all, both reading the review while it is still pending), keeping the loser from retaining any link", async (_label, buildReview, targetIdA, targetIdB) => {
    const fixture = createFixture();
    fixture.reviews.set(buildReview().id, buildReview());

    const [first, second] = await Promise.all([
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { kind: "existing", targetId: targetIdA } }),
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { kind: "existing", targetId: targetIdB } }),
    ]);

    const outcomes = [first.kind, second.kind].sort();
    expect(outcomes).toEqual(["already-resolved", "resolved"]);
  });

  it("treats a missing review and another tenant's review identically as not-found", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", { ...fleetBindingReview(), organizationId: "org-b" });

    const missing = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "does-not-exist", target: { kind: "existing", targetId: targetFleet.id } });
    const crossTenant = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-fleet", target: { kind: "existing", targetId: targetFleet.id } });

    expect(missing).toEqual(crossTenant);
  });

  it("lets a fresh tenant administrator resolve a vehicle-match review to a NEW Vehicle placed in the bound Company's Unassigned Fleet, retaining exactly one Company-scoped link", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-vehicle", vehicleMatchReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { kind: "new" } });

    expect(result.kind).toBe("resolved");
    const resolvedVehicleId = result.kind === "resolved" ? (result.review as VehicleMatchReview).resolvedVehicleId : undefined;
    expect(resolvedVehicleId).toBeDefined();
    const created = resolvedVehicleId ? fixture.vehicles.get(resolvedVehicleId) : undefined;
    expect(created?.companyId).toBe("company-a");
    expect(created?.placement.fleetId).toBe(unassignedFleetA.id);
    const links = [...fixture.vehicleIdentities.values()].filter((identity) => identity.externalId === "V1");
    expect(links).toHaveLength(1);
    expect(links[0]?.vehicleId).toBe(resolvedVehicleId);
  });

  it("fails safely instead of creating a placement-less Vehicle when the bound Company has no Unassigned Fleet on record", async () => {
    const fixture = createFixture();
    fixture.fleets.delete(unassignedFleetA.id);
    fixture.reviews.set("review-vehicle", vehicleMatchReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { kind: "new" } });

    expect(result).toEqual({ kind: "not-found" });
    expect(fixture.vehicleSaves).toHaveLength(0);
  });

  it("only persists a Vehicle write when resolving to a NEW Vehicle, leaving an existing Vehicle's stored record untouched", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-existing", { ...vehicleMatchReview(), id: "review-existing" });
    fixture.reviews.set("review-new", { ...vehicleMatchReview(), id: "review-new", externalId: "V2" });

    await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-existing", target: { kind: "existing", targetId: targetVehicle.id } });
    expect(fixture.vehicleSaves).toHaveLength(0);

    await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-new", target: { kind: "new" } });
    expect(fixture.vehicleSaves).toHaveLength(1);
  });

  it("rejects resolving a fleet-binding review to a new Fleet, since the spec only allows selecting an existing Fleet in the bound Company", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", fleetBindingReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-fleet", target: { kind: "new" } });

    expect(result).toEqual({ kind: "unsupported" });
    expect(fixture.reviews.get("review-fleet")?.status).toBe("pending");
  });

  it.each([
    ["fleet-binding", () => ({ ...fleetBindingReview(), status: "resolved" as const, resolvedFleetId: targetFleet.id })],
    ["vehicle-match", () => ({ ...vehicleMatchReview(), status: "resolved" as const, resolvedVehicleId: targetVehicle.id })],
  ])("keeps reporting already-resolved for a settled %s review even when the given target would otherwise fail lookup, so settled status is authoritative over target validity", async (_label, buildResolvedReview) => {
    const fixture = createFixture();
    const resolvedReview = buildResolvedReview();
    fixture.reviews.set(resolvedReview.id, resolvedReview);

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: resolvedReview.id, target: { kind: "existing", targetId: "does-not-exist-anywhere" } });

    expect(result).toEqual({ kind: "already-resolved" });
  });

  it("resolves a vehicle-match review exactly once when one concurrent attempt targets an existing Vehicle and the other creates a new one, and the loser never leaves behind an unlinked Vehicle", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-vehicle", vehicleMatchReview());

    const [existingAttempt, newAttempt] = await Promise.all([
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { kind: "existing", targetId: targetVehicle.id } }),
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { kind: "new" } }),
    ]);

    const outcomes = [existingAttempt.kind, newAttempt.kind].sort();
    expect(outcomes).toEqual(["already-resolved", "resolved"]);
    const links = [...fixture.vehicleIdentities.values()].filter((identity) => identity.externalId === "V1");
    expect(links).toHaveLength(1);
    const createdProviderVehicles = [...fixture.vehicles.values()].filter((vehicle) => vehicle.origin === "provider");
    expect(createdProviderVehicles).toHaveLength(newAttempt.kind === "resolved" ? 1 : 0);
  });
});

describe("listing pending reviews stays tenant-scoped to an authorized administrator", () => {
  it("rejects an operator and returns only the caller's own tenant reviews for a fresh administrator", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", fleetBindingReview());
    fixture.reviews.set("review-other", { ...vehicleMatchReview(), id: "review-other", organizationId: "org-b" });

    const denied = await fixture.app.listPendingCatalogReviews({ actor: operator });
    const listed = await fixture.app.listPendingCatalogReviews({ actor: admin });

    expect(denied).toEqual({ kind: "forbidden" });
    expect(listed.kind).toBe("listed");
    expect(listed.kind === "listed" ? listed.reviews.map((review) => review.id) : []).toEqual(["review-fleet"]);
  });
});
