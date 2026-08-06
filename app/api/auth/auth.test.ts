import { beforeEach, describe, expect, it, vi } from "vitest";

const application = {
  login: vi.fn(),
  logout: vi.fn(),
  changePassword: vi.fn(),
  selectOrganization: vi.fn(),
};

vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));

import { POST as login } from "./login/route";

describe("authentication route handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the same public failure for invalid credentials and lockout without setting a session", async () => {
    application.login.mockResolvedValueOnce({ kind: "invalid_credentials" }).mockResolvedValueOnce({ kind: "temporarily_blocked" });
    const invalid = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "nobody@example.test", password: "wrong" }), headers: { "content-type": "application/json" } }));
    const locked = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "known@example.test", password: "wrong" }), headers: { "content-type": "application/json" } }));
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toEqual(await locked.json());
    expect(invalid.headers.get("set-cookie")).toBeNull();
  });

  it("writes a host-only secure session cookie and maps forced password change", async () => {
    application.login.mockResolvedValue({ kind: "password_change_required", token: "opaque-token" });
    const response = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "user@example.test", password: "valid-password" }), headers: { "content-type": "application/json" } }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "/change-password" });
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("__Host-sentinel_session=opaque-token");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=lax");
    expect(cookie).toContain("Max-Age=43200");
    expect(cookie).not.toContain("Domain=");
  });

  it("maps authenticated login to Live with a host-only session cookie", async () => {
    application.login.mockResolvedValue({ kind: "authenticated", token: "opaque-token", organizationId: "organization-1", role: "operator" });

    const response = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "user@example.test", password: "valid-password" }), headers: { "content-type": "application/json" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "/live" });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=43200");
  });

  it("maps tenant selection to its focused navigation", async () => {
    application.login.mockResolvedValue({ kind: "tenant_selection_required", token: "opaque-token" });

    const response = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "user@example.test", password: "valid-password" }), headers: { "content-type": "application/json" } }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ next: "/select-organization" });
    expect(response.headers.get("set-cookie")).toContain("__Host-sentinel_session=opaque-token");
  });

  it("rejects identities without active membership without issuing a usable session or navigation", async () => {
    application.login.mockResolvedValue({ kind: "no_active_membership", token: "opaque-token" });
    application.logout.mockResolvedValue({ kind: "logged_out" });

    const response = await login(new Request("https://sentinel.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "user@example.test", password: "valid-password" }), headers: { "content-type": "application/json" } }));

    expect(application.logout).toHaveBeenCalledWith({ token: "opaque-token" });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No active organization membership." });
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
