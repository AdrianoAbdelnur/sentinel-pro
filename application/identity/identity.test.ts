import { describe, expect, it } from "vitest";

import { registerFailedLogin, type IdentityUser, type Organization, type OrganizationMembership } from "@/domain/identity";

import type { IdentityApplicationPorts } from "./ports";
import type { StoredSession } from "./ports";
import { createIdentityApplication } from "./index";

const NOW = new Date("2026-08-04T12:00:00.000Z");

function createFixture() {
  const users = new Map<string, IdentityUser>();
  const memberships: OrganizationMembership[] = [];
  const sessions: StoredSession[] = [];
  const organizations = new Map<string, Organization>();
  let failMembershipSave = false;
  let token = 0;
  let temporaryPassword = 4826;
  let transactionTail = Promise.resolve();
  const verifiedHashes: string[] = [];
  const ports: IdentityApplicationPorts = {
    users: {
      findByEmail: async (email) => [...users.values()].find((user) => user.emailNormalized === email),
      findById: async (id) => users.get(id),
      save: async (user) => { users.set(user.id, user); },
      compareAndTouchAuthorizationVersion: async (userId, expectedAuthorizationVersion, now) => {
        const user = users.get(userId);
        if (!user || user.authorizationVersion !== expectedAuthorizationVersion) return false;
        users.set(userId, { ...user, authorizationVersion: user.authorizationVersion + 1, updatedAt: now });
        return true;
      },
      touchAuthorizationVersion: async (userId) => {
        const user = users.get(userId);
        if (user) users.set(userId, { ...user, authorizationVersion: user.authorizationVersion + 1 });
      },
      registerFailedLogin: async (userId, now) => {
        const user = users.get(userId);
        if (!user) return undefined;
        const failed = registerFailedLogin(user, now);
        users.set(userId, { ...user, ...failed, updatedAt: now });
        return failed;
      },
    },
    memberships: {
      findByUserId: async (userId) => memberships.filter((membership) => membership.userId === userId),
      findByUserAndOrganization: async (userId, organizationId) => memberships.find((membership) => membership.userId === userId && membership.organizationId === organizationId),
      listByOrganization: async (organizationId) => memberships.filter((membership) => membership.organizationId === organizationId),
      save: async (membership) => {
        if (failMembershipSave) { failMembershipSave = false; throw new Error("membership write failed"); }
        const index = memberships.findIndex((item) => item.userId === membership.userId && item.organizationId === membership.organizationId);
        if (index < 0) memberships.push(membership);
        else memberships.splice(index, 1, membership);
      },
      deactivateIfNotLastAdmin: async ({ organizationId, userId }) => {
        const index = memberships.findIndex((membership) => membership.organizationId === organizationId && membership.userId === userId && membership.status === "active");
        if (index < 0) return "not_found";
        const target = memberships[index];
        const otherAdmins = memberships.some((membership) => membership.organizationId === organizationId && membership.userId !== userId && membership.role === "admin" && membership.status === "active");
        if (target.role === "admin" && !otherAdmins) return "last_admin";
        memberships.splice(index, 1, { ...target, status: "inactive" });
        return "deactivated";
      },
      changeRoleIfNotLastAdmin: async ({ organizationId, userId, role }) => {
        const index = memberships.findIndex((membership) => membership.organizationId === organizationId && membership.userId === userId);
        if (index < 0) return "not_found";
        const target = memberships[index];
        const otherAdmins = memberships.some((membership) => membership.organizationId === organizationId && membership.userId !== userId && membership.role === "admin" && membership.status === "active");
        if (target.role === "admin" && target.status === "active" && role !== "admin" && !otherAdmins) return "last_admin";
        memberships.splice(index, 1, { ...target, role });
        return "changed";
      },
    },
    organizations: { findById: async (id) => organizations.get(id), save: async (organization) => { organizations.set(organization.id, organization); } },
    sessions: {
      create: async (session) => { sessions.push(session); },
      touchActive: async (tokenHash, now, expiresAt) => {
        const index = sessions.findIndex((session) => session.tokenHash === tokenHash && !session.revokedAt && session.expiresAt > now);
        if (index < 0) return undefined;
        const touched = { ...sessions[index], lastActivityAt: now, expiresAt };
        sessions.splice(index, 1, touched);
        return touched;
      },
      save: async (session) => { sessions.splice(sessions.findIndex((item) => item.id === session.id), 1, session); },
      revokeByTokenHash: async (tokenHash) => sessions.filter((session) => session.tokenHash === tokenHash).forEach((session) => { session.revokedAt = NOW; }),
      revokeForUser: async (userId) => sessions.filter((session) => session.userId === userId).forEach((session) => { session.revokedAt = NOW; }),
      revokeForUserAndOrganization: async (userId, organizationId) => sessions.filter((session) => session.userId === userId && session.activeOrganizationId === organizationId).forEach((session) => { session.revokedAt = NOW; }),
    },
    passwords: { verify: async (password, hash) => { verifiedHashes.push(hash); return password === hash; }, hash: async (password) => password },
    dummyPasswordHash: "dummy-password-hash",
    temporaryPasswords: { create: () => `North-Harbor-${++temporaryPassword}` },
    tokens: { create: async () => `token-${++token}` },
    tokenHasher: { hash: async (value) => `hashed-${value}` },
    ids: { create: () => `id-${++token}` },
    clock: { now: () => NOW },
    transactions: {
      run: async (work) => {
        let release!: () => void;
        const previous = transactionTail;
        transactionTail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        const userSnapshot = new Map(users);
        const membershipSnapshot = [...memberships];
        const organizationSnapshot = new Map(organizations);
        try {
          return await work({ users: ports.users, memberships: ports.memberships, organizations: ports.organizations, sessions: ports.sessions });
        } catch (error) {
          users.clear(); userSnapshot.forEach((value, key) => users.set(key, value));
          memberships.splice(0, memberships.length, ...membershipSnapshot);
          organizations.clear(); organizationSnapshot.forEach((value, key) => organizations.set(key, value));
          throw error;
        } finally {
          release();
        }
      },
    },
  };
  return { app: createIdentityApplication(ports), ports, users, memberships, sessions, organizations, verifiedHashes, failNextMembershipSave: () => { failMembershipSave = true; } };
}

