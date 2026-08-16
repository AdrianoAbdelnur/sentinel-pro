import { describe, expect, it } from "vitest";

import {
  canChangeMembership,
  chooseActiveOrganization,
  isPasswordValid,
  isPlatformSuperAdmin,
  normalizeEmail,
  registerFailedLogin,
  requireActiveMembership,
} from "./index";

const NOW = new Date("2026-08-04T12:00:00.000Z");

describe("identity domain rules", () => {
  it("recognizes only the explicit platform SUPER ADMIN role", () => {
    expect(isPlatformSuperAdmin({ platformRole: "super-admin" })).toBe(true);
    expect(isPlatformSuperAdmin({ platformRole: undefined })).toBe(false);
  });

  it("normalizes email and accepts permanent passwords with at least eight characters without composition rules", () => {
    expect(normalizeEmail("  Ada@Example.TEST ")).toBe("ada@example.test");
    expect(isPasswordValid("abcdefgh")).toBe(true);
    expect(isPasswordValid("abcd1234")).toBe(true);
  });

  it("rejects malformed email and passwords shorter than eight characters", () => {
    expect(normalizeEmail("not-an-email")).toBeUndefined();
    expect(isPasswordValid("short7!")).toBe(false);
  });

  it("blocks a user for fifteen minutes after the third consecutive failed login", () => {
    const result = registerFailedLogin({ failureCount: 2 }, NOW);

    expect(result).toEqual({
      failureCount: 3,
      blockedUntil: new Date("2026-08-04T12:15:00.000Z"),
    });
  });

  it("keeps fewer than three failures unblocked and recognizes a current block", () => {
    expect(registerFailedLogin({ failureCount: 1 }, NOW)).toEqual({ failureCount: 2 });
    expect(registerFailedLogin({ failureCount: 3, blockedUntil: new Date("2026-08-04T12:01:00.000Z") }, NOW))
      .toEqual({ failureCount: 3, blockedUntil: new Date("2026-08-04T12:01:00.000Z") });
  });

  it("selects the sole active organization and requires an explicit choice for several memberships", () => {
    expect(chooseActiveOrganization([{ organizationId: "org-a", userId: "user-1", role: "operator", status: "active" }]))
      .toEqual({ kind: "selected", organizationId: "org-a" });
    expect(chooseActiveOrganization([
      { organizationId: "org-a", userId: "user-1", role: "operator", status: "active" },
      { organizationId: "org-b", userId: "user-1", role: "admin", status: "active" },
    ])).toEqual({ kind: "selection-required" });
  });

  it("only resolves an active membership and keeps roles tenant scoped", () => {
    const memberships = [
      { organizationId: "org-a", userId: "user-1", role: "operator" as const, status: "active" as const },
      { organizationId: "org-b", userId: "user-1", role: "admin" as const, status: "inactive" as const },
    ];

    expect(requireActiveMembership(memberships, "org-a")).toMatchObject({ role: "operator" });
    expect(requireActiveMembership(memberships, "org-b")).toBeUndefined();
  });

  it("rejects deactivating or demoting the last active administrator", () => {
    const memberships = [{ organizationId: "org-a", userId: "user-1", role: "admin" as const, status: "active" as const }];

    expect(canChangeMembership({ memberships, targetUserId: "user-1", nextRole: "operator" })).toBe(false);
    expect(canChangeMembership({ memberships, targetUserId: "user-1", nextStatus: "inactive" })).toBe(false);
  });

  it("permits changing an administrator when another active administrator remains", () => {
    const memberships = [
      { organizationId: "org-a", userId: "user-1", role: "admin" as const, status: "active" as const },
      { organizationId: "org-a", userId: "user-2", role: "admin" as const, status: "active" as const },
    ];

    expect(canChangeMembership({ memberships, targetUserId: "user-1", nextStatus: "inactive" })).toBe(true);
  });
});
