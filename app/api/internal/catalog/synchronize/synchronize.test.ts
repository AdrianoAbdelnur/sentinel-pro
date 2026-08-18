import { beforeEach, describe, expect, it, vi } from "vitest";

const runtime = {
  synchronize: vi.fn(),
  listDueConnections: vi.fn(),
  providers: { findById: vi.fn() },
  sources: { resolve: vi.fn() },
};
vi.mock("../v2/composition", () => ({ getGlobalCatalogSyncRuntime: async () => runtime }));

import { POST } from "./route";

const request = (token?: string) => new Request("https://sentinel.test/api/internal/catalog/synchronize", { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {} });

describe("POST /api/internal/catalog/synchronize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SENTINEL_CATALOG_SYNC_SECRET = "secret";
  });

  it("rejects invalid internal authentication before reading canonical connections", async () => {
    const response = await POST(request("wrong"));

    expect(response.status).toBe(401);
    expect(runtime.listDueConnections).not.toHaveBeenCalled();
  });

  it("synchronizes every due connection through the canonical provider registry", async () => {
    runtime.listDueConnections.mockResolvedValue([{ id: "connection-1", providerId: "provider-1" }]);
    runtime.providers.findById.mockResolvedValue({ id: "provider-1", adapterKey: "cybermapa", capabilities: ["gps"] });
    runtime.sources.resolve.mockReturnValue({ loadSnapshot: vi.fn() });
    runtime.synchronize.mockResolvedValue({ kind: "succeeded", run: { counts: {} } });

    const response = await POST(request("secret"));

    expect(response.status).toBe(200);
    expect(runtime.synchronize).toHaveBeenCalledWith({ connectionId: "connection-1", trigger: "scheduler", source: expect.anything() });
    expect(await response.json()).toEqual({ results: [{ kind: "succeeded" }] });
  });

  it("isolates a missing adapter without blocking another connection", async () => {
    runtime.listDueConnections.mockResolvedValue([
      { id: "connection-1", providerId: "provider-1" },
      { id: "connection-2", providerId: "provider-2" },
    ]);
    runtime.providers.findById
      .mockResolvedValueOnce({ id: "provider-1", adapterKey: "missing", capabilities: [] })
      .mockResolvedValueOnce({ id: "provider-2", adapterKey: "howen", capabilities: ["video"] });
    runtime.sources.resolve.mockReturnValueOnce(undefined).mockReturnValueOnce({ loadSnapshot: vi.fn() });
    runtime.synchronize.mockResolvedValue({ kind: "succeeded", run: { counts: {} } });

    const response = await POST(request("secret"));

    expect(await response.json()).toEqual({ results: [{ kind: "misconfigured" }, { kind: "succeeded" }] });
    expect(runtime.synchronize).toHaveBeenCalledTimes(1);
  });

  it("returns only sanitized canonical failure data", async () => {
    runtime.listDueConnections.mockResolvedValue([{ id: "connection-1", providerId: "provider-1" }]);
    runtime.providers.findById.mockResolvedValue({ id: "provider-1", adapterKey: "cybermapa", capabilities: [] });
    runtime.sources.resolve.mockReturnValue({ loadSnapshot: vi.fn() });
    runtime.synchronize.mockResolvedValue({ kind: "failed", retryable: true, failure: { category: "connectivity" }, run: {} });

    const response = await POST(request("secret"));

    expect(await response.json()).toEqual({ results: [{ kind: "failed", retryable: true, failureCategory: "connectivity" }] });
  });
});
