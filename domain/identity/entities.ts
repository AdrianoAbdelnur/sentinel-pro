export type IdentityRole = "admin" | "operator";
export type PlatformRole = "super-admin";
export type MembershipStatus = "active" | "inactive";
export type UserStatus = "active" | "inactive";

export type IdentityUser = {
  id: string;
  firstName: string;
  lastName: string;
  emailNormalized: string;
  passwordHash: string;
  passwordChangeRequired: boolean;
  status: UserStatus;
  failureCount: number;
  blockedUntil?: Date;
  createdAt: Date;
  updatedAt: Date;
  authorizationVersion: number;
  platformRole?: PlatformRole;
};

export type Organization = {
  id: string;
  name: string;
  status: "active" | "inactive";
};

export type OrganizationMembership = {
  organizationId: string;
  userId: string;
  role: IdentityRole;
  status: MembershipStatus;
};

export type IdentitySession = {
  id: string;
  tokenHash: string;
  userId: string;
  activeOrganizationId?: string;
  lastActivityAt: Date;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
};
