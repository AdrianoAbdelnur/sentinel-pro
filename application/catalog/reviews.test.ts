import { describe, expect, it, vi } from "vitest";

import { createCatalogReview, createCatalogVehicle } from "@/domain/catalog";

import { createCatalogReviewApplication } from "./reviews";

function createFixture() {
  const review = createCatalogReview({
    id: "review-1",
    connectionId: "connection-1",
    externalId: "external-1",
    reason: "ambiguous-match",
    candidateVehicleIds: ["vehicle-1"],
  });
  const vehicle = createCatalogVehicle({
    id: "vehicle-1",
    normalizedPlate: "ABC123",
    plate: "ABC 123",
    placementFleetId: "group-1",
  });
  const reviews = {
    findById: vi.fn().mockResolvedValue(review),
    listPending: vi.fn().mockResolvedValue([review]),
    save: vi.fn().mockResolvedValue(undefined),
  };
  const vehicles = {
    findById: vi.fn().mockResolvedValue(vehicle),
  };
  return { review, reviews, vehicles, application: createCatalogReviewApplication({ reviews, vehicles }) };
}

describe("canonical catalog review application", () => {
  it("lists pending canonical reviews", async () => {
    const fixture = createFixture();

    await expect(fixture.application.listPendingReviews()).resolves.toEqual([fixture.review]);
    expect(fixture.reviews.listPending).toHaveBeenCalledOnce();
  });

  it("resolves a pending review to an existing canonical vehicle", async () => {
    const fixture = createFixture();

    await expect(fixture.application.resolveReview("review-1", "vehicle-1")).resolves.toEqual({
      kind: "resolved",
      review: { ...fixture.review, status: "resolved", resolvedVehicleId: "vehicle-1" },
    });
    expect(fixture.reviews.save).toHaveBeenCalledWith({
      ...fixture.review,
      status: "resolved",
      resolvedVehicleId: "vehicle-1",
    });
  });

  it("preserves an existing decision and rejects a missing target", async () => {
    const fixture = createFixture();
    fixture.reviews.findById.mockResolvedValueOnce({ ...fixture.review, status: "resolved", resolvedVehicleId: "vehicle-1" });

    await expect(fixture.application.resolveReview("review-1", "vehicle-2")).resolves.toEqual({ kind: "already-resolved" });
    expect(fixture.reviews.save).not.toHaveBeenCalled();

    fixture.reviews.findById.mockResolvedValueOnce(fixture.review);
    fixture.vehicles.findById.mockResolvedValueOnce(undefined);
    await expect(fixture.application.resolveReview("review-1", "missing")).resolves.toEqual({ kind: "not-found" });
    expect(fixture.reviews.save).not.toHaveBeenCalled();
  });
});