function createBarrier() {
  let release!: () => void;
  let signal!: () => void;
  const reached = new Promise<void>((resolve) => { signal = resolve; });
  const resume = new Promise<void>((resolve) => { release = resolve; });
  return { reached, pause: () => signal(), release: () => release(), wait: () => resume };
}

async function startLoginAfterVerification(fixture: ReturnType<typeof createFixture>) {
  const barrier = createBarrier();
  const originalVerify = fixture.ports.passwords.verify;
  fixture.ports.passwords.verify = async (password, hash) => {
    const verified = await originalVerify(password, hash);
    if (hash === "password-1") {
      barrier.pause();
      await barrier.wait();
    }
    return verified;
  };
  const login = fixture.app.login({ email: "ada@example.test", password: "password-1" });
  await barrier.reached;
  return { login, release: barrier.release };
}

async function addUser(fixture: ReturnType<typeof createFixture>, overrides: Partial<IdentityUser> = {}) {
  const user: IdentityUser = { id: "user-1", firstName: "Ada", lastName: "Lovelace", emailNormalized: "ada@example.test", passwordHash: "password-1", passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: NOW, updatedAt: NOW, ...overrides };
  fixture.users.set(user.id, user);
  return user;
}

describe("identity application use cases", () => {
  it("authorizes a SUPER ADMIN without an active tenant membership", async () => {
    const fixture = createFixture();
    await addUser(fixture, { platformRole: "super-admin" });
    fixture.sessions.push({ id: "platform", tokenHash: "hashed-platform", userId: "user-1", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect(fixture.app.authorizePlatform({ token: "platform" })).resolves.toEqual({ kind: "authorized", context: { userId: "user-1", platformRole: "super-admin" } });
  });

  it("denies a tenant admin even when the tenant membership is active", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "admin", status: "active" });
    fixture.sessions.push({ id: "tenant-admin", tokenHash: "hashed-tenant-admin", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect(fixture.app.authorizePlatform({ token: "tenant-admin" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("starts a session for valid credentials, resets failures, and auto-selects one active membership", async () => {
    const fixture = createFixture();
    await addUser(fixture, { failureCount: 2 });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    await expect(fixture.app.login({ email: "ADA@example.test", password: "password-1" })).resolves.toEqual({ kind: "authenticated", token: "token-1", organizationId: "org-a", role: "operator" });
    expect(fixture.users.get("user-1")?.failureCount).toBe(0);
    expect(fixture.users.get("user-1")?.authorizationVersion).toBe(1);
  });

  it("returns the same invalid result for missing users and incorrect passwords, blocking on the third failure", async () => {
    const fixture = createFixture();
    await addUser(fixture, { failureCount: 2 });

    await expect(fixture.app.login({ email: "missing@example.test", password: "nope" })).resolves.toEqual({ kind: "invalid_credentials" });
    await expect(fixture.app.login({ email: "ada@example.test", password: "wrong" })).resolves.toEqual({ kind: "invalid_credentials" });
    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toEqual({ kind: "temporarily_blocked" });
  });

  it("atomically records simultaneous failures so the third failed attempt cannot be lost", async () => {
    const fixture = createFixture();
    await addUser(fixture, { failureCount: 1 });

    const results = await Promise.all([
      fixture.app.login({ email: "ada@example.test", password: "wrong" }),
      fixture.app.login({ email: "ada@example.test", password: "wrong" }),
    ]);

    expect(results).toEqual([{ kind: "invalid_credentials" }, { kind: "invalid_credentials" }]);
    expect(fixture.users.get("user-1")).toMatchObject({ failureCount: 3, blockedUntil: new Date("2026-08-04T12:15:00.000Z") });
  });

  it("limits temporary credentials to password change and revokes sessions when changing the password", async () => {
    const fixture = createFixture();
    await addUser(fixture, { passwordChangeRequired: true });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "admin", status: "active" });

    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toEqual({ kind: "password_change_required", token: "token-1" });
    await expect(fixture.app.changePassword({ token: "token-1", password: "new-pass" })).resolves.toEqual({ kind: "changed" });
    expect(fixture.users.get("user-1")).toMatchObject({ passwordHash: "new-pass", passwordChangeRequired: false });
    expect(fixture.sessions[0].revokedAt).toEqual(NOW);
  });

  it("does not let a temporary-password session select a tenant or authorize access before its password changes", async () => {
    const fixture = createFixture();
    await addUser(fixture, { passwordChangeRequired: true });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "admin", status: "active" });

    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "password_change_required") throw new Error("expected password change");

    await expect(fixture.app.selectOrganization({ token: login.token, organizationId: "org-a" })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.app.authorize({ token: login.token, requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("changes only the password of the user identified by the session", async () => {
    const fixture = createFixture();
    await addUser(fixture, { passwordChangeRequired: true });
    await addUser(fixture, { id: "user-2", emailNormalized: "grace@example.test", passwordHash: "other-password", passwordChangeRequired: true });

    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "password_change_required") throw new Error("expected password change");

    await expect(fixture.app.changePassword({ token: login.token, password: "new-pass" })).resolves.toEqual({ kind: "changed" });
    expect(fixture.users.get("user-1")).toMatchObject({ passwordHash: "new-pass", passwordChangeRequired: false });
    expect(fixture.users.get("user-2")).toMatchObject({ passwordHash: "other-password", passwordChangeRequired: true });
  });

  it("persists only a token hash and resolves a session through that hash", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });

    expect(login).toMatchObject({ token: "token-1" });
    expect(fixture.sessions).toMatchObject([{ tokenHash: "hashed-token-1" }]);
    expect(fixture.sessions[0]).not.toHaveProperty("token");
  });

  it("requires tenant selection for multiple active memberships and rejects inactive tenant selection", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" }, { userId: "user-1", organizationId: "org-b", role: "admin", status: "active" });

    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toEqual({ kind: "tenant_selection_required", token: "token-1" });
    await expect(fixture.app.selectOrganization({ token: "token-1", organizationId: "org-b" })).resolves.toEqual({ kind: "selected", organizationId: "org-b", role: "admin" });
    await expect(fixture.app.selectOrganization({ token: "token-1", organizationId: "org-c" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("validates active sessions with sliding activity, revocation, user state, and membership state overrides", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "authenticated") throw new Error("expected login");

    await expect(fixture.app.authorize({ token: login.token, requiredRole: "operator" })).resolves.toEqual({ kind: "authorized", context: { userId: "user-1", organizationId: "org-a", role: "operator" } });
    await expect(fixture.app.authorize({ token: login.token, requiredRole: "admin" })).resolves.toEqual({ kind: "forbidden" });
    fixture.memberships[0].status = "inactive";
    await expect(fixture.app.authorize({ token: login.token, requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("creates a new global identity with a temporary password but only attaches an existing identity", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };

    await expect(fixture.app.addUser({ actor, firstName: "Grace", lastName: "Hopper", email: "grace@example.test", temporaryPassword: "temporary" })).resolves.toMatchObject({ kind: "created", userId: "id-1", temporaryPassword: "temporary" });
    const existing = fixture.users.get("id-1");
    await expect(fixture.app.addUser({ actor: { ...actor, organizationId: "org-b" }, firstName: "Ignored", lastName: "Ignored", email: "grace@example.test", role: "operator" })).resolves.toEqual({ kind: "membership_attached", userId: "id-1" });
    expect(fixture.users.get("id-1")).toMatchObject({ ...existing, authorizationVersion: 1 });
  });

  it("uses the temporary password generator only for a brand-new identity", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };

    await expect(fixture.app.addUser({ actor, firstName: "Grace", lastName: "Hopper", email: "grace@example.test" })).resolves.toMatchObject({ kind: "created", temporaryPassword: "North-Harbor-4827" });
  });

  it("deactivates only the active tenant membership and rejects changes to the last administrator", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "admin", status: "active" }, { userId: "user-1", organizationId: "org-b", role: "operator", status: "active" }, { userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" });

    await expect(fixture.app.deactivateMembership({ actor, userId: "user-1" })).resolves.toEqual({ kind: "deactivated" });
    expect(fixture.memberships).toContainEqual({ userId: "user-1", organizationId: "org-b", role: "operator", status: "active" });
    await expect(fixture.app.deactivateMembership({ actor, userId: "admin-1" })).resolves.toEqual({ kind: "last_admin" });
  });

  it("preserves one administrator when concurrent deactivations target the final two admins", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    await addUser(fixture, { id: "admin-2", emailNormalized: "grace@example.test" });
    fixture.memberships.push(
      { userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" },
      { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" },
    );

    const results = await Promise.all([
      fixture.app.deactivateMembership({ actor, userId: "admin-1" }),
      fixture.app.deactivateMembership({ actor, userId: "admin-2" }),
    ]);

    expect(results).toContainEqual({ kind: "deactivated" });
    expect(results).toContainEqual({ kind: "last_admin" });
    expect(fixture.memberships.filter((membership) => membership.organizationId === "org-a" && membership.role === "admin" && membership.status === "active")).toHaveLength(1);
  });

  it("reactivates an existing membership with the requested role instead of restoring its prior values", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "admin", status: "inactive" });

    await expect(fixture.app.addUser({ actor, firstName: "Ignored", lastName: "Ignored", email: "ada@example.test", role: "operator" })).resolves.toEqual({ kind: "membership_attached", userId: "user-1" });
    expect(fixture.memberships).toContainEqual({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
  });


  it("revokes only the current session when logging out", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    const first = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    const second = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (first.kind !== "authenticated" || second.kind !== "authenticated") throw new Error("expected authentication");

    await expect((fixture.app as typeof fixture.app & { logout(input: { token: string }): Promise<{ kind: "logged_out" }> }).logout({ token: first.token })).resolves.toEqual({ kind: "logged_out" });
    await expect(fixture.app.authorize({ token: first.token, requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
    await expect(fixture.app.authorize({ token: second.token, requiredRole: "operator" })).resolves.toMatchObject({ kind: "authorized" });
  });

  it("verifies a dummy hash when the email does not exist", async () => {
    const fixture = createFixture();

    await expect(fixture.app.login({ email: "missing@example.test", password: "wrong" })).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.verifiedHashes).toEqual(["dummy-password-hash"]);
  });

  it("rejects password changes for inactive users", async () => {
    const fixture = createFixture();
    await addUser(fixture, { passwordChangeRequired: true, status: "inactive" });
    fixture.sessions.push({ id: "session-1", tokenHash: "hashed-token-1", userId: "user-1", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect(fixture.app.changePassword({ token: "token-1", password: "new-pass" })).resolves.toEqual({ kind: "forbidden" });
    expect(fixture.users.get("user-1")?.passwordHash).toBe("password-1");
  });

  it("rejects use exactly twelve hours after session activity", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    fixture.sessions.push({ id: "session-1", tokenHash: "hashed-token-1", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: new Date(NOW.getTime() - 12 * 60 * 60 * 1000), expiresAt: NOW, createdAt: NOW });

    await expect(fixture.app.authorize({ token: "token-1", requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("resets an exclusive tenant user with temporary credentials and revokes all sessions", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { failureCount: 3, blockedUntil: new Date(NOW.getTime() + 1) });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    fixture.sessions.push({ id: "session-1", tokenHash: "hash-1", userId: "user-1", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect((fixture.app as typeof fixture.app & { resetPassword(input: { actor: typeof actor; userId: string; temporaryPassword?: string }): Promise<unknown> }).resetPassword({ actor, userId: "user-1", temporaryPassword: "temporary" })).resolves.toEqual({ kind: "reset", temporaryPassword: "temporary" });
    expect(fixture.users.get("user-1")).toMatchObject({ passwordHash: "temporary", passwordChangeRequired: true, failureCount: 0, blockedUntil: undefined });
    expect(fixture.sessions[0].revokedAt).toEqual(NOW);
  });

  it("rejects resets by operators and for users with memberships in multiple organizations", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" }, { userId: "user-1", organizationId: "org-b", role: "operator", status: "active" });
    const resetPassword = (fixture.app as typeof fixture.app & { resetPassword(input: { actor: { userId: string; organizationId: string; role: "admin" | "operator" }; userId: string }): Promise<unknown> }).resetPassword;

    await expect(resetPassword({ actor: { userId: "operator", organizationId: "org-a", role: "operator" }, userId: "user-1" })).resolves.toEqual({ kind: "forbidden" });
    await expect(resetPassword({ actor: { userId: "admin", organizationId: "org-a", role: "admin" }, userId: "user-1" })).resolves.toEqual({ kind: "shared_identity_reset_forbidden" });
    expect(fixture.users.get("user-1")?.passwordHash).toBe("password-1");
  });

  it("changes a role atomically and protects the last administrator from demotion", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" });

    await expect((fixture.app as typeof fixture.app & { changeMembershipRole(input: { actor: typeof actor; userId: string; role: "operator" }): Promise<unknown> }).changeMembershipRole({ actor, userId: "admin-1", role: "operator" })).resolves.toEqual({ kind: "last_admin" });
    expect(fixture.memberships[0]).toMatchObject({ role: "admin", status: "active" });
  });


  it("demotes an administrator only when another active administrator remains", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    fixture.memberships.push(
      { userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" },
      { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" },
    );

    await expect(fixture.app.changeMembershipRole({ actor, userId: "admin-2", role: "operator" })).resolves.toEqual({ kind: "changed" });
    expect(fixture.memberships).toContainEqual({ userId: "admin-2", organizationId: "org-a", role: "operator", status: "active" });
  });

  it("rolls back the bootstrap seed when a later write fails", async () => {
    const fixture = createFixture();
    fixture.failNextMembershipSave();
    const input = { organizationId: "org-seed", organizationName: "Sentinel", administrator: { id: "admin-seed", firstName: "Root", lastName: "Admin", email: "root@example.test", passwordHash: "hash" } };

    await expect(fixture.app.seed(input)).rejects.toThrow("membership write failed");
    expect(fixture.organizations.has("org-seed")).toBe(false);
    expect(fixture.users.has("admin-seed")).toBe(false);
    expect(fixture.memberships).toEqual([]);
  });

  it("creates the bootstrap organization and administrator idempotently", async () => {
    const fixture = createFixture();
    const input = { organizationId: "org-seed", organizationName: "Sentinel", administrator: { id: "admin-seed", firstName: "Root", lastName: "Admin", email: "root@example.test", passwordHash: "hash" } };

    await expect(fixture.app.seed(input)).resolves.toEqual({ kind: "seeded" });
    await expect(fixture.app.seed(input)).resolves.toEqual({ kind: "already_seeded" });
    expect(fixture.memberships).toHaveLength(1);
  });

  it("returns invalid credentials for malformed emails while still verifying the dummy hash", async () => {
    const fixture = createFixture();

    await expect(fixture.app.login({ email: "not-an-email", password: "wrong" })).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.verifiedHashes).toEqual(["dummy-password-hash"]);
  });

  it("does not expose a lockout after incorrect credentials", async () => {
    const fixture = createFixture();
    await addUser(fixture, { failureCount: 2 });

    await expect(fixture.app.login({ email: "ada@example.test", password: "wrong" })).resolves.toEqual({ kind: "invalid_credentials" });
    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toEqual({ kind: "temporarily_blocked" });
  });

  it("returns no active membership instead of asking an unassigned user to select a tenant", async () => {
    const fixture = createFixture();
    await addUser(fixture);

    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toMatchObject({ kind: "no_active_membership" });
  });

  it("keeps a session active immediately before twelve hours and expires it at twelve hours", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    fixture.sessions.push({ id: "before", tokenHash: "hashed-before", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect(fixture.app.authorize({ token: "before", requiredRole: "operator" })).resolves.toMatchObject({ kind: "authorized" });
  });

  it("revokes tenant sessions only when deactivating a membership", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" }, { userId: "user-1", organizationId: "org-b", role: "operator", status: "active" }, { userId: "admin", organizationId: "org-a", role: "admin", status: "active" });
    fixture.sessions.push({ id: "a", tokenHash: "hash-a", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime()+1), createdAt: NOW }, { id: "b", tokenHash: "hash-b", userId: "user-1", activeOrganizationId: "org-b", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime()+1), createdAt: NOW });

    await expect(fixture.app.deactivateMembership({ actor, userId: "user-1" })).resolves.toEqual({ kind: "deactivated" });
    expect(fixture.sessions.find((session) => session.id === "a")?.revokedAt).toEqual(NOW);
    expect(fixture.sessions.find((session) => session.id === "b")?.revokedAt).toBeUndefined();
  });

  it("rejects a reset for a second inactive membership and revokes sessions in every tenant when eligible", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" }, { userId: "user-1", organizationId: "org-b", role: "operator", status: "inactive" });

    await expect(fixture.app.resetPassword({ actor, userId: "user-1" })).resolves.toEqual({ kind: "shared_identity_reset_forbidden" });
    fixture.memberships.pop();
    fixture.sessions.push({ id: "a", tokenHash: "hash-a", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime()+1), createdAt: NOW }, { id: "b", tokenHash: "hash-b", userId: "user-1", activeOrganizationId: "org-b", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime()+1), createdAt: NOW });
    await fixture.app.resetPassword({ actor, userId: "user-1" });
    expect(fixture.sessions.every((session) => session.revokedAt?.getTime() === NOW.getTime())).toBe(true);
  });

  it("keeps an admin when two role demotions race", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" }, { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" });

    const results = await Promise.all([fixture.app.changeMembershipRole({ actor, userId: "admin-1", role: "operator" }), fixture.app.changeMembershipRole({ actor, userId: "admin-2", role: "operator" })]);
    expect(results).toContainEqual({ kind: "last_admin" });
    expect(fixture.memberships.filter((membership) => membership.role === "admin" && membership.status === "active")).toHaveLength(1);
  });

  it("rolls back identity creation when its first membership fails and retries with a fresh password", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    fixture.failNextMembershipSave();

    await expect(fixture.app.addUser({ actor, firstName: "Grace", lastName: "Hopper", email: "grace@example.test" })).rejects.toThrow("membership write failed");
    expect([...fixture.users.values()].some((user) => user.emailNormalized === "grace@example.test")).toBe(false);
    await expect(fixture.app.addUser({ actor, firstName: "Grace", lastName: "Hopper", email: "grace@example.test" })).resolves.toMatchObject({ kind: "created", temporaryPassword: "North-Harbor-4828" });
  });

  it("runs concurrent seeds atomically so one seeds and the other observes already seeded", async () => {
    const fixture = createFixture();
    const input = { organizationId: "org-concurrent", organizationName: "Sentinel", administrator: { id: "root", firstName: "Root", lastName: "Admin", email: "root@example.test", passwordHash: "hash" } };

    const results = await Promise.all([fixture.app.seed(input), fixture.app.seed(input)]);
    expect(results).toContainEqual({ kind: "seeded" });
    expect(results).toContainEqual({ kind: "already_seeded" });
    expect(fixture.memberships).toHaveLength(1);
  });


  it("rejects a reset when a concurrent membership attachment makes the identity shared", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const attachmentPromise = fixture.app.addUser({ actor: { ...actor, organizationId: "org-b" }, firstName: "Ignored", lastName: "Ignored", email: "ada@example.test" });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const [attachment, reset] = await Promise.all([attachmentPromise, fixture.app.resetPassword({ actor, userId: "user-1" })]);

    expect(attachment).toEqual({ kind: "membership_attached", userId: "user-1" });
    expect(reset).toEqual({ kind: "shared_identity_reset_forbidden" });
    expect(fixture.users.get("user-1")?.passwordChangeRequired).toBe(false);
  });

  it("rejects authorization for an inactive user even with an active session", async () => {
    const fixture = createFixture();
    await addUser(fixture, { status: "inactive" });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    fixture.sessions.push({ id: "session", tokenHash: "hashed-token", userId: "user-1", activeOrganizationId: "org-a", lastActivityAt: NOW, expiresAt: new Date(NOW.getTime() + 1), createdAt: NOW });

    await expect(fixture.app.authorize({ token: "token", requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
  });



  it("does not create a session when a reset wins after old credentials were verified", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    await fixture.app.resetPassword({ actor, userId: "user-1", temporaryPassword: "reset-password" });
    await expect(fixture.app.login({ email: "ada@example.test", password: "password-1" })).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.sessions).toHaveLength(0);
  });

  it("revokes a session created before a reset completes", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "authenticated") throw new Error("expected authentication");
    await fixture.app.resetPassword({ actor, userId: "user-1", temporaryPassword: "reset-password" });

    await expect(fixture.app.authorize({ token: login.token, requiredRole: "operator" })).resolves.toEqual({ kind: "forbidden" });
  });

  it("does not let a password change overwrite a reset that revoked its session", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { passwordChangeRequired: true });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "password_change_required") throw new Error("expected password change");

    await fixture.app.resetPassword({ actor, userId: "user-1", temporaryPassword: "reset-password" });
    await expect(fixture.app.changePassword({ token: login.token, password: "new-password" })).resolves.toEqual({ kind: "forbidden" });
    expect(fixture.users.get("user-1")?.passwordHash).toBe("reset-password");
  });

  it("lets a password change finish before a reset, then the reset wins and revokes every session", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { passwordChangeRequired: true });
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });
    const login = await fixture.app.login({ email: "ada@example.test", password: "password-1" });
    if (login.kind !== "password_change_required") throw new Error("expected password change");

    await expect(fixture.app.changePassword({ token: login.token, password: "new-password" })).resolves.toEqual({ kind: "changed" });
    await fixture.app.resetPassword({ actor, userId: "user-1", temporaryPassword: "reset-password" });
    expect(fixture.users.get("user-1")).toMatchObject({ passwordHash: "reset-password", passwordChangeRequired: true });
    expect(fixture.sessions.every((session) => session.revokedAt)).toBe(true);
  });

  it("rejects re-adding the last active administrator as an operator", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" });

    await expect(fixture.app.addUser({ actor, firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", role: "operator" })).resolves.toEqual({ kind: "last_admin" });
    expect(fixture.memberships[0]).toMatchObject({ role: "admin", status: "active" });
  });

  it("changes an existing active administrator role through the atomic guard when another admin remains", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    await addUser(fixture, { id: "admin-2", emailNormalized: "grace@example.test" });
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" }, { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" });

    await expect(fixture.app.addUser({ actor, firstName: "Grace", lastName: "Hopper", email: "grace@example.test", role: "operator" })).resolves.toEqual({ kind: "membership_attached", userId: "admin-2" });
    expect(fixture.memberships[1]).toMatchObject({ role: "operator", status: "active" });
  });

  it("preserves one admin when a demotion and deactivation race", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" }, { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" });

    await Promise.all([fixture.app.changeMembershipRole({ actor, userId: "admin-1", role: "operator" }), fixture.app.deactivateMembership({ actor, userId: "admin-2" })]);
    expect(fixture.memberships.filter((membership) => membership.role === "admin" && membership.status === "active")).toHaveLength(1);
  });

  it("rejects a login whose old password was verified before reset completes", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const pending = await startLoginAfterVerification(fixture);
    await expect(fixture.app.resetPassword({ actor, userId: "user-1", temporaryPassword: "reset-password" })).resolves.toEqual({ kind: "reset", temporaryPassword: "reset-password" });
    pending.release();

    await expect(pending.login).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.sessions).toHaveLength(0);
  });

  it("rejects a login when its verified password hash changes before its transaction", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const pending = await startLoginAfterVerification(fixture);
    const user = fixture.users.get("user-1")!;
    fixture.users.set(user.id, { ...user, passwordHash: "replacement-password" });
    pending.release();

    await expect(pending.login).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.sessions).toHaveLength(0);
  });

  it("rejects a login when its authorization version changes after verification", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const pending = await startLoginAfterVerification(fixture);
    const user = fixture.users.get("user-1")!;
    fixture.users.set(user.id, { ...user, authorizationVersion: user.authorizationVersion + 1 });
    pending.release();

    await expect(pending.login).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.sessions).toHaveLength(0);
  });

  it("rejects a login when the verified user is deactivated before its transaction", async () => {
    const fixture = createFixture();
    await addUser(fixture);
    fixture.memberships.push({ userId: "user-1", organizationId: "org-a", role: "operator", status: "active" });

    const pending = await startLoginAfterVerification(fixture);
    const user = fixture.users.get("user-1")!;
    fixture.users.set(user.id, { ...user, status: "inactive" });
    pending.release();

    await expect(pending.login).resolves.toEqual({ kind: "invalid_credentials" });
    expect(fixture.sessions).toHaveLength(0);
  });

  it("keeps exactly one active admin when addUser demotion races another admin deactivation", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    await addUser(fixture, { id: "admin-2", emailNormalized: "grace@example.test" });
    fixture.memberships.push(
      { userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" },
      { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" },
    );

    const [demotion, deactivation] = await Promise.all([
      fixture.app.addUser({ actor, firstName: "Ada", lastName: "Lovelace", email: "ada@example.test", role: "operator" }),
      fixture.app.deactivateMembership({ actor, userId: "admin-2" }),
    ]);

    expect([demotion.kind, deactivation.kind]).toContain("last_admin");
    expect([demotion.kind, deactivation.kind]).toContainEqual(expect.stringMatching(/^(membership_attached|deactivated)$/));
    expect(fixture.memberships.filter((membership) => membership.role === "admin" && membership.status === "active")).toHaveLength(1);
  });

  it("rejects reactivation of an active last administrator without a membership write", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    fixture.memberships.push({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" });
    const save = fixture.ports.memberships.save;
    let writes = 0;
    fixture.ports.memberships.save = async (membership) => { writes += 1; await save(membership); };

    await expect(fixture.app.reactivateMembership({ actor, userId: "admin-1", role: "operator" })).resolves.toEqual({ kind: "last_admin" });

    expect(writes).toBe(0);
    expect(fixture.memberships).toContainEqual({ userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" });
  });

  it("changes an active membership through the last-admin guard when another administrator remains", async () => {
    const fixture = createFixture();
    const actor = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
    await addUser(fixture, { id: "admin-1" });
    await addUser(fixture, { id: "admin-2", emailNormalized: "grace@example.test" });
    fixture.memberships.push(
      { userId: "admin-1", organizationId: "org-a", role: "admin", status: "active" },
      { userId: "admin-2", organizationId: "org-a", role: "admin", status: "active" },
    );

    await expect(fixture.app.reactivateMembership({ actor, userId: "admin-1", role: "operator" })).resolves.toEqual({ kind: "changed" });

    expect(fixture.memberships[0]).toMatchObject({ role: "operator", status: "active" });
  });

});


  it("reactivates a membership without changing the identity credentials", async () => {
    const fixture = createFixture();
    await addUser(fixture, { id: "user-1", passwordHash: "original-password", passwordChangeRequired: false });
    fixture.memberships.push({ organizationId: "org-a", userId: "user-1", role: "operator", status: "inactive" });

    await expect(fixture.app.reactivateMembership({ actor: { userId: "admin", organizationId: "org-a", role: "admin" }, userId: "user-1", role: "admin" })).resolves.toEqual({ kind: "reactivated" });

    expect(fixture.memberships.find((membership) => membership.userId === "user-1" && membership.organizationId === "org-a")).toEqual({ organizationId: "org-a", userId: "user-1", role: "admin", status: "active" });
    expect(fixture.users.get("user-1")).toMatchObject({ passwordHash: "original-password", passwordChangeRequired: false });
  });
