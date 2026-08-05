import {
  chooseActiveOrganization,
  isPasswordValid,
  normalizeEmail,
  SESSION_INACTIVITY_DURATION_MS,
  type IdentityUser,
} from "@/domain/identity";

import type { AuthorizationResult, LoginResult, MembershipResult, PasswordResetResult } from "./contracts";
import type { AuthorizationContext, IdentityApplicationPorts, StoredSession } from "./ports";
import type { IdentityRole } from "@/domain/identity";

export function createIdentityApplication(ports: IdentityApplicationPorts) {
  async function createSession(repositories: Pick<IdentityApplicationPorts, "sessions">, userId: string, activeOrganizationId?: string): Promise<{ session: StoredSession; token: string }> {
    const now = ports.clock.now();
    const token = await ports.tokens.create();
    const session: StoredSession = {
      id: ports.ids.create(),
      tokenHash: await ports.tokenHasher.hash(token),
      userId,
      activeOrganizationId,
      lastActivityAt: now,
      expiresAt: new Date(now.getTime() + SESSION_INACTIVITY_DURATION_MS),
      createdAt: now,
    };
    await repositories.sessions.create(session);
    return { session, token };
  }

  async function login({ email, password }: { email: string; password: string }): Promise<LoginResult> {
    const emailNormalized = normalizeEmail(email);
    const verifiedUser = emailNormalized ? await ports.users.findByEmail(emailNormalized) : undefined;
    const isCorrect = await ports.passwords.verify(password, verifiedUser?.passwordHash ?? ports.dummyPasswordHash);
    const now = ports.clock.now();
    if (!verifiedUser || !isCorrect || verifiedUser.status !== "active") {
      if (verifiedUser && verifiedUser.status === "active") await ports.users.registerFailedLogin(verifiedUser.id, now);
      return { kind: "invalid_credentials" };
    }
    if (verifiedUser.blockedUntil && verifiedUser.blockedUntil > now) return { kind: "temporarily_blocked" };

    return ports.transactions.run(async ({ users, memberships, sessions }) => {
      const user = await users.findById(verifiedUser.id);
      if (!user || user.status !== "active" || user.passwordHash !== verifiedUser.passwordHash || user.authorizationVersion !== verifiedUser.authorizationVersion) return { kind: "invalid_credentials" };
      if (user.blockedUntil && user.blockedUntil > now) return { kind: "temporarily_blocked" };
      if (!await users.compareAndTouchAuthorizationVersion(user.id, user.authorizationVersion, now)) return { kind: "invalid_credentials" };
      if (user.failureCount !== 0 || user.blockedUntil) await users.save({ ...user, failureCount: 0, blockedUntil: undefined, authorizationVersion: user.authorizationVersion + 1, updatedAt: now });
      const { session, token } = await createSession({ sessions }, user.id);
      if (user.passwordChangeRequired) return { kind: "password_change_required", token };
      const selection = chooseActiveOrganization(await memberships.findByUserId(user.id));
      if (selection.kind === "selected") {
        const membership = await memberships.findByUserAndOrganization(user.id, selection.organizationId);
        session.activeOrganizationId = selection.organizationId;
        await sessions.save(session);
        return { kind: "authenticated", token, organizationId: selection.organizationId, role: membership!.role };
      }
      return selection.kind === "none" ? { kind: "no_active_membership", token } : { kind: "tenant_selection_required", token };
    });
  }

  async function changePassword({ token, password }: { token: string; password: string }) {
    if (!isPasswordValid(password)) return { kind: "invalid_password" as const };
    const tokenHash = await ports.tokenHasher.hash(token);
    const passwordHash = await ports.passwords.hash(password);
    return ports.transactions.run(async ({ users, sessions }) => {
      const now = ports.clock.now();
      const session = await sessions.touchActive(tokenHash, now, new Date(now.getTime() + SESSION_INACTIVITY_DURATION_MS));
      if (!session) return { kind: "forbidden" as const };
      const user = await users.findById(session.userId);
      if (!user || user.status !== "active") return { kind: "forbidden" as const };
      if (!await users.compareAndTouchAuthorizationVersion(user.id, user.authorizationVersion, now)) return { kind: "forbidden" as const };
      await users.save({ ...user, passwordHash, passwordChangeRequired: false, failureCount: 0, blockedUntil: undefined, authorizationVersion: user.authorizationVersion + 1, updatedAt: now });
      await sessions.revokeForUser(session.userId);
      return { kind: "changed" as const };
    });
  }

  async function selectOrganization({ token, organizationId }: { token: string; organizationId: string }) {
    const session = await touchSession(token);
    if (!session || !await canUseTenant(session)) return { kind: "forbidden" as const };
    const membership = await ports.memberships.findByUserAndOrganization(session.userId, organizationId);
    if (!membership || membership.status !== "active") return { kind: "forbidden" as const };
    session.activeOrganizationId = organizationId;
    await ports.sessions.save(session);
    return { kind: "selected" as const, organizationId, role: membership.role };
  }

  async function touchSession(token: string): Promise<StoredSession | undefined> {
    const now = ports.clock.now();
    const tokenHash = await ports.tokenHasher.hash(token);
    return ports.sessions.touchActive(tokenHash, now, new Date(now.getTime() + SESSION_INACTIVITY_DURATION_MS));
  }

  async function canUseTenant(session: StoredSession): Promise<boolean> {
    const user = await ports.users.findById(session.userId);
    return Boolean(user && user.status === "active" && !user.passwordChangeRequired);
  }

  async function authorize({ token, requiredRole }: { token: string; requiredRole: IdentityRole }): Promise<AuthorizationResult> {
    const session = await touchSession(token);
    if (!session || !session.activeOrganizationId || !await canUseTenant(session)) return { kind: "forbidden" };
    const membership = await ports.memberships.findByUserAndOrganization(session.userId, session.activeOrganizationId);
    if (!membership || membership.status !== "active" || (requiredRole === "admin" && membership.role !== "admin")) return { kind: "forbidden" };
    return { kind: "authorized", context: { userId: session.userId, organizationId: session.activeOrganizationId, role: membership.role } };
  }

  async function addUser(input: { actor: AuthorizationContext; firstName: string; lastName: string; email: string; role?: IdentityRole; temporaryPassword?: string }) {
    if (input.actor.role !== "admin") return { kind: "forbidden" as const };
    const emailNormalized = normalizeEmail(input.email);
    if (!emailNormalized) return { kind: "invalid_email" as const };
    const role = input.role ?? "operator";
    const existing = await ports.users.findByEmail(emailNormalized);
    if (existing) {
      const result = await ports.transactions.run(async ({ users, memberships }) => {
        await users.touchAuthorizationVersion(existing.id);
        const membership = await memberships.findByUserAndOrganization(existing.id, input.actor.organizationId);
        if (membership?.status === "active" && membership.role !== role) {
          return memberships.changeRoleIfNotLastAdmin({ organizationId: input.actor.organizationId, userId: existing.id, role });
        }
        await memberships.save({ organizationId: input.actor.organizationId, userId: existing.id, role, status: "active" });
        return "changed" as const;
      });
      if (result === "last_admin") return { kind: "last_admin" as const };
      return { kind: "membership_attached" as const, userId: existing.id };
    }
    const temporaryPassword = input.temporaryPassword ?? ports.temporaryPasswords.create();
    const now = ports.clock.now();
    const user: IdentityUser = { id: ports.ids.create(), firstName: input.firstName, lastName: input.lastName, emailNormalized, passwordHash: await ports.passwords.hash(temporaryPassword), passwordChangeRequired: true, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now };
    await ports.transactions.run(async ({ users, memberships }) => {
      await users.save(user);
      await memberships.save({ organizationId: input.actor.organizationId, userId: user.id, role, status: "active" });
    });
    return { kind: "created" as const, userId: user.id, temporaryPassword };
  }


  async function logout({ token }: { token: string }) {
    await ports.sessions.revokeByTokenHash(await ports.tokenHasher.hash(token));
    return { kind: "logged_out" as const };
  }

  async function resetPassword({ actor, userId, temporaryPassword }: { actor: AuthorizationContext; userId: string; temporaryPassword?: string }): Promise<PasswordResetResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    return ports.transactions.run(async ({ users, memberships, sessions }) => {
      const membershipsForUser = await memberships.findByUserId(userId);
      if (membershipsForUser.length !== 1 || membershipsForUser[0].organizationId !== actor.organizationId) return { kind: "shared_identity_reset_forbidden" };
      const user = await users.findById(userId);
      if (!user) return { kind: "forbidden" };
      const nextTemporaryPassword = temporaryPassword ?? ports.temporaryPasswords.create();
      const now = ports.clock.now();
      if (!await users.compareAndTouchAuthorizationVersion(user.id, user.authorizationVersion, now)) return { kind: "forbidden" };
      await users.save({ ...user, passwordHash: await ports.passwords.hash(nextTemporaryPassword), passwordChangeRequired: true, failureCount: 0, blockedUntil: undefined, authorizationVersion: user.authorizationVersion + 1, updatedAt: now });
      await sessions.revokeForUser(userId);
      return { kind: "reset", temporaryPassword: nextTemporaryPassword };
    });
  }

  async function changeMembershipRole({ actor, userId, role }: { actor: AuthorizationContext; userId: string; role: IdentityRole }): Promise<MembershipResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const result = await ports.transactions.run(async ({ users, memberships, sessions }) => {
      const user = await users.findById(userId);
      if (user && !await users.compareAndTouchAuthorizationVersion(userId, user.authorizationVersion, ports.clock.now())) return "not_found" as const;
      const changed = await memberships.changeRoleIfNotLastAdmin({ organizationId: actor.organizationId, userId, role });
      if (changed === "changed") await sessions.revokeForUserAndOrganization(userId, actor.organizationId);
      return changed;
    });
    if (result === "last_admin") return { kind: "last_admin" };
    if (result === "not_found") return { kind: "forbidden" };
    return { kind: "changed" };
  }

  async function reactivateMembership({ actor, userId, role }: { actor: AuthorizationContext; userId: string; role: IdentityRole }): Promise<MembershipResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const result = await ports.transactions.run(async ({ users, memberships, sessions }) => {
      const user = await users.findById(userId);
      const membership = await memberships.findByUserAndOrganization(userId, actor.organizationId);
      if (!user || !membership) return "not_found" as const;
      if (membership.status === "inactive") {
        await memberships.save({ ...membership, role, status: "active" });
        return "reactivated" as const;
      }
      if (!await users.compareAndTouchAuthorizationVersion(userId, user.authorizationVersion, ports.clock.now())) return "not_found" as const;
      const changed = await memberships.changeRoleIfNotLastAdmin({ organizationId: actor.organizationId, userId, role });
      if (changed === "changed") await sessions.revokeForUserAndOrganization(userId, actor.organizationId);
      return changed;
    });
    if (result === "last_admin") return { kind: "last_admin" };
    if (result === "not_found") return { kind: "forbidden" };
    return { kind: result };
  }

  async function deactivateMembership({ actor, userId }: { actor: AuthorizationContext; userId: string }): Promise<MembershipResult> {
    if (actor.role !== "admin") return { kind: "forbidden" };
    const result = await ports.transactions.run(async ({ users, memberships, sessions }) => {
      const user = await users.findById(userId);
      if (user && !await users.compareAndTouchAuthorizationVersion(userId, user.authorizationVersion, ports.clock.now())) return "not_found" as const;
      const changed = await memberships.deactivateIfNotLastAdmin({ organizationId: actor.organizationId, userId });
      if (changed === "deactivated") await sessions.revokeForUserAndOrganization(userId, actor.organizationId);
      return changed;
    });
    if (result === "last_admin") return { kind: "last_admin" };
    if (result === "not_found") return { kind: "forbidden" };
    return { kind: "deactivated" };
  }

  async function seed(input: { organizationId: string; organizationName: string; administrator: { id: string; firstName: string; lastName: string; email: string; passwordHash: string } }) {
    return ports.transactions.run(async ({ organizations, users, memberships }) => {
      if (await organizations.findById(input.organizationId)) return { kind: "already_seeded" as const };
      const now = ports.clock.now();
      const emailNormalized = normalizeEmail(input.administrator.email)!;
      await organizations.save({ id: input.organizationId, name: input.organizationName, status: "active" });
      await users.save({ id: input.administrator.id, firstName: input.administrator.firstName, lastName: input.administrator.lastName, emailNormalized, passwordHash: input.administrator.passwordHash, passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now });
      await memberships.save({ organizationId: input.organizationId, userId: input.administrator.id, role: "admin", status: "active" });
      return { kind: "seeded" as const };
    });
  }

  return { login, logout, changePassword, selectOrganization, authorize, addUser, resetPassword, changeMembershipRole, reactivateMembership, deactivateMembership, seed };
}
