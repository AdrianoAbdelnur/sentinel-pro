import type { ObjectId } from "mongodb";
import type { IdentitySession, IdentityUser, Organization, OrganizationMembership } from "@/domain/identity";

export type UserDocument = {
  _id?: ObjectId; schemaVersion: number; id: string; firstName: string; lastName: string; emailNormalized: string; passwordHash: string; passwordChangeRequired: boolean; status: "active" | "inactive"; failureCount: number; failureWindowStartedAt?: Date; blockedUntil?: Date; authorizationVersion: number; createdAt: Date; updatedAt: Date;
};
export type OrganizationDocument = { _id?: ObjectId; schemaVersion: number; id: string; name: string; seedKey: string; status: "active" | "inactive"; authorizationVersion: number; createdAt: Date; updatedAt: Date };
export type MembershipDocument = { _id?: ObjectId; schemaVersion: number; organizationId: string; userId: string; role: "admin" | "operator"; status: "active" | "inactive"; createdAt: Date; updatedAt: Date };
export type SessionDocument = { _id?: ObjectId; schemaVersion: number; id: string; tokenHash: string; userId: string; activeOrganizationId?: string; lastActivityAt: Date; expiresAt: Date; revokedAt?: Date; createdAt: Date };

export function toUserDomain({ id, firstName, lastName, emailNormalized, passwordHash, passwordChangeRequired, status, failureCount, blockedUntil, authorizationVersion, createdAt, updatedAt }: UserDocument): IdentityUser { return { id, firstName, lastName, emailNormalized, passwordHash, passwordChangeRequired, status, failureCount, ...(blockedUntil ? { blockedUntil } : {}), authorizationVersion, createdAt, updatedAt }; }
export function toUserDocument({ blockedUntil, ...user }: IdentityUser): UserDocument { return { schemaVersion: 1, ...user, ...(blockedUntil ? { blockedUntil } : {}) }; }
export function toOrganizationDomain({ id, name, status }: OrganizationDocument): Organization { return { id, name, status }; }
export function toOrganizationDocument(organization: Organization, now: Date, existing?: OrganizationDocument): OrganizationDocument { return { schemaVersion: 1, id: organization.id, name: organization.name, seedKey: existing?.seedKey ?? organization.id, status: organization.status, authorizationVersion: existing?.authorizationVersion ?? 0, createdAt: existing?.createdAt ?? now, updatedAt: now }; }
export function toMembershipDomain({ organizationId, userId, role, status }: MembershipDocument): OrganizationMembership { return { organizationId, userId, role, status }; }
export function toMembershipDocument(membership: OrganizationMembership, now: Date, existing?: MembershipDocument): MembershipDocument { return { schemaVersion: 1, ...membership, createdAt: existing?.createdAt ?? now, updatedAt: now }; }
export function toSessionDomain({ id, tokenHash, userId, activeOrganizationId, lastActivityAt, expiresAt, revokedAt, createdAt }: SessionDocument): IdentitySession { return { id, tokenHash, userId, ...(activeOrganizationId ? { activeOrganizationId } : {}), lastActivityAt, expiresAt, ...(revokedAt ? { revokedAt } : {}), createdAt }; }
export function toSessionDocument({ activeOrganizationId, revokedAt, ...session }: IdentitySession): SessionDocument { return { schemaVersion: 1, ...session, ...(activeOrganizationId ? { activeOrganizationId } : {}), ...(revokedAt ? { revokedAt } : {}) }; }
