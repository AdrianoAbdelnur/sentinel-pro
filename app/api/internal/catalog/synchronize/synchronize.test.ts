import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogImportSource } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";

const connectionsPort = { listAll: vi.fn() };
const synchronizeDueCatalogConnections = vi.fn();
const cybermapaFactory = vi.fn((): CatalogImportSource => ({ loadCompleteSnapshot: vi.fn() }));
const howenFactory = vi.fn((connection: ProviderConnection): CatalogImportSource | undefined => (connection.companyId ? { loadCompleteSnapshot: vi.fn() } : undefined));

vi.mock("./composition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./composition")>();
  return {
    ...actual,
    getCatalogSyncRuntime: async () => ({ connections: connectionsPort, synchronizeDueCatalogConnections, factories: { cybermapa: cybermapaFactory, howen: howenFactory } }),
  };
});

import { buildDueCandidates, createDefaultConnectionSourceFactories, resolveConnectionSource } from "./composition";
import { POST } from "./route";

const SECRET = "cron-secret-value-for-tests";
const connectionCybermapa: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a" };
const connectionHowen: ProviderConnection = { id: "conn-howen", organizationId: "org-b", credentialRef: "vault:howen/org-b" };
const connectionHowenAssigned: ProviderConnection = { id: "conn-howen-2", organizationId: "org-b", credentialRef: "vault:howen/org-b", companyId: "company-b" };
const connectionUnsupported: ProviderConnection = { id: "conn-x", organizationId: "org-b", credentialRef: "vault:acme/org-b" };

function request(headers: Record<string, string> = {}) {
  return new Request("https://sentinel.test/api/internal/catalog/synchronize", { method: "POST", headers });
}
const bearer = (token: string) => request({ authorization: `Bearer ${token}` });

describe("resolveConnectionSource pairs a connection with its own provider only, derived server-side from credentialRef", () => {
  const cybermapaSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
  const howenSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
  const factories = { cybermapa: () => cybermapaSource, howen: (connection: ProviderConnection) => (connection.companyId ? howenSource : undefined) };

  it("resolves a cybermapa-tagged connection to the cybermapa factory, never howen's", () => {
    expect(resolveConnectionSource(connectionCybermapa, factories)).toBe(cybermapaSource);
  });

  it("resolves an assigned howen-tagged connection to the howen factory, never cybermapa's", () => {
    expect(resolveConnectionSource(connectionHowenAssigned, factories)).toBe(howenSource);
  });

  it("resolves no source for a howen-tagged connection lacking a company assignment, passing the connection itself to the factory", () => {
    expect(resolveConnectionSource(connectionHowen, factories)).toBeUndefined();
  });

  it("resolves no source at all for a provider with no registered factory, rather than guessing one", () => {
    const unregistered: ProviderConnection = { id: "conn-x", organizationId: "org-a", credentialRef: "vault:acme/org-a" };
    expect(resolveConnectionSource(unregistered, factories)).toBeUndefined();
  });
});

describe("buildDueCandidates enumerates every connection, tenant-scoped from its own stored record", () => {
  it("carries each connection's own organizationId into its candidate and separates a truly unsupported provider instead of dropping it silently", async () => {
    const connections = { listAll: async () => [connectionCybermapa, connectionUnsupported] };
    const cybermapaSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
    const factories = { cybermapa: () => cybermapaSource };

    const { candidates, unsupported, missingCompanyAssignment } = await buildDueCandidates(connections, factories);

    expect(candidates).toEqual([{ organizationId: "org-a", connectionId: "conn-cyber", source: cybermapaSource }]);
    expect(unsupported).toEqual([connectionUnsupported]);
    expect(missingCompanyAssignment).toEqual([]);
  });

  it("separates a recognized-but-unassigned Howen connection from a truly unsupported provider into two distinct buckets", async () => {
    const connections = { listAll: async () => [connectionHowen, connectionUnsupported] };
    const factories = { cybermapa: () => ({ loadCompleteSnapshot: vi.fn() }), howen: (connection: ProviderConnection) => (connection.companyId ? { loadCompleteSnapshot: vi.fn() } : undefined) };

    const { candidates, unsupported, missingCompanyAssignment } = await buildDueCandidates(connections, factories);

    expect(candidates).toEqual([]);
    expect(missingCompanyAssignment).toEqual([connectionHowen]);
    expect(unsupported).toEqual([connectionUnsupported]);
  });
});

