import {
  bindExternalFleetIdentity,
  bindExternalVehicleIdentity,
  resolveCatalogReviewToFleet,
  resolveCatalogReviewToVehicle,
  type Vehicle,
  type VehicleMatchReview,
} from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type { ListPendingCatalogReviewsResult, ResolveCatalogReviewResult, ReviewResolutionTarget } from "./contracts";
import type { CatalogReviewApplicationPorts } from "./ports";

class CatalogReviewIdentityConflict extends Error {}

export function createCatalogReviewApplication(ports: CatalogReviewApplicationPorts) {
  async function resolveVehicleMatchTarget(review: VehicleMatchReview, target: ReviewResolutionTarget): Promise<Vehicle | undefined> {
    if (target.kind === "existing") {
      const vehicle = await ports.vehicles.findById(target.targetId);
      return vehicle && vehicle.companyId === review.companyId ? vehicle : undefined;
    }
    const unassigned = (await ports.fleets.listByCompany(review.companyId)).find((fleet) => fleet.kind === "unassigned");
    if (!unassigned) return undefined;
    return { id: ports.ids.create(), companyId: review.companyId, origin: "provider", placement: { fleetId: unassigned.id, source: "system" }, plate: review.normalizedPlate };
  }

  async function resolveCatalogReview({ actor, reviewId, target }: { actor: AuthorizationContext; reviewId: string; target: ReviewResolutionTarget }): Promise<ResolveCatalogReviewResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const review = await ports.reviews.findById(reviewId);
    if (!review || review.organizationId !== actor.organizationId) return { kind: "not-found" };
    if (review.status !== "pending") return { kind: "already-resolved" };

    if (review.subject === "fleet-binding") {
      if (target.kind === "new") return { kind: "unsupported" };
      const fleet = await ports.fleets.findById(target.targetId);
      if (!fleet || fleet.companyId !== review.companyId) return { kind: "not-found" };
      const resolution = resolveCatalogReviewToFleet(review, fleet.id);
      if ((await ports.reviews.resolve(resolution.review)) === "already-resolved") return { kind: "already-resolved" };
      const identity = await ports.fleetIdentities.findByConnectionAndExternalId(review.organizationId, review.connectionId, review.externalId);
      if (identity) await ports.fleetIdentities.save(bindExternalFleetIdentity(identity, fleet.id));
      return { kind: "resolved", review: resolution.review };
    }

    const vehicle = await resolveVehicleMatchTarget(review, target);
    if (!vehicle) return { kind: "not-found" };
    const resolution = resolveCatalogReviewToVehicle(review, vehicle.id);
    const identity = { ...bindExternalVehicleIdentity({ id: ports.ids.create(), organizationId: review.organizationId, connectionId: review.connectionId, entityKind: "vehicle", externalId: review.externalId }, vehicle.id), vehicleId: vehicle.id };
    try {
      return await ports.transactions.run(async ({ reviews, vehicles, vehicleIdentities }) => {
        if (!vehicleIdentities.ensureBoundToVehicle) throw new Error("Catalog review transaction repositories are incomplete");
        if ((await reviews.resolve(resolution.review)) === "already-resolved") return { kind: "already-resolved" } as const;
        if (target.kind === "new") await vehicles.save(vehicle);
        if ((await vehicleIdentities.ensureBoundToVehicle(identity)) === "conflict") throw new CatalogReviewIdentityConflict();
        return { kind: "resolved", review: resolution.review } as const;
      });
    } catch (error) {
      if (error instanceof CatalogReviewIdentityConflict) return { kind: "conflict" };
      throw error;
    }
  }

  async function listPendingCatalogReviews({ actor }: { actor: AuthorizationContext }): Promise<ListPendingCatalogReviewsResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    return { kind: "listed", reviews: await ports.reviews.listPendingByOrganization(actor.organizationId) };
  }

  return { resolveCatalogReview, listPendingCatalogReviews };
}
