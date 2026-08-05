import { beforeEach, describe, expect, it, vi } from "vitest";

const application = { authorize: vi.fn(), addUser: vi.fn(), resetPassword: vi.fn(), deactivateMembership: vi.fn(), changeMembershipRole: vi.fn(), reactivateMembership: vi.fn() };
vi.mock("@/app/api/auth/composition", () => ({ getIdentityApplication: () => application }));
import { POST as create } from "./route";
import { POST as reset } from "./[userId]/reset/route";
import { DELETE as deactivate, PATCH as changeRole } from "./[userId]/membership/route";

const context = { userId: "admin", organizationId: "org-1", role: "admin" as const };
const headers = { origin: "https://sentinel.test", cookie: "__Host-sentinel_session=opaque-token", "content-type": "application/json" };
const request = (url: string, body?: unknown) => new Request(url, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });

describe("admin user routes", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  it("creates identities with generated or custom readable temporary credentials", async () => {
    application.addUser.mockResolvedValueOnce({ kind: "created", userId: "new", temporaryPassword: "Word-Word-4827" }).mockResolvedValueOnce({ kind: "created", userId: "new", temporaryPassword: "custom-pass" });
    const generated = await create(request("https://sentinel.test/api/admin/users", { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" }));
    const custom = await create(request("https://sentinel.test/api/admin/users", { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", temporaryPassword: "custom-pass" }));
    expect(application.addUser).toHaveBeenNthCalledWith(1, { actor: context, firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", role: undefined, temporaryPassword: undefined });
    expect(await generated.json()).toEqual({ userId: "new", temporaryPassword: "Word-Word-4827" });
    expect(await custom.json()).toEqual({ userId: "new", temporaryPassword: "custom-pass" });
  });

  it("attaches or reactivates an existing identity without returning credentials", async () => {
    application.addUser.mockResolvedValue({ kind: "membership_attached", userId: "existing" });
    const response = await create(request("https://sentinel.test/api/admin/users", { firstName: "Ignored", lastName: "Ignored", email: "present@example.test", role: "operator" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ userId: "existing" });
  });

  it("allows only exclusive reset and never exposes hashes or tokens", async () => {
    application.resetPassword.mockResolvedValueOnce({ kind: "reset", temporaryPassword: "Word-Word-4827" }).mockResolvedValueOnce({ kind: "shared_identity_reset_forbidden" });
    const successful = await reset(request("https://sentinel.test/api/admin/users/user-1/reset"), { params: Promise.resolve({ userId: "user-1" }) });
    const rejected = await reset(request("https://sentinel.test/api/admin/users/user-2/reset"), { params: Promise.resolve({ userId: "user-2" }) });
    expect(await successful.json()).toEqual({ temporaryPassword: "Word-Word-4827" });
    expect(rejected.status).toBe(403);
    expect(JSON.stringify(await rejected.json())).not.toMatch(/password|token|hash/i);
  });

  it("deactivates only the selected membership and maps last-admin protection", async () => {
    application.deactivateMembership.mockResolvedValueOnce({ kind: "deactivated" }).mockResolvedValueOnce({ kind: "last_admin" });
    const ok = await deactivate(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user-1" }) });
    const last = await deactivate(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user-1" }) });
    expect(application.deactivateMembership).toHaveBeenCalledWith({ actor: context, userId: "user-1" });
    expect(ok.status).toBe(204); expect(last.status).toBe(409);
  });

  it("rejects last-admin demotion but allows it if another admin remains", async () => {
    application.reactivateMembership.mockResolvedValueOnce({ kind: "last_admin" }).mockResolvedValueOnce({ kind: "changed" });
    const last = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    const ok = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    expect(last.status).toBe(409); expect(ok.status).toBe(204);
  });

  it("rejects invalid origin, session, active organization, or operator without client authority", async () => {
    const cross = await create(new Request("https://sentinel.test/api/admin/users", { method: "POST", headers: { ...headers, origin: "https://attacker.test" }, body: "{}" }));
    expect(cross.status).toBe(403); expect(application.authorize).not.toHaveBeenCalled();
    application.authorize.mockResolvedValue({ kind: "forbidden" });
    const denied = await create(request("https://sentinel.test/api/admin/users", { firstName: "A", lastName: "B", email: "a@b.test", organizationId: "other", role: "admin" }));
    expect(denied.status).toBe(403); expect(application.addUser).not.toHaveBeenCalled();
  });
});

describe("admin delivery validation", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  it("rejects missing sessions and invalid create payloads before application mutations", async () => {
    const noSession = await create(new Request("https://sentinel.test/api/admin/users", { method: "POST", headers: { origin: "https://sentinel.test", "content-type": "application/json" }, body: "{}" }));
    expect(noSession.status).toBe(403);
    const invalid = await create(request("https://sentinel.test/api/admin/users", { firstName: 1, lastName: "B", email: "a@test" }));
    expect(invalid.status).toBe(400);
    expect(application.addUser).not.toHaveBeenCalled();
  });

  it("maps application forbidden results without serializing credentials, tokens, or hashes", async () => {
    application.addUser.mockResolvedValue({ kind: "forbidden" });
    application.resetPassword.mockResolvedValue({ kind: "forbidden" });
    application.deactivateMembership.mockResolvedValue({ kind: "forbidden" });
    application.reactivateMembership.mockResolvedValue({ kind: "forbidden" });
    const responses = [
      await create(request("https://sentinel.test/api/admin/users", { firstName: "A", lastName: "B", email: "a@test" })),
      await reset(request("https://sentinel.test/api/admin/users/user/reset"), { params: Promise.resolve({ userId: "user" }) }),
      await deactivate(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user" }) }),
      await changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await response.text()).not.toMatch(/token|hash|password/i);
    }
  });
});

describe("admin route result translation", () => {
  beforeEach(() => { vi.clearAllMocks(); application.authorize.mockResolvedValue({ kind: "authorized", context }); });

  it("maps invalid email and last-admin create results", async () => {
    application.addUser.mockResolvedValueOnce({ kind: "invalid_email" }).mockResolvedValueOnce({ kind: "last_admin" });
    expect((await create(request("https://sentinel.test/api/admin/users", { firstName: "Ada", lastName: "Lovelace", email: "invalid" }))).status).toBe(400);
    expect((await create(request("https://sentinel.test/api/admin/users", { firstName: "Ada", lastName: "Lovelace", email: "ada@example.test" }))).status).toBe(409);
  });

  it("rejects invalid JSON, role, and missing or invalid user IDs before mutations", async () => {
    const invalidJson = await create(new Request("https://sentinel.test/api/admin/users", { method: "POST", headers, body: "{" }));
    const invalidRole = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "owner" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    const missingId = await reset(request("https://sentinel.test/api/admin/users//reset"), { params: Promise.resolve({ userId: "" }) });
    const invalidId = await deactivate(new Request("https://sentinel.test/api/admin/users/%20/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: " " }) });
    expect([invalidJson.status, invalidRole.status, missingId.status, invalidId.status]).toEqual([400, 400, 400, 400]);
    expect(application.addUser).not.toHaveBeenCalled();
    expect(application.changeMembershipRole).not.toHaveBeenCalled();
    expect(application.resetPassword).not.toHaveBeenCalled();
    expect(application.deactivateMembership).not.toHaveBeenCalled();
  });

  it("uses persisted membership state in the application instead of client status to protect the last administrator", async () => {
    application.reactivateMembership.mockResolvedValueOnce({ kind: "last_admin" }).mockResolvedValueOnce({ kind: "changed" }).mockResolvedValueOnce({ kind: "reactivated" });
    const lastAdmin = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "active", role: "operator" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    const activeWithAnotherAdmin = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    const inactive = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "active", role: "admin" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    expect([lastAdmin.status, activeWithAnotherAdmin.status, inactive.status]).toEqual([409, 204, 204]);
    expect(application.authorize).toHaveBeenCalledWith({ token: "opaque-token", requiredRole: "admin" });
    expect(application.reactivateMembership).toHaveBeenCalledTimes(3);
    expect(application.reactivateMembership.mock.calls).toEqual([
      [{ actor: context, userId: "user-1", role: "operator" }],
      [{ actor: context, userId: "user-1", role: "operator" }],
      [{ actor: context, userId: "user-1", role: "admin" }],
    ]);
    expect(application.changeMembershipRole).not.toHaveBeenCalled();
  });

  it("rejects every unsupported membership status before the application", async () => {
    const response = await changeRole(new Request("https://sentinel.test/api/admin/users/user-1/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "inactive", role: "operator" }) }), { params: Promise.resolve({ userId: "user-1" }) });
    expect(response.status).toBe(400);
    expect(application.reactivateMembership).not.toHaveBeenCalled();
  });

  it("maps every membership result without leaking secrets", async () => {
    application.deactivateMembership.mockResolvedValueOnce({ kind: "forbidden" }).mockResolvedValueOnce({ kind: "last_admin" }).mockResolvedValueOnce({ kind: "deactivated" });
    application.reactivateMembership.mockResolvedValueOnce({ kind: "forbidden" }).mockResolvedValueOnce({ kind: "last_admin" }).mockResolvedValueOnce({ kind: "changed" }).mockResolvedValueOnce({ kind: "forbidden" }).mockResolvedValueOnce({ kind: "reactivated" });
    const calls = [
      deactivate(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user" }) }),
      deactivate(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user" }) }),
      deactivate(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "user" }) }),
      changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
      changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
      changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
      changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "active", role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
      changeRole(new Request("https://sentinel.test/api/admin/users/user/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "active", role: "operator" }) }), { params: Promise.resolve({ userId: "user" }) }),
    ];
    const responses = await Promise.all(calls);
    expect(responses.map((response) => response.status)).toEqual([403, 409, 204, 403, 409, 204, 403, 204]);
    for (const response of responses) expect(await response.text()).not.toMatch(/token|hash|password/i);
  });

  it("uses a fresh admin authorization request on create, reset, deactivate, reactivate, and role change", async () => {
    application.addUser.mockResolvedValue({ kind: "membership_attached", userId: "u" });
    application.resetPassword.mockResolvedValue({ kind: "shared_identity_reset_forbidden" });
    application.deactivateMembership.mockResolvedValue({ kind: "deactivated" });
    application.reactivateMembership.mockResolvedValue({ kind: "reactivated" });
    application.changeMembershipRole.mockResolvedValue({ kind: "changed" });
    await create(request("https://sentinel.test/api/admin/users", { firstName: "A", lastName: "B", email: "a@example.test" }));
    await reset(request("https://sentinel.test/api/admin/users/u/reset"), { params: Promise.resolve({ userId: "u" }) });
    await deactivate(new Request("https://sentinel.test/api/admin/users/u/membership", { method: "DELETE", headers }), { params: Promise.resolve({ userId: "u" }) });
    await changeRole(new Request("https://sentinel.test/api/admin/users/u/membership", { method: "PATCH", headers, body: JSON.stringify({ status: "active", role: "operator" }) }), { params: Promise.resolve({ userId: "u" }) });
    await changeRole(new Request("https://sentinel.test/api/admin/users/u/membership", { method: "PATCH", headers, body: JSON.stringify({ role: "operator" }) }), { params: Promise.resolve({ userId: "u" }) });
    expect(application.authorize).toHaveBeenCalledTimes(5);
    expect(application.authorize.mock.calls).toEqual(Array.from({ length: 5 }, () => [{ token: "opaque-token", requiredRole: "admin" }]));
  });
});
