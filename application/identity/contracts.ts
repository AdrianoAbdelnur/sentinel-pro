import type { IdentityRole, PlatformRole } from "@/domain/identity";

import type { AuthorizationContext } from "./ports";

export type LoginResult =
  | { kind: "invalid_credentials" }
  | { kind: "temporarily_blocked" }
  | { kind: "password_change_required"; token: string }
  | { kind: "tenant_selection_required"; token: string }
  | { kind: "no_active_membership"; token: string }
  | { kind: "authenticated"; token: string; organizationId: string; role: IdentityRole };

export type AuthorizationResult =
  | { kind: "authorized"; context: AuthorizationContext }
  | { kind: "forbidden" };

export type PlatformAuthorizationContext = { userId: string; platformRole: PlatformRole };
export type PlatformAuthorizationResult =
  | { kind: "authorized"; context: PlatformAuthorizationContext }
  | { kind: "forbidden" };

export type PasswordResetResult =
  | { kind: "reset"; temporaryPassword: string }
  | { kind: "shared_identity_reset_forbidden" }
  | { kind: "forbidden" };

export type MembershipResult =
  | { kind: "deactivated" }
  | { kind: "changed" }
  | { kind: "reactivated" }
  | { kind: "last_admin" }
  | { kind: "forbidden" };
