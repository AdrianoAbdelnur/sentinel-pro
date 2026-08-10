import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CatalogImportSource } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";

const connectionsPort = { listAll: vi.fn() };
const synchronizeDueCatalogConnections = vi.fn();
const cybermapaFactory = vi.fn((): CatalogImportSource => ({ loadCompleteSnapshot: vi.fn() }));

vi.mock("./composition", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./composition")>();
  return {
    ...actual,
    getCatalogSyncRuntime: async () => ({ connections: connectionsPort, synchronizeDueCatalogConnections, factories: { cybermapa: cybermapaFactory } }),
  };
});

import { buildDueCandidates, resolveConnectionSource } from "./composition";
import { POST } from "./route";

const SECRET = "cron-secret-value-for-tests";
const connectionCybermapa: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a" };
const connectionHowen: ProviderConnection = { id: "conn-howen", organizationId: "org-b", credentialRef: "vault:howen/org-b" };

function request(headers: Record<string, string> = {}) {
  return new Request("https://sentinel.test/api/internal/catalog/synchronize", { method: "POST", headers });
}
const bearer = (token: string) => request({ authorization: `Bearer ${token}` });

describe("resolveConnectionSource pairs a connection with its own provider only, derived server-side from credentialRef", () => {
  const cybermapaSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
  const howenSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
  const factories = { cybermapa: () => cybermapaSource, howen: () => howenSource };

  it("resolves a cybermapa-tagged connection to the cybermapa factory, never howen's", () => {
    expect(resolveConnectionSource(connectionCybermapa, factories)).toBe(cybermapaSource);
  });

  it("resolves a howen-tagged connection to the howen factory, never cybermapa's", () => {
    expect(resolveConnectionSource(connectionHowen, factories)).toBe(howenSource);
  });

  it("resolves no source at all for a provider with no registered factory, rather than guessing one", () => {
    const unregistered: ProviderConnection = { id: "conn-x", organizationId: "org-a", credentialRef: "vault:acme/org-a" };
    expect(resolveConnectionSource(unregistered, factories)).toBeUndefined();
  });
});

describe("buildDueCandidates enumerates every connection, tenant-scoped from its own stored record", () => {
  it("carries each connection's own organizationId into its candidate and separates unsupported providers instead of dropping them silently", async () => {
    const connections = { listAll: async () => [connectionCybermapa, connectionHowen] };
    const cybermapaSource: CatalogImportSource = { loadCompleteSnapshot: vi.fn() };
    const factories = { cybermapa: () => cybermapaSource };

    const { candidates, unsupported } = await buildDueCandidates(connections, factories);

    expect(candidates).toEqual([{ organizationId: "org-a", connectionId: "conn-cyber", source: cybermapaSource }]);
    expect(unsupported).toEqual([connectionHowen]);
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
    connectionsPort.listAll.mockResolvedValue([connectionCybermapa, connectionHowen]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [{ organizationId: "org-a", connectionId: "conn-cyber", outcome: { kind: "succeeded", run: {} } }] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    expect(synchronizeDueCatalogConnections).toHaveBeenCalledWith({ candidates: [{ organizationId: "org-a", connectionId: "conn-cyber", source: expect.anything() }] });
    expect(body.results).toContainEqual({ organizationId: "org-a", connectionId: "conn-cyber", kind: "succeeded", retryable: false, permanent: false });
    expect(body.results).toContainEqual({ organizationId: "org-b", connectionId: "conn-howen", kind: "unsupported-provider", retryable: false, permanent: true });
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
    connectionsPort.listAll.mockResolvedValue([connectionHowen]);
    synchronizeDueCatalogConnections.mockResolvedValue({ results: [] });

    const response = await POST(bearer(SECRET));
    const body = await response.json();

    const unsupportedEntry = body.results.find((entry: { kind: string }) => entry.kind === "unsupported-provider");
    expect(unsupportedEntry).toEqual({ organizationId: "org-b", connectionId: "conn-howen", kind: "unsupported-provider", retryable: false, permanent: true });
  });
});
