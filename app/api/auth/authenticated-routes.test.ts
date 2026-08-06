import { beforeEach, describe, expect, it, vi } from "vitest";

const application = { logout: vi.fn(), changePassword: vi.fn(), selectOrganization: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));
import { POST as logout } from "./logout/route";
import { POST as changePassword } from "./change-password/route";
import { POST as selectOrganization } from "./select-organization/route";

const sameOrigin = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=opaque-token", "content-type": "application/json" };

describe("authenticated auth routes", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["logout", logout, undefined],
    ["change-password", changePassword, { password: "eightchars" }],
    ["select-organization", selectOrganization, { organizationId: "organization-2" }],
  ])("rejects cross-origin %s mutations before calling the application", async (_name, handler, body) => {
    const response = await handler(new Request("https://sentinel.test/api/auth/mutation", { method: "POST", headers: { ...sameOrigin, origin: "https://attacker.test" }, body: body ? JSON.stringify(body) : undefined }));
    expect(response.status).toBe(403);
    expect(application.logout).not.toHaveBeenCalled();
    expect(application.changePassword).not.toHaveBeenCalled();
    expect(application.selectOrganization).not.toHaveBeenCalled();
  });

  it("revokes the server session then expires the session cookie", async () => {
    application.logout.mockResolvedValue({ kind: "logged_out" });
    const response = await logout(new Request("https://sentinel.test/api/auth/logout", { method: "POST", headers: sameOrigin }));
    expect(application.logout).toHaveBeenCalledWith({ token: "opaque-token" });
    expect(response.status).toBe(204);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("changes a password only through the session identified by the cookie", async () => {
    application.changePassword.mockResolvedValue({ kind: "changed" });
    const response = await changePassword(new Request("https://sentinel.test/api/auth/change-password", { method: "POST", headers: sameOrigin, body: JSON.stringify({ password: "eightchars" }) }));
    expect(application.changePassword).toHaveBeenCalledWith({ token: "opaque-token", password: "eightchars" });
    expect(await response.json()).toEqual({ next: "/login" });
  });

  it("rejects a password change without a session token", async () => {
    const response = await changePassword(new Request("https://sentinel.test/api/auth/change-password", { method: "POST", headers: { origin: "https://sentinel.test", "content-type": "application/json" }, body: JSON.stringify({ password: "eightchars" }) }));
    expect(response.status).toBe(403);
    expect(application.changePassword).not.toHaveBeenCalled();
  });

  it("maps invalid and forbidden password changes without expiring the session", async () => {
    application.changePassword.mockResolvedValueOnce({ kind: "invalid_password" }).mockResolvedValueOnce({ kind: "forbidden" });
    const invalid = await changePassword(new Request("https://sentinel.test/api/auth/change-password", { method: "POST", headers: sameOrigin, body: JSON.stringify({ password: "short" }) }));
    const forbiddenResponse = await changePassword(new Request("https://sentinel.test/api/auth/change-password", { method: "POST", headers: sameOrigin, body: JSON.stringify({ password: "eightchars" }) }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toEqual({ error: "La contraseña debe tener al menos 8 caracteres." });
    expect(forbiddenResponse.status).toBe(403);
    expect(await forbiddenResponse.json()).toEqual({ error: "No tenés permisos para realizar esta acción." });
    expect(forbiddenResponse.headers.get("set-cookie")).toBeNull();
  });

  it("switches only through the application contract and retains the session cookie", async () => {
    application.selectOrganization.mockResolvedValue({ kind: "selected", organizationId: "organization-2", role: "operator" });
    const response = await selectOrganization(new Request("https://sentinel.test/api/auth/select-organization", { method: "POST", headers: sameOrigin, body: JSON.stringify({ organizationId: "organization-2" }) }));
    expect(application.selectOrganization).toHaveBeenCalledWith({ token: "opaque-token", organizationId: "organization-2" });
    expect(await response.json()).toEqual({ next: "/live" });
  });

  it("rejects invalid organization input without calling the application", async () => {
    const response = await selectOrganization(new Request("https://sentinel.test/api/auth/select-organization", { method: "POST", headers: sameOrigin, body: JSON.stringify({ organizationId: 42 }) }));
    expect(response.status).toBe(403);
    expect(application.selectOrganization).not.toHaveBeenCalled();
  });

  it("maps a forbidden organization switch", async () => {
    application.selectOrganization.mockResolvedValue({ kind: "forbidden" });
    const response = await selectOrganization(new Request("https://sentinel.test/api/auth/select-organization", { method: "POST", headers: sameOrigin, body: JSON.stringify({ organizationId: "organization-2" }) }));
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "No tenés permisos para realizar esta acción." });
  });
});
