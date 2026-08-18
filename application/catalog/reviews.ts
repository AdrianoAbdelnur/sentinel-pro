import { resolveCatalogReview } from "@/domain/catalog";

import type { CatalogReviewRepository, CatalogVehicleRepository } from "./ports";

type CatalogReviewApplicationPorts = {
  reviews: CatalogReviewRepository;
  vehicles: Pick<CatalogVehicleRepository, "findById">;
};

export function createCatalogReviewApplication(ports: CatalogReviewApplicationPorts) {
  async function listPendingReviews() {
    return ports.reviews.listPending();
  }

  async function resolveReview(reviewId: string, vehicleId: string) {
    const review = await ports.reviews.findById(reviewId);
    if (!review || !await ports.vehicles.findById(vehicleId)) return { kind: "not-found" as const };
    if (review.status === "resolved") return { kind: "already-resolved" as const };
    const resolved = resolveCatalogReview(review, vehicleId);
    await ports.reviews.save(resolved);
    return { kind: "resolved" as const, review: resolved };
  }

  return { listPendingReviews, resolveReview };
}
