import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieStore = { get: vi.fn() };
const application = { authorize: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));
import { getPageAuthorization } from "./authorization";

describe("page authorization", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses the application authorization service with the opaque cookie and never client roles", async () => {
    cookieStore.get.mockReturnValue({ value: "opaque" });
    application.authorize.mockResolvedValue({ kind: "authorized", context: { userId: "u", organizationId: "o", role: "operator" } });
    await expect(getPageAuthorization("operator")).resolves.toEqual({ kind: "authorized", context: { userId: "u", organizationId: "o", role: "operator" } });
    expect(application.authorize).toHaveBeenCalledWith({ token: "opaque", requiredRole: "operator" });
  });

  it("returns the fresh denial for an operator attempting an admin page", async () => {
    cookieStore.get.mockReturnValue({ value: "operator-token" });
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    await expect(getPageAuthorization("admin")).resolves.toEqual({ kind: "forbidden" });
    expect(application.authorize).toHaveBeenCalledWith({ token: "operator-token", requiredRole: "admin" });
  });

  it("returns the fresh denial for a revoked or invalid session", async () => {
    cookieStore.get.mockReturnValue({ value: "revoked-token" });
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    await expect(getPageAuthorization("admin")).resolves.toEqual({ kind: "forbidden" });
    expect(application.authorize).toHaveBeenCalledWith({ token: "revoked-token", requiredRole: "admin" });
  });
});
