import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogReview, FleetBindingReview } from "@/domain/catalog";

const application = { authorize: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));

const resolveCatalogReview = vi.fn();
const listPendingCatalogReviews = vi.fn();
const bindProviderCompany = vi.fn();
const assignConnectionCompany = vi.fn();
const synchronizeCatalogConnection = vi.fn();
const getCatalogSyncStatus = vi.fn();
const connectionsPort = { findById: vi.fn() };
const howenFactory = vi.fn((connection: { companyId?: string }) => (connection.companyId ? { loadCompleteSnapshot: vi.fn() } : undefined));
const factories = { cybermapa: () => ({ loadCompleteSnapshot: vi.fn() }), howen: howenFactory };
vi.mock("./composition", () => ({ getCatalogAdminRuntime: async () => ({ resolveCatalogReview, listPendingCatalogReviews, bindProviderCompany, assignConnectionCompany, synchronizeCatalogConnection, connections: connectionsPort, factories, getCatalogSyncStatus }) }));

import { GET as listReviews } from "./reviews/route";
import { POST as resolveReview } from "./reviews/[reviewId]/resolve/route";
import { POST as bindCandidate } from "./companies/candidates/[candidateId]/bind/route";
import { POST as assignCompany } from "./connections/[connectionId]/company/route";
import { POST as syncConnection } from "./connections/[connectionId]/sync/route";
import { GET as getStatus } from "./connections/[connectionId]/status/route";

const cybermapaConnection = { id: "conn-1", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a" };
const howenConnection = { id: "conn-howen", organizationId: "org-a", credentialRef: "vault:howen/org-a" };
const howenConnectionAssigned = { id: "conn-howen-2", organizationId: "org-a", credentialRef: "vault:howen/org-a", companyId: "company-a" };
const acmeConnection = { id: "conn-acme", organizationId: "org-a", credentialRef: "vault:acme/org-a" };

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
    expect(resolveCatalogReview).toHaveBeenCalledWith({ actor: context, reviewId: "review-1", target: { kind: "existing", targetId: "fleet-1" } });
    expect(body.review.resolvedFleetId).toBe("fleet-1");
    expect(JSON.stringify(body)).not.toContain("org-a");
  });

  it("resolves a NEW-target request from the { new: true } wire shape and projects the result", async () => {
    const resolvedVehicleReview = { ...pendingReview, subject: "vehicle-match" as const, normalizedPlate: "ABC123", candidateVehicleIds: [], resolvedVehicleId: "vehicle-1", status: "resolved" as const };
    resolveCatalogReview.mockResolvedValue({ kind: "resolved", review: resolvedVehicleReview });
    const response = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { new: true }), { params: Promise.resolve({ reviewId: "review-1" }) });
    const body = await response.json();
    expect(resolveCatalogReview).toHaveBeenCalledWith({ actor: context, reviewId: "review-1", target: { kind: "new" } });
    expect(body.review.resolvedVehicleId).toBe("vehicle-1");
  });

  it("maps an unsupported target (a new Fleet, which the domain does not allow) to 400", async () => {
    resolveCatalogReview.mockResolvedValue({ kind: "unsupported" });
    const response = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { new: true }), { params: Promise.resolve({ reviewId: "review-1" }) });
    expect(response.status).toBe(400);
  });

  it("rejects a missing or blank reviewId before calling the application", async () => {
    const missingId = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews//resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "" }) });
    const invalidId = await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/%20/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: " " }) });
    expect([missingId.status, invalidId.status]).toEqual([400, 400]);
    expect(resolveCatalogReview).not.toHaveBeenCalled();
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

