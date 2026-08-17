import { beforeEach, describe, expect, it, vi } from "vitest";

const application = { authorizePlatform: vi.fn() };
const synchronize = vi.fn();
const runtime = {
  connections: { findEnabledByProviderId: vi.fn() },
  providers: { findByAdapterKey: vi.fn() },
  sources: { resolve: vi.fn() },
  synchronize,
};

vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));
vi.mock("./composition", () => ({ getProviderImportRuntime: () => runtime }));

import { POST } from "./route";

const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=platform-token", "content-type": "application/json" };

describe("platform provider import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    application.authorizePlatform.mockResolvedValue({ kind: "authorized", context: { userId: "root", platformRole: "super-admin" } });
    runtime.connections.findEnabledByProviderId.mockResolvedValue({ id: "connection-1", providerId: "provider-1", credentialRef: "vault:cybermapa/import", enabled: true, cadenceMinutes: 60 });
    runtime.providers.findByAdapterKey.mockResolvedValue({ id: "provider-1", adapterKey: "cybermapa", capabilities: [] });
    runtime.sources.resolve.mockReturnValue({ loadSnapshot: vi.fn() });
    synchronize.mockResolvedValue({ kind: "succeeded", run: { id: "run-1", lineageId: "lineage-1", attempt: 1, connectionId: "connection-1", trigger: "manual", status: "succeeded", startedAt: new Date(0), completedAt: new Date(1), total: 1, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "complete" } } });
  });

  it("authorizes global import with platform authority instead of tenant membership", async () => {
    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));

    expect(response.status).toBe(200);
    await response.text();
    expect(application.authorizePlatform).toHaveBeenCalledWith({ token: "platform-token" });
    expect(synchronize).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "connection-1", trigger: "manual" }));
  });

  it("rejects a tenant administrator before starting an import", async () => {
    application.authorizePlatform.mockResolvedValue({ kind: "forbidden" });

    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));

    expect(response.status).toBe(403);
    expect(synchronize).not.toHaveBeenCalled();
  });

  it("uses one V2 connection and never calls the legacy import application", async () => {
    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));
    await response.text();

    expect(runtime.connections.findEnabledByProviderId).toHaveBeenCalledWith("provider-1");
    expect(runtime.sources.resolve).toHaveBeenCalled();
  });

  it("emits one terminal event and tolerates late progress and repeated close", async () => {
    synchronize.mockImplementationOnce(async ({ onProgress }: { onProgress: (progress: unknown) => Promise<void> }) => {
      await onProgress({ connectionId: "connection-1", lineageId: "lineage-1", runId: "run-1", total: 1, checkpoint: "v-1", counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, currentGroup: "Fleet" });
      return { kind: "succeeded", run: { id: "run-1", lineageId: "lineage-1", attempt: 1, connectionId: "connection-1", trigger: "manual", status: "succeeded", startedAt: new Date(0), completedAt: new Date(1), total: 1, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "complete" } } };
    });
    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));
    const text = await response.text();
    expect(text.match(/"type":"result"/g)).toHaveLength(1);
  });

  it("does not write when the request is already cancelled", async () => {
    const abortController = new AbortController();
    abortController.abort();

    const response = await POST(new Request("https://sentinel.test/api/admin/import", {
      method: "POST",
      headers,
      body: JSON.stringify({ provider: "cybermapa" }),
      signal: abortController.signal,
    }));

    expect(await response.text()).toBe("");
    expect(synchronize).toHaveBeenCalledOnce();
  });

  it("keeps successful execution after transport cancellation and late progress", async () => {
    let publishProgress: ((progress: unknown) => Promise<void>) | undefined;
    let resolveSynchronization: ((outcome: unknown) => void) | undefined;
    const synchronization = new Promise((resolve) => { resolveSynchronization = resolve; });
    synchronize.mockImplementationOnce(({ onProgress }: { onProgress: (progress: unknown) => Promise<void> }) => {
      publishProgress = onProgress;
      return synchronization;
    });

    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));
    const reader = response.body?.getReader();
    await reader?.read();
    await reader?.cancel("client disconnected");
    await publishProgress?.({ connectionId: "connection-1", lineageId: "lineage-1", runId: "run-1", total: 1, checkpoint: "v-1", counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
    resolveSynchronization?.({ kind: "succeeded", run: { id: "run-1", lineageId: "lineage-1", attempt: 1, connectionId: "connection-1", trigger: "manual", status: "succeeded", startedAt: new Date(0), completedAt: new Date(1), total: 1, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "complete" } } });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(synchronize).toHaveBeenCalledOnce();
  });

  it("ignores a progress callback after the terminal event and closes once", async () => {
    let publishLateProgress: ((progress: unknown) => Promise<void>) | undefined;
    synchronize.mockImplementationOnce(async ({ onProgress }: { onProgress: (progress: unknown) => Promise<void> }) => {
      publishLateProgress = onProgress;
      return { kind: "succeeded", run: { id: "run-1", lineageId: "lineage-1", attempt: 1, connectionId: "connection-1", trigger: "manual", status: "succeeded", startedAt: new Date(0), completedAt: new Date(1), total: 1, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "complete" } } };
    });

    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));
    const text = await response.text();
    await publishLateProgress?.({ connectionId: "connection-1", lineageId: "lineage-1", runId: "run-1", total: 1, checkpoint: "late", counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });

    expect(text.match(/"type":"result"/g)).toHaveLength(1);
  });
});
