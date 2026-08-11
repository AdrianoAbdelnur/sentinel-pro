import { describe, expect, it } from "vitest";

import type { CatalogReview, ExternalFleetIdentity, ExternalVehicleIdentity, Fleet, FleetBindingReview, Vehicle, VehicleMatchReview } from "@/domain/catalog";

import type { CatalogReviewApplicationPorts } from "./ports";
import { createCatalogReviewApplication } from "./resolve-catalog-review";

function createFixture() {
  const reviews = new Map<string, CatalogReview>();
  const fleets = new Map<string, Fleet>([[targetFleet.id, targetFleet], [foreignFleet.id, foreignFleet], ["fleet-target-2", { ...targetFleet, id: "fleet-target-2" }]]);
  const vehicles = new Map<string, Vehicle>([[targetVehicle.id, targetVehicle], [foreignVehicle.id, foreignVehicle], ["vehicle-target-2", { ...targetVehicle, id: "vehicle-target-2" }]]);
  const fleetIdentities = new Map<string, ExternalFleetIdentity>();
  const vehicleIdentities = new Map<string, ExternalVehicleIdentity>();
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
    fleets: { findById: async (id) => fleets.get(id) },
    vehicles: { findById: async (id) => vehicles.get(id) },
    fleetIdentities: {
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId) => [...fleetIdentities.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
      save: async (identity) => { fleetIdentities.set(identity.id, identity); },
    },
    vehicleIdentities: { save: async (identity) => { vehicleIdentities.set(identity.id, identity); } },
    ids: { create: () => `id-${++sequence}` },
  };
  return { app: createCatalogReviewApplication(ports), reviews, fleetIdentities, vehicleIdentities };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const operator = { userId: "operator-1", organizationId: "org-a", role: "operator" as const };
const otherTenantAdmin = { userId: "admin-2", organizationId: "org-b", role: "admin" as const };

const targetFleet: Fleet = { id: "fleet-target", companyId: "company-a", name: "North Route", kind: "standard" };
const foreignFleet: Fleet = { id: "fleet-foreign", companyId: "company-other", name: "Other", kind: "standard" };
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

    const byOperator = await fixture.app.resolveCatalogReview({ actor: operator, reviewId: buildReview().id, target: { targetId } });
    const byOtherTenant = await fixture.app.resolveCatalogReview({ actor: otherTenantAdmin, reviewId: buildReview().id, target: { targetId } });

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

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { targetId } });

    expect(result).toEqual({ kind: "not-found" });
  });

  it("lets a fresh tenant administrator resolve a fleet-binding review to an existing Fleet in the bound Company, and binds the underlying external Fleet identity", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", fleetBindingReview());
    fixture.fleetIdentities.set("identity-1", { id: "identity-1", organizationId: "org-a", connectionId: "conn-a", entityKind: "fleet", externalId: "F1", label: "north route" });

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-fleet", target: { targetId: targetFleet.id } });

    expect(result.kind).toBe("resolved");
    expect(result.kind === "resolved" ? (result.review as FleetBindingReview).resolvedFleetId : undefined).toBe(targetFleet.id);
    expect(fixture.fleetIdentities.get("identity-1")?.fleetId).toBe(targetFleet.id);
  });

  it("lets a fresh tenant administrator resolve a vehicle-match review to an existing Vehicle in the bound Company, creating the external Vehicle identity that never existed for a reviewed record", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-vehicle", vehicleMatchReview());

    const result = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-vehicle", target: { targetId: targetVehicle.id } });

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
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { targetId: targetIdA } }),
      fixture.app.resolveCatalogReview({ actor: admin, reviewId: buildReview().id, target: { targetId: targetIdB } }),
    ]);

    const outcomes = [first.kind, second.kind].sort();
    expect(outcomes).toEqual(["already-resolved", "resolved"]);
  });

  it("treats a missing review and another tenant's review identically as not-found", async () => {
    const fixture = createFixture();
    fixture.reviews.set("review-fleet", { ...fleetBindingReview(), organizationId: "org-b" });

    const missing = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "does-not-exist", target: { targetId: targetFleet.id } });
    const crossTenant = await fixture.app.resolveCatalogReview({ actor: admin, reviewId: "review-fleet", target: { targetId: targetFleet.id } });

    expect(missing).toEqual(crossTenant);
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
