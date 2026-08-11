import {
  bindExternalFleetIdentity,
  bindExternalVehicleIdentity,
  resolveCatalogReviewToFleet,
  resolveCatalogReviewToVehicle,
} from "@/domain/catalog";
import type { AuthorizationContext } from "@/application/identity";

import type { ListPendingCatalogReviewsResult, ResolveCatalogReviewResult, ReviewResolutionTarget } from "./contracts";
import type { CatalogReviewApplicationPorts } from "./ports";

export function createCatalogReviewApplication(ports: CatalogReviewApplicationPorts) {
  async function resolveCatalogReview({ actor, reviewId, target }: { actor: AuthorizationContext; reviewId: string; target: ReviewResolutionTarget }): Promise<ResolveCatalogReviewResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const review = await ports.reviews.findById(reviewId);
    if (!review || review.organizationId !== actor.organizationId) return { kind: "not-found" };
    if (review.status !== "pending") return { kind: "already-resolved" };

    if (review.subject === "fleet-binding") {
      const fleet = await ports.fleets.findById(target.targetId);
      if (!fleet || fleet.companyId !== review.companyId) return { kind: "not-found" };
      const resolution = resolveCatalogReviewToFleet(review, fleet.id);
      if ((await ports.reviews.resolve(resolution.review)) === "already-resolved") return { kind: "already-resolved" };
      const identity = await ports.fleetIdentities.findByConnectionAndExternalId(review.organizationId, review.connectionId, review.externalId);
      if (identity) await ports.fleetIdentities.save(bindExternalFleetIdentity(identity, fleet.id));
      return { kind: "resolved", review: resolution.review };
    }

    const vehicle = await ports.vehicles.findById(target.targetId);
    if (!vehicle || vehicle.companyId !== review.companyId) return { kind: "not-found" };
    const resolution = resolveCatalogReviewToVehicle(review, vehicle.id);
    if ((await ports.reviews.resolve(resolution.review)) === "already-resolved") return { kind: "already-resolved" };
    await ports.vehicleIdentities.save(bindExternalVehicleIdentity({ id: ports.ids.create(), organizationId: review.organizationId, connectionId: review.connectionId, entityKind: "vehicle", externalId: review.externalId }, vehicle.id));
    return { kind: "resolved", review: resolution.review };
  }

  async function listPendingCatalogReviews({ actor }: { actor: AuthorizationContext }): Promise<ListPendingCatalogReviewsResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    return { kind: "listed", reviews: await ports.reviews.listPendingByOrganization(actor.organizationId) };
  }

  return { resolveCatalogReview, listPendingCatalogReviews };
}
