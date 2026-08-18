import { beforeEach, describe, expect, it, vi } from "vitest";

const identity = { authorize: vi.fn(), authorizePlatform: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: async () => identity }));

const runtime = {
  listPendingReviews: vi.fn(),
  resolveReview: vi.fn(),
  getStatus: vi.fn(),
};
vi.mock("@/app/api/internal/catalog/v2/composition", () => ({ getGlobalCatalogSyncRuntime: async () => runtime }));
vi.mock("./composition", () => ({ getCatalogAdminRuntime: async () => { throw new Error("organizational catalog used"); } }));

import { GET as listReviews } from "./reviews/route";
import { POST as resolveReview } from "./reviews/[reviewId]/resolve/route";
import { GET as getStatus } from "./connections/[connectionId]/status/route";

const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=opaque-token", "content-type": "application/json" };

describe("canonical catalog administration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    identity.authorizePlatform.mockResolvedValue({ kind: "authorized", context: { userId: "platform-1" } });
  });

  it("lists canonical reviews without organization-owned fields", async () => {
    runtime.listPendingReviews.mockResolvedValue([{
      id: "review-1",
      subject: "vehicle-identity",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "ambiguous-match",
      candidateVehicleIds: ["vehicle-1"],
      status: "pending",
    }]);

    const response = await listReviews(new Request("https://sentinel.test/api/admin/catalog/reviews", { headers }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ reviews: [{
      id: "review-1",
      subject: "vehicle-identity",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "ambiguous-match",
      candidateVehicleIds: ["vehicle-1"],
      status: "pending",
    }] });
    expect(runtime.listPendingReviews).toHaveBeenCalledOnce();
  });

  it("resolves a review only to an existing canonical vehicle", async () => {
    runtime.resolveReview.mockResolvedValue({ kind: "resolved", review: {
      id: "review-1",
      subject: "vehicle-identity",
      connectionId: "connection-1",
      externalId: "external-1",
      reason: "ambiguous-match",
      candidateVehicleIds: ["vehicle-1"],
      status: "resolved",
      resolvedVehicleId: "vehicle-1",
    } });
    const request = new Request("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { method: "POST", headers, body: JSON.stringify({ targetId: "vehicle-1" }) });

    const response = await resolveReview(request, { params: Promise.resolve({ reviewId: "review-1" }) });

    expect(response.status).toBe(200);
    expect(runtime.resolveReview).toHaveBeenCalledWith("review-1", "vehicle-1");
    expect((await response.json()).review.resolvedVehicleId).toBe("vehicle-1");
  });

  it("reads canonical run status through the unversioned route", async () => {
    runtime.getStatus.mockResolvedValue({ kind: "found", status: { connectionId: "connection-1", isDue: true } });

    const response = await getStatus(new Request("https://sentinel.test/api/admin/catalog/connections/connection-1/status", { headers }), { params: Promise.resolve({ connectionId: "connection-1" }) });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: { connectionId: "connection-1", isDue: true } });
    expect(runtime.getStatus).toHaveBeenCalledWith("connection-1");
  });
});
