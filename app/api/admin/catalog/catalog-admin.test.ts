import { beforeEach, describe, expect, it, vi } from "vitest";

const application = { authorize: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));

const bindProviderCompany = vi.fn();
const assignConnectionCompany = vi.fn();
vi.mock("./composition", () => ({ getCatalogAdminRuntime: async () => ({ bindProviderCompany, assignConnectionCompany }) }));

import { POST as bindCandidate } from "./companies/candidates/[candidateId]/bind/route";
import { POST as assignCompany } from "./connections/[connectionId]/company/route";

const context = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=opaque-token", "content-type": "application/json" };
const get = (url: string) => new Request(url, { method: "GET", headers });
const post = (url: string, body?: unknown) => new Request(url, { method: "POST", headers, body: body !== undefined ? JSON.stringify(body) : undefined });

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

