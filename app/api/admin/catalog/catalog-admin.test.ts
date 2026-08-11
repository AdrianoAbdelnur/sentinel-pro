import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogReview, FleetBindingReview } from "@/domain/catalog";

const application = { authorize: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));

const resolveCatalogReview = vi.fn();
const listPendingCatalogReviews = vi.fn();
vi.mock("./composition", () => ({ getCatalogAdminRuntime: async () => ({ resolveCatalogReview, listPendingCatalogReviews }) }));

import { GET as listReviews } from "./reviews/route";
import { POST as resolveReview } from "./reviews/[reviewId]/resolve/route";

const context = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=opaque-token", "content-type": "application/json" };
const get = (url: string) => new Request(url, { method: "GET", headers });
const post = (url: string, body?: unknown) => new Request(url, { method: "POST", headers, body: body !== undefined ? JSON.stringify(body) : undefined });

const pendingReview: FleetBindingReview = { id: "review-1", organizationId: "org-a", connectionId: "conn-a", companyId: "company-a", externalId: "F1", status: "pending", subject: "fleet-binding", label: "north route", candidateFleetIds: [] };
const resolvedReview: FleetBindingReview = { ...pendingReview, status: "resolved", resolvedFleetId: "fleet-1" };

describe("GET /api/admin/catalog/reviews", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  it("rejects a cross-origin request before ever calling the application", async () => {
    const response = await listReviews(new Request("https://sentinel.test/api/admin/catalog/reviews", { method: "GET", headers: { ...headers, origin: "https://attacker.test" } }));
    expect(response.status).toBe(403);
    expect(listPendingCatalogReviews).not.toHaveBeenCalled();
  });

  it("lists pending reviews through an explicit projection that never leaks organizationId", async () => {
    listPendingCatalogReviews.mockResolvedValue({ kind: "listed", reviews: [pendingReview] as CatalogReview[] });
    const response = await listReviews(get("https://sentinel.test/api/admin/catalog/reviews"));
    const body = await response.json();
    expect(listPendingCatalogReviews).toHaveBeenCalledWith({ actor: context });
    expect(body.reviews).toEqual([{ id: "review-1", connectionId: "conn-a", companyId: "company-a", externalId: "F1", subject: "fleet-binding", status: "pending", label: "north route", candidateFleetIds: [], resolvedFleetId: undefined }]);
    expect(JSON.stringify(body)).not.toContain("org-a");
  });

  it("maps an application-level forbidden result to 403 without listing anything", async () => {
    listPendingCatalogReviews.mockResolvedValue({ kind: "forbidden" });
    const response = await listReviews(get("https://sentinel.test/api/admin/catalog/reviews"));
    expect(response.status).toBe(403);
  });
});

describe("POST /api/admin/catalog/reviews/[reviewId]/resolve", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  it("rejects a request without a valid session before touching the application", async () => {
    const response = await resolveReview(new Request("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { method: "POST", headers: { origin: "https://sentinel.test" }, body: JSON.stringify({ targetId: "fleet-1" }) }), { params: Promise.resolve({ reviewId: "review-1" }) });
    expect(response.status).toBe(403);
    expect(resolveCatalogReview).not.toHaveBeenCalled();
  });

  it("rejects a malformed body before calling the application", async () => {
    const response = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: 42 }), { params: Promise.resolve({ reviewId: "review-1" }) });
    expect(response.status).toBe(400);
    expect(resolveCatalogReview).not.toHaveBeenCalled();
  });

  it("resolves an existing-target request and projects the result without leaking organizationId", async () => {
    resolveCatalogReview.mockResolvedValue({ kind: "resolved", review: resolvedReview });
    const response = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "review-1" }) });
    const body = await response.json();
    expect(resolveCatalogReview).toHaveBeenCalledWith({ actor: context, reviewId: "review-1", target: { targetId: "fleet-1" } });
    expect(body.review.resolvedFleetId).toBe("fleet-1");
    expect(JSON.stringify(body)).not.toContain("org-a");
  });

  it("maps already-resolved to 409 and both forbidden and not-found to the same 403, so a missing and a cross-tenant review are indistinguishable", async () => {
    resolveCatalogReview.mockResolvedValueOnce({ kind: "already-resolved" }).mockResolvedValueOnce({ kind: "not-found" }).mockResolvedValueOnce({ kind: "forbidden" });
    const conflict = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "review-1" }) });
    const missing = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "review-1" }) });
    const crossTenant = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "review-1" }) });
    expect(conflict.status).toBe(409);
    expect(missing.status).toBe(403);
    expect(await missing.json()).toEqual(await crossTenant.json());
    expect(crossTenant.status).toBe(403);
  });
});