describe("createDefaultConnectionSourceFactories wires the real Howen adapter behind the company-assignment gate", () => {
  const originalEnv = { ...process.env };
  const howenConnection = (companyId?: string): ProviderConnection => ({ id: "conn-howen", organizationId: "org-a", credentialRef: "vault:howen/org-a", ...(companyId ? { companyId } : {}) });

  afterEach(() => { process.env = { ...originalEnv }; });

  it("declines a Howen connection lacking a company assignment without building a client or throwing", () => {
    Object.assign(process.env, { HOWEN_BASE_URL: "https://howen.test", HOWEN_USERNAME: "user", HOWEN_PASSWORD: "pass" });
    const factories = createDefaultConnectionSourceFactories();
    expect(() => factories.howen(howenConnection())).not.toThrow();
    expect(factories.howen(howenConnection())).toBeUndefined();
  });

  it("builds a Howen source once environment and a company assignment are both present", () => {
    Object.assign(process.env, { HOWEN_BASE_URL: "https://howen.test", HOWEN_USERNAME: "user", HOWEN_PASSWORD: "pass" });
    const factories = createDefaultConnectionSourceFactories();
    expect(factories.howen(howenConnection("company-a"))).toBeDefined();
  });

  it("declines rather than throwing when Howen environment is not configured, even with a company assignment", () => {
    delete process.env.HOWEN_BASE_URL;
    delete process.env.HOWEN_USERNAME;
    delete process.env.HOWEN_PASSWORD;
    const factories = createDefaultConnectionSourceFactories();
    expect(() => factories.howen(howenConnection("company-a"))).not.toThrow();
    expect(factories.howen(howenConnection("company-a"))).toBeUndefined();
  });
});

