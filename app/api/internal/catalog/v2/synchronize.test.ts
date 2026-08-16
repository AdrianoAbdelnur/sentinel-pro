import { beforeEach, describe, expect, it, vi } from "vitest";

const synchronize = vi.fn();
const listDueConnections = vi.fn();
const runtime = { synchronize, listDueConnections, providers: { findById: vi.fn() }, sources: { resolve: vi.fn() } };

vi.mock("./composition", () => ({ getGlobalCatalogSyncRuntime: async () => runtime }));

import { POST } from "./synchronize/route";

const request = (authorization?: string) => new Request("https://sentinel.test/api/internal/catalog/v2/synchronize", { method: "POST", headers: authorization ? { authorization } : {} });

describe("POST /api/internal/catalog/v2/synchronize", () => {
  beforeEach(() => { vi.clearAllMocks(); process.env.SENTINEL_CATALOG_SYNC_SECRET = "secret"; process.env.SENTINEL_CATALOG_V2_SYNC_ENABLED = "true"; });

  it("rejects invalid internal authentication before loading due connections", async () => {
    const response = await POST(request("Bearer wrong"));
    expect(response.status).toBe(401);
    expect(listDueConnections).not.toHaveBeenCalled();
  });

  it("uses the same scheduler use case for every due global connection", async () => {
    listDueConnections.mockResolvedValue([{ id: "connection-1", providerId: "provider-1" }]);
    runtime.providers.findById.mockResolvedValue({ id: "provider-1", adapterKey: "adapter", capabilities: [] });
    runtime.sources.resolve.mockReturnValue({ loadSnapshot: vi.fn() });
    synchronize.mockResolvedValue({ kind: "succeeded", run: { counts: {} } });
    const response = await POST(request("Bearer secret"));
    expect(response.status).toBe(200);
    expect(synchronize).toHaveBeenCalledWith({ connectionId: "connection-1", trigger: "scheduler", source: expect.anything() });
  });
});
