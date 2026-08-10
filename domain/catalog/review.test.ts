import { describe, expect, it } from "vitest";

import {
  MAX_REVIEW_CANDIDATES,
  resolveCatalogReviewToFleet,
  resolveCatalogReviewToVehicle,
  stageFleetBindingReview,
  stageVehicleMatchReview,
  type FleetBindingReview,
} from "./review";

describe("catalog review staging", () => {
  it("stages a pending vehicle-match review scoped to its tenant, connection, and bound Company, carrying the conflicting candidates and plate", () => {
    const review = stageVehicleMatchReview("review-1", {
      organizationId: "org-a",
      connectionId: "conn-1",
      companyId: "company-1",
      externalId: "gps-9001",
      normalizedPlate: "ABC123",
      candidateVehicleIds: ["vehicle-1", "vehicle-2"],
    });

    expect(review).toEqual({
      id: "review-1",
      organizationId: "org-a",
      connectionId: "conn-1",
      companyId: "company-1",
      externalId: "gps-9001",
      subject: "vehicle-match",
      status: "pending",
      normalizedPlate: "ABC123",
      candidateVehicleIds: ["vehicle-1", "vehicle-2"],
    });
  });

  it("stages a pending Fleet-binding review carrying the external Fleet's label and the candidate canonical Fleets", () => {
    const review = stageFleetBindingReview("review-2", {
      organizationId: "org-a",
      connectionId: "conn-1",
      companyId: "company-1",
      externalId: "F100",
      label: "north route",
      candidateFleetIds: ["fleet-1"],
    });

    expect(review).toEqual({
      id: "review-2",
      organizationId: "org-a",
      connectionId: "conn-1",
      companyId: "company-1",
      externalId: "F100",
      subject: "fleet-binding",
      status: "pending",
      label: "north route",
      candidateFleetIds: ["fleet-1"],
    });
  });

  it("never carries a credentialRef or any secret-shaped field on a staged review", () => {
    const review = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: [] });

    expect(review).not.toHaveProperty("credentialRef");
  });

  it("caps the candidate list at the bounded maximum when staging, never storing an unbounded list", () => {
    const manyCandidates = Array.from({ length: 12 }, (_, index) => `vehicle-${index}`);

    const review = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: manyCandidates });

    expect(review.candidateVehicleIds).toHaveLength(MAX_REVIEW_CANDIDATES);
    expect(review.candidateVehicleIds).toEqual(manyCandidates.slice(0, MAX_REVIEW_CANDIDATES));
  });
});

describe("catalog review resolution", () => {
  it("resolves a pending vehicle-match review to exactly one Company-scoped Vehicle link, retaining its staging identity", () => {
    const review = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-1", "vehicle-2"] });

    const outcome = resolveCatalogReviewToVehicle(review, "vehicle-1");

    expect(outcome).toEqual({ kind: "resolved", review: { ...review, status: "resolved", resolvedVehicleId: "vehicle-1" } });
  });

  it("resolves a pending Fleet-binding review to a canonical Fleet in the same Company, retaining its staging identity", () => {
    const review = stageFleetBindingReview("review-2", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "F100", label: "north route", candidateFleetIds: ["fleet-1"] });

    const outcome = resolveCatalogReviewToFleet(review, "fleet-1");

    expect(outcome).toEqual({ kind: "resolved", review: { ...review, status: "resolved", resolvedFleetId: "fleet-1" } });
  });

  it("rejects resolving an already-resolved vehicle-match review instead of silently overwriting its decision", () => {
    const pending = stageVehicleMatchReview("review-1", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "gps-9001", normalizedPlate: "ABC123", candidateVehicleIds: ["vehicle-1", "vehicle-2"] });
    const firstOutcome = resolveCatalogReviewToVehicle(pending, "vehicle-1");
    const firstResolved = firstOutcome.kind === "resolved" ? firstOutcome.review : pending;

    const secondOutcome = resolveCatalogReviewToVehicle(firstResolved, "vehicle-2");

    expect(secondOutcome).toEqual({ kind: "already-resolved", review: firstResolved });
    expect(firstResolved.resolvedVehicleId).toBe("vehicle-1");
  });

  it("rejects resolving an already-resolved Fleet-binding review instead of silently overwriting its decision", () => {
    const pending = stageFleetBindingReview("review-2", { organizationId: "org-a", connectionId: "conn-1", companyId: "company-1", externalId: "F100", label: "north route", candidateFleetIds: ["fleet-1", "fleet-2"] });
    const firstOutcome = resolveCatalogReviewToFleet(pending, "fleet-1");
    const firstResolved: FleetBindingReview = firstOutcome.kind === "resolved" ? firstOutcome.review : pending;

    const secondOutcome = resolveCatalogReviewToFleet(firstResolved, "fleet-2");

    expect(secondOutcome).toEqual({ kind: "already-resolved", review: firstResolved });
    expect(firstResolved.resolvedFleetId).toBe("fleet-1");
  });
});