describe("POST /api/internal/catalog/synchronize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTINEL_CATALOG_SYNC_SECRET = SECRET;
    connectionsPort.listAll.mockResolvedValue([connectionCybermapa]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [] });
  });

  it("rejects an invalid secret and never calls the scheduler", async () => {
    const response = await POST(bearer("wrong-secret"));
    expect(response.status).toBe(401);
    expect(synchronizeDueCatalogConnections).not.toHaveBeenCalled();
  });

  it("treats a missing Authorization header identically to an invalid secret in status and body", async () => {
    const invalid = await POST(bearer("wrong-secret"));
    const missing = await POST(request());
    expect(missing.status).toBe(invalid.status);
    expect(await missing.json()).toEqual(await invalid.json());
  });

  it("treats a malformed Authorization header identically to an invalid secret in status and body", async () => {
    const invalid = await POST(bearer("wrong-secret"));
    const malformed = await POST(request({ authorization: "Basic not-a-bearer-token" }));
    expect(malformed.status).toBe(invalid.status);
    expect(await malformed.json()).toEqual(await invalid.json());
  });

  it("rejects every request when the server has no configured secret, identically to a wrong client secret", async () => {
    delete process.env.SENTINEL_CATALOG_SYNC_SECRET;
    const invalid = await POST(bearer("wrong-secret"));
    const unconfigured = await POST(bearer(SECRET));
    expect(unconfigured.status).toBe(invalid.status);
    expect(await unconfigured.json()).toEqual(await invalid.json());
    expect(synchronizeDueCatalogConnections).not.toHaveBeenCalled();
  });

  it("accepts the exact configured secret and calls the scheduler with server-resolved candidates", async () => {
    const response = await POST(bearer(SECRET));
    expect(response.status).toBe(200);
    expect(synchronizeDueCatalogConnections).toHaveBeenCalledWith({ candidates: [{ organizationId: "org-a", connectionId: "conn-cyber", source: expect.anything() }] });
  });

  it("isolates one connection's problem from another: a connection with no matching provider factory does not prevent a different connection from being scheduled", async () => {
    connectionsPort.listAll.mockResolvedValue([connectionCybermapa, connectionUnsupported]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [{ organizationId: "org-a", connectionId: "conn-cyber", outcome: { kind: "succeeded", run: {} } }] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    expect(synchronizeDueCatalogConnections).toHaveBeenCalledWith({ candidates: [{ organizationId: "org-a", connectionId: "conn-cyber", source: expect.anything() }] });
    expect(body.results).toContainEqual({ organizationId: "org-a", connectionId: "conn-cyber", kind: "succeeded", retryable: false, permanent: false });
    expect(body.results).toContainEqual({ organizationId: "org-b", connectionId: "conn-x", kind: "unsupported-provider", retryable: false, permanent: true });
  });

  it("schedules an enabled Howen connection once it carries a company assignment, through the same candidate pipeline as Cybermapa", async () => {
    connectionsPort.listAll.mockResolvedValue([connectionHowenAssigned]);

    const response = await POST(bearer(SECRET));
    expect(response.status).toBe(200);
    expect(synchronizeDueCatalogConnections).toHaveBeenCalledWith({ candidates: [{ organizationId: "org-b", connectionId: "conn-howen-2", source: expect.anything() }] });
  });

  it("marks a Howen connection missing its company assignment distinguishably from unsupported-provider and not-found, without inventing a company", async () => {
    connectionsPort.listAll.mockResolvedValue([connectionHowen, connectionUnsupported]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [{ organizationId: "org-a", connectionId: "conn-other", outcome: { kind: "not-found" } }] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    expect(body.results).toContainEqual({ organizationId: "org-b", connectionId: "conn-howen", kind: "missing-company-assignment", retryable: false, permanent: true });
    expect(body.results).toContainEqual({ organizationId: "org-b", connectionId: "conn-x", kind: "unsupported-provider", retryable: false, permanent: true });
    expect(body.results).toContainEqual({ organizationId: "org-a", connectionId: "conn-other", kind: "not-found", retryable: false, permanent: false });
    const kinds = body.results.map((entry: { kind: string }) => entry.kind);
    expect(new Set(kinds).size).toBe(3);
  });

  it("marks a retryable failure as retryable and keeps it distinguishable from a non-retryable not-found outcome", async () => {
    synchronizeDueCatalogConnections.mockResolvedValue({
      results: [
        { organizationId: "org-a", connectionId: "conn-cyber", outcome: { kind: "retryable-failure", run: {}, failure: { category: "connectivity" } } },
        { organizationId: "org-a", connectionId: "conn-other", outcome: { kind: "not-found" } },
      ],
    });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    expect(body.results).toContainEqual({ organizationId: "org-a", connectionId: "conn-cyber", kind: "retryable-failure", retryable: true, permanent: false, failureCategory: "connectivity" });
    expect(body.results).toContainEqual({ organizationId: "org-a", connectionId: "conn-other", kind: "not-found", retryable: false, permanent: false });
  });

  it("never includes the configured secret anywhere in the response body", async () => {
    const response = await POST(bearer(SECRET));
    expect(JSON.stringify(await response.json())).not.toContain(SECRET);
  });

  it.each([
    ["succeeded", { kind: "succeeded", run: {} }, false],
    ["skipped-fresh", { kind: "skipped-fresh", lastSuccessAt: new Date("2026-08-09T00:00:00Z") }, false],
    ["not-found", { kind: "not-found" }, false],
    ["already-running", { kind: "already-running" }, true],
    ["retryable-failure", { kind: "retryable-failure", run: {}, failure: { category: "internal" } }, true],
    ["unexpected-failure", { kind: "unexpected-failure" }, true],
  ])("classifies every application outcome kind exhaustively: %s is retryable=%s", async (_label, outcome, retryable) => {
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [{ organizationId: "org-a", connectionId: "conn-cyber", outcome }] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    expect(body.results[0].retryable).toBe(retryable);
    expect(body.results[0].permanent).toBe(false);
  });

  it("marks an unsupported-provider gap as permanent, distinct from a merely nonexistent connection", async () => {
    connectionsPort.listAll.mockResolvedValue([connectionUnsupported]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    const unsupportedEntry = body.results.find((entry: { kind: string }) => entry.kind === "unsupported-provider");
    expect(unsupportedEntry).toEqual({ organizationId: "org-b", connectionId: "conn-x", kind: "unsupported-provider", retryable: false, permanent: true });
  });
});
