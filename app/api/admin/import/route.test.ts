import { beforeEach, describe, expect, it, vi } from "vitest";

const application = { authorizePlatform: vi.fn() };
const importProvider = vi.fn();

vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));
vi.mock("./composition", () => ({ getProviderImportRuntime: () => importProvider }));

import { POST } from "./route";

const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=platform-token", "content-type": "application/json" };

describe("platform provider import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    application.authorizePlatform.mockResolvedValue({ kind: "authorized", context: { userId: "root", platformRole: "super-admin" } });
    importProvider.mockResolvedValue({ provider: "cybermapa", status: "succeeded" });
  });

  it("authorizes global import with platform authority instead of tenant membership", async () => {
    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));

    expect(response.status).toBe(200);
    await response.text();
    expect(application.authorizePlatform).toHaveBeenCalledWith({ token: "platform-token" });
    expect(importProvider).toHaveBeenCalledWith(expect.objectContaining({ organizationId: "platform", provider: "cybermapa" }));
  });

  it("rejects a tenant administrator before starting an import", async () => {
    application.authorizePlatform.mockResolvedValue({ kind: "forbidden" });

    const response = await POST(new Request("https://sentinel.test/api/admin/import", { method: "POST", headers, body: JSON.stringify({ provider: "cybermapa" }) }));

    expect(response.status).toBe(403);
    expect(importProvider).not.toHaveBeenCalled();
  });
});
