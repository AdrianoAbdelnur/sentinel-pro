import { resolveGlobalCatalogReview } from "@/domain/catalog-global";

import type { GlobalCatalogReviewRepository, GlobalVehicleRepository } from "./ports";

type GlobalCatalogReviewApplicationPorts = {
  reviews: GlobalCatalogReviewRepository;
  vehicles: Pick<GlobalVehicleRepository, "findById">;
};

export function createGlobalCatalogReviewApplication(ports: GlobalCatalogReviewApplicationPorts) {
  async function listPendingReviews() {
    return ports.reviews.listPending();
  }

  async function resolveReview(reviewId: string, vehicleId: string) {
    const review = await ports.reviews.findById(reviewId);
    if (!review || !await ports.vehicles.findById(vehicleId)) return { kind: "not-found" as const };
    if (review.status === "resolved") return { kind: "already-resolved" as const };
    const resolved = resolveGlobalCatalogReview(review, vehicleId);
    await ports.reviews.save(resolved);
    return { kind: "resolved" as const, review: resolved };
  }

  return { listPendingReviews, resolveReview };
}
