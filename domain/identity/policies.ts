import type { IdentityUser, OrganizationMembership } from "./entities";

export const MINIMUM_PASSWORD_LENGTH = 8;
export const MAXIMUM_LOGIN_FAILURES = 3;
export const LOGIN_BLOCK_DURATION_MS = 15 * 60 * 1000;
export const SESSION_INACTIVITY_DURATION_MS = 12 * 60 * 60 * 1000;

export function isPlatformSuperAdmin(user: Pick<IdentityUser, "platformRole">): boolean {
  return user.platformRole === "super-admin";
}

export function normalizeEmail(email: string): string | undefined {
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : undefined;
}

export function isPasswordValid(password: string): boolean {
  return password.length >= MINIMUM_PASSWORD_LENGTH;
}

export type LoginFailureState = {
  failureCount: number;
  blockedUntil?: Date;
};

export function registerFailedLogin(state: LoginFailureState, now: Date): LoginFailureState {
  if (state.blockedUntil && state.blockedUntil > now) {
    return state;
  }

  const failureCount = state.failureCount + 1;
  return failureCount >= MAXIMUM_LOGIN_FAILURES
    ? { failureCount, blockedUntil: new Date(now.getTime() + LOGIN_BLOCK_DURATION_MS) }
    : { failureCount };
}

export type ActiveOrganizationSelection =
  | { kind: "selected"; organizationId: string }
  | { kind: "selection-required" }
  | { kind: "none" };

export function chooseActiveOrganization(
  memberships: OrganizationMembership[],
): ActiveOrganizationSelection {
  const active = memberships.filter((membership) => membership.status === "active");
  if (active.length === 1) {
    return { kind: "selected", organizationId: active[0].organizationId };
  }
  return active.length > 1 ? { kind: "selection-required" } : { kind: "none" };
}

export function requireActiveMembership(
  memberships: OrganizationMembership[],
  organizationId: string,
): OrganizationMembership | undefined {
  return memberships.find(
    (membership) => membership.organizationId === organizationId && membership.status === "active",
  );
}

export type ChangeMembershipInput = {
  memberships: OrganizationMembership[];
  targetUserId: string;
  nextRole?: OrganizationMembership["role"];
  nextStatus?: OrganizationMembership["status"];
};

export function canChangeMembership({
  memberships,
  targetUserId,
  nextRole,
  nextStatus,
}: ChangeMembershipInput): boolean {
  const target = memberships.find((membership) => membership.userId === targetUserId);
  if (!target || target.role !== "admin" || target.status !== "active") {
    return Boolean(target);
  }
  if (nextRole !== "operator" && nextStatus !== "inactive") {
    return true;
  }
  return memberships.some(
    (membership) => membership.userId !== targetUserId && membership.role === "admin" && membership.status === "active",
  );
}
