import { describe, expect, it, vi } from "vitest";

const { runtime, authorizePlatformRequest } = vi.hoisted(() => ({ runtime: { getStatus: vi.fn() }, authorizePlatformRequest: vi.fn() }));
vi.mock("@/app/api/admin/users/delivery", () => ({ authorizePlatformRequest }));
vi.mock("@/app/api/internal/catalog/v2/composition", () => ({ getGlobalCatalogSyncRuntime: async () => runtime }));

import { NextResponse } from "next/server";
import { GET } from "./[connectionId]/status/route";

describe("GET /api/admin/catalog/v2/connections/:connectionId/status", () => {
  it("rejects tenant authorization before reading global status", async () => {
    authorizePlatformRequest.mockResolvedValue(NextResponse.json({ error: "Forbidden." }, { status: 403 }));
    const response = await GET(new Request("https://sentinel.test"), { params: Promise.resolve({ connectionId: "connection-1" }) });
    expect(response.status).toBe(403);
    expect(runtime.getStatus).not.toHaveBeenCalled();
  });

  it("projects global status without exposing provider credentials", async () => {
    authorizePlatformRequest.mockResolvedValue({ userId: "admin", platformRole: "super-admin" });
    runtime.getStatus.mockResolvedValue({ kind: "found", status: { connectionId: "connection-1", latestRun: { status: "succeeded", trigger: "manual", startedAt: new Date("2026-01-01"), counts: {}, snapshot: { status: "complete" }, credentialRef: "vault:secret" }, lastSuccessAt: new Date("2026-01-01"), isDue: false } });
    const response = await GET(new Request("https://sentinel.test"), { params: Promise.resolve({ connectionId: "connection-1" }) });
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain("vault:secret");
  });
});