describe("POST /api/admin/catalog/companies/candidates/[candidateId]/bind", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  const bind = (url: string, body?: unknown, candidateId = "candidate-1") => bindCandidate(post(url, body), { params: Promise.resolve({ candidateId }) });

  it("rejects a request without a valid session before touching the application", async () => {
    const response = await bindCandidate(new Request("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { method: "POST", headers: { origin: "https://sentinel.test" }, body: JSON.stringify({ companyId: "company-1" }) }), { params: Promise.resolve({ candidateId: "candidate-1" }) });
    expect(response.status).toBe(403);
    expect(bindProviderCompany).not.toHaveBeenCalled();
  });

  it("rejects an operator before touching the application", async () => {
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    const response = await bind("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { companyId: "company-1" });
    expect(response.status).toBe(403);
    expect(bindProviderCompany).not.toHaveBeenCalled();
  });

  it("rejects a malformed body before calling the application", async () => {
    const response = await bind("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { companyId: 42 });
    expect(response.status).toBe(400);
    expect(bindProviderCompany).not.toHaveBeenCalled();
  });

  it("rejects a blank candidateId before any application call", async () => {
    const response = await bind("https://sentinel.test/api/admin/catalog/companies/candidates/%20/bind", { companyId: "company-1" }, " ");
    expect(response.status).toBe(400);
    expect(bindProviderCompany).not.toHaveBeenCalled();
  });

  it("maps an application-level forbidden result (invalid candidate or cross-tenant Company) to 403", async () => {
    bindProviderCompany.mockResolvedValue({ kind: "forbidden" });
    const response = await bind("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { companyId: "company-1" });
    expect(response.status).toBe(403);
  });

  it("lets a fresh admin bind a candidate to a Company and projects the result without leaking organizationId", async () => {
    bindProviderCompany.mockResolvedValue({ kind: "bound", candidate: { id: "candidate-1", organizationId: "org-a", connectionId: "conn-a", normalizedLabel: "acme transport", companyId: "company-1" } });
    const response = await bind("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { companyId: "company-1" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(bindProviderCompany).toHaveBeenCalledWith({ actor: context, candidateId: "candidate-1", companyId: "company-1" });
    expect(body.candidate).toEqual({ id: "candidate-1", connectionId: "conn-a", normalizedLabel: "acme transport", companyId: "company-1" });
    expect(JSON.stringify(body)).not.toContain("org-a");
  });
});

describe("POST /api/admin/catalog/connections/[connectionId]/company", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  const assign = (url: string, body?: unknown, connectionId = "conn-1") => assignCompany(post(url, body), { params: Promise.resolve({ connectionId }) });

  it("rejects a request without a valid session before touching the application", async () => {
    const response = await assignCompany(new Request("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { method: "POST", headers: { origin: "https://sentinel.test" }, body: JSON.stringify({ companyId: "company-1" }) }), { params: Promise.resolve({ connectionId: "conn-1" }) });
    expect(response.status).toBe(403);
    expect(assignConnectionCompany).not.toHaveBeenCalled();
  });

  it("rejects an operator before touching the application", async () => {
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    const response = await assign("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { companyId: "company-1" });
    expect(response.status).toBe(403);
    expect(assignConnectionCompany).not.toHaveBeenCalled();
  });

  it("rejects a malformed body before calling the application", async () => {
    const response = await assign("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { companyId: 42 });
    expect(response.status).toBe(400);
    expect(assignConnectionCompany).not.toHaveBeenCalled();
  });

  it("rejects a blank connectionId before any application call", async () => {
    const response = await assign("https://sentinel.test/api/admin/catalog/connections/%20/company", { companyId: "company-1" }, " ");
    expect(response.status).toBe(400);
    expect(assignConnectionCompany).not.toHaveBeenCalled();
  });

  it("maps an application-level forbidden result (invalid connection or cross-tenant Company) to 403", async () => {
    assignConnectionCompany.mockResolvedValue({ kind: "forbidden" });
    const response = await assign("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { companyId: "company-1" });
    expect(response.status).toBe(403);
  });

  it("lets a fresh admin assign a Company to a connection and projects the result without leaking organizationId", async () => {
    assignConnectionCompany.mockResolvedValue({ kind: "assigned", connection: { id: "conn-1", organizationId: "org-a", credentialRef: "vault:howen/org-a", companyId: "company-1" } });
    const response = await assign("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { companyId: "company-1" });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(assignConnectionCompany).toHaveBeenCalledWith({ actor: context, connectionId: "conn-1", companyId: "company-1" });
    expect(body.connection).toEqual({ id: "conn-1", companyId: "company-1" });
    expect(JSON.stringify(body)).not.toContain("org-a");
  });
});

describe("POST /api/admin/catalog/connections/[connectionId]/sync", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); connectionsPort.findById.mockResolvedValue(cybermapaConnection); });

  const sync = (connectionId = "conn-1") => syncConnection(post(`https://sentinel.test/api/admin/catalog/connections/${connectionId}/sync`), { params: Promise.resolve({ connectionId }) });

  it("rejects a request without a valid session before touching the application", async () => {
    const response = await syncConnection(new Request("https://sentinel.test/api/admin/catalog/connections/conn-1/sync", { method: "POST", headers: { origin: "https://sentinel.test" } }), { params: Promise.resolve({ connectionId: "conn-1" }) });
    expect(response.status).toBe(403);
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("rejects an operator before touching the application", async () => {
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    expect((await sync()).status).toBe(403);
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("rejects a blank connectionId before any lookup", async () => {
    const response = await syncConnection(post("https://sentinel.test/api/admin/catalog/connections/%20/sync"), { params: Promise.resolve({ connectionId: " " }) });
    expect(response.status).toBe(400);
    expect(connectionsPort.findById).not.toHaveBeenCalled();
  });

  it("maps a nonexistent or cross-tenant connection to the same 403 as any other forbidden result", async () => {
    connectionsPort.findById.mockResolvedValue(undefined);
    expect((await sync()).status).toBe(403);
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("reports an unsupported provider without starting a run, distinct from a missing connection", async () => {
    connectionsPort.findById.mockResolvedValue(acmeConnection);
    const response = await sync();
    const body = await response.json();
    expect(response.status).not.toBe(403);
    expect(body.error).toBe("Este proveedor todavía no admite sincronización.");
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("tells the admin to assign a Company for a Howen connection lacking one, with a message distinct from unsupported-provider", async () => {
    connectionsPort.findById.mockResolvedValue(howenConnection);
    const response = await sync();
    const body = await response.json();
    expect(response.status).not.toBe(403);
    expect(body.error).toBe("Esta conexión no tiene una Company asignada. Asigná una Company para poder sincronizar.");
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("reports a server misconfiguration distinctly from a missing Company assignment when the connection already carries one", async () => {
    connectionsPort.findById.mockResolvedValue(howenConnectionAssigned);
    howenFactory.mockReturnValueOnce(undefined);
    const response = await sync();
    const body = await response.json();
    expect(response.status).not.toBe(403);
    expect(body.error).toBe("La conexión con el proveedor está mal configurada. Contactá al equipo técnico.");
    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
  });

  it("derives organizationId strictly from the authenticated actor, never from client input, and always triggers manually", async () => {
    synchronizeCatalogConnection.mockResolvedValue({ kind: "succeeded", run: { counts: { processed: 1 } } });
    await sync();
    expect(synchronizeCatalogConnection).toHaveBeenCalledWith({ organizationId: context.organizationId, connectionId: "conn-1", trigger: "manual", source: expect.anything() });
  });

  it.each([
    ["succeeded", { kind: "succeeded", run: { counts: { processed: 3 } } }, 200],
    ["already-running", { kind: "already-running" }, 409],
    ["retryable-failure", { kind: "retryable-failure", run: {}, failure: { category: "connectivity" } }, 502],
    ["not-found", { kind: "not-found" }, 403],
    ["skipped-fresh", { kind: "skipped-fresh", lastSuccessAt: new Date() }, 200],
  ])("maps outcome %s to status %i", async (_label, outcome, status) => {
    synchronizeCatalogConnection.mockResolvedValue(outcome);
    expect((await sync()).status).toBe(status);
  });

  it("reuses the existing lease-backed mechanism exactly once per request and does not start a second run when one is already active", async () => {
    synchronizeCatalogConnection.mockResolvedValue({ kind: "already-running" });
    const response = await sync();
    expect(response.status).toBe(409);
    expect(synchronizeCatalogConnection).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/admin/catalog/connections/[connectionId]/status", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  const status = (connectionId = "conn-1") => getStatus(get(`https://sentinel.test/api/admin/catalog/connections/${connectionId}/status`), { params: Promise.resolve({ connectionId }) });

  it("rejects a request without a valid session before touching the application", async () => {
    const response = await getStatus(new Request("https://sentinel.test/api/admin/catalog/connections/conn-1/status", { method: "GET", headers: { origin: "https://sentinel.test" } }), { params: Promise.resolve({ connectionId: "conn-1" }) });
    expect(response.status).toBe(403);
    expect(getCatalogSyncStatus).not.toHaveBeenCalled();
  });

  it("rejects an operator before touching the application", async () => {
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    expect((await status()).status).toBe(403);
    expect(getCatalogSyncStatus).not.toHaveBeenCalled();
  });

  it("rejects a blank connectionId before any application call", async () => {
    const response = await getStatus(get("https://sentinel.test/api/admin/catalog/connections/%20/status"), { params: Promise.resolve({ connectionId: " " }) });
    expect(response.status).toBe(400);
    expect(getCatalogSyncStatus).not.toHaveBeenCalled();
  });

  it("maps a nonexistent or cross-tenant connection to the same 403 as any other forbidden result", async () => {
    getCatalogSyncStatus.mockResolvedValue({ kind: "not-found" });
    expect((await status()).status).toBe(403);
  });

  it("derives organizationId strictly from the authenticated actor and projects the already-allowlisted status without widening it", async () => {
    const syncStatus = { connectionId: "conn-1", latestRun: { status: "succeeded", trigger: "manual", startedAt: new Date(), counts: { processed: 3 } }, lastSuccessAt: new Date(), isDue: false };
    getCatalogSyncStatus.mockResolvedValue({ kind: "found", status: syncStatus });
    const response = await status();
    const body = await response.json();
    expect(getCatalogSyncStatus).toHaveBeenCalledWith({ organizationId: context.organizationId, connectionId: "conn-1" });
    expect(body.status).toEqual(JSON.parse(JSON.stringify(syncStatus)));
    expect(JSON.stringify(body)).not.toContain("org-a");
  });
});

describe("freshness: every catalog admin route re-authorizes against the database instead of trusting a cached session", () => {
  it("uses a fresh admin authorization request on list, resolve, bind, assign-company, sync, and status", async () => {
    vi.clearAllMocks();
    application.authorize.mockResolvedValue({ kind: "authorized", context });
    connectionsPort.findById.mockResolvedValue(cybermapaConnection);
    listPendingCatalogReviews.mockResolvedValue({ kind: "listed", reviews: [] });
    resolveCatalogReview.mockResolvedValue({ kind: "already-resolved" });
    bindProviderCompany.mockResolvedValue({ kind: "forbidden" });
    assignConnectionCompany.mockResolvedValue({ kind: "forbidden" });
    synchronizeCatalogConnection.mockResolvedValue({ kind: "already-running" });
    getCatalogSyncStatus.mockResolvedValue({ kind: "not-found" });

    await listReviews(get("https://sentinel.test/api/admin/catalog/reviews"));
    await resolveReview(post("https://sentinel.test/api/admin/catalog/reviews/review-1/resolve", { targetId: "fleet-1" }), { params: Promise.resolve({ reviewId: "review-1" }) });
    await bindCandidate(post("https://sentinel.test/api/admin/catalog/companies/candidates/candidate-1/bind", { companyId: "company-1" }), { params: Promise.resolve({ candidateId: "candidate-1" }) });
    await assignCompany(post("https://sentinel.test/api/admin/catalog/connections/conn-1/company", { companyId: "company-1" }), { params: Promise.resolve({ connectionId: "conn-1" }) });
    await syncConnection(post("https://sentinel.test/api/admin/catalog/connections/conn-1/sync"), { params: Promise.resolve({ connectionId: "conn-1" }) });
    await getStatus(get("https://sentinel.test/api/admin/catalog/connections/conn-1/status"), { params: Promise.resolve({ connectionId: "conn-1" }) });

    expect(application.authorize).toHaveBeenCalledTimes(6);
    expect(application.authorize.mock.calls).toEqual(Array.from({ length: 6 }, () => [{ token: "opaque-token", requiredRole: "admin" }]));
  });
});
