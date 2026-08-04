import type {
  IdentityRole,
  IdentitySession,
  IdentityUser,
  Organization,
  OrganizationMembership,
} from "@/domain/identity";

export type StoredSession = IdentitySession;

export type UserRepository = {
  findByEmail(emailNormalized: string): Promise<IdentityUser | undefined>;
  findById(id: string): Promise<IdentityUser | undefined>;
  save(user: IdentityUser): Promise<void>;
  registerFailedLogin(userId: string, now: Date): Promise<Pick<IdentityUser, "failureCount" | "blockedUntil"> | undefined>;
  touchAuthorizationVersion(userId: string): Promise<void>;
};

export type MembershipRepository = {
  findByUserId(userId: string): Promise<OrganizationMembership[]>;
  findByUserAndOrganization(userId: string, organizationId: string): Promise<OrganizationMembership | undefined>;
  listByOrganization(organizationId: string): Promise<OrganizationMembership[]>;
  save(membership: OrganizationMembership): Promise<void>;
  deactivateIfNotLastAdmin(input: { organizationId: string; userId: string }): Promise<"deactivated" | "last_admin" | "not_found">;
  changeRoleIfNotLastAdmin(input: { organizationId: string; userId: string; role: IdentityRole }): Promise<"changed" | "last_admin" | "not_found">;
};

export type OrganizationRepository = {
  findById(id: string): Promise<Organization | undefined>;
  save(organization: Organization): Promise<void>;
};

export type SessionRepository = {
  create(session: StoredSession): Promise<void>;
  touchActive(tokenHash: string, now: Date, expiresAt: Date): Promise<StoredSession | undefined>;
  save(session: StoredSession): Promise<void>;
  revokeByTokenHash(tokenHash: string): Promise<void>;
  revokeForUser(userId: string): Promise<void>;
  revokeForUserAndOrganization(userId: string, organizationId: string): Promise<void>;
};

export type TransactionRepositories = {
  users: UserRepository;
  memberships: MembershipRepository;
  organizations: OrganizationRepository;
  sessions: SessionRepository;
};

export type TransactionRunner = {
  run<T>(work: (repositories: TransactionRepositories) => Promise<T>): Promise<T>;
};

export type PasswordHasher = { verify(password: string, hash: string): Promise<boolean>; hash(password: string): Promise<string> };
export type TokenGenerator = { create(): Promise<string> };
export type TokenHasher = { hash(token: string): Promise<string> };
export type TemporaryPasswordGenerator = { create(): string };
export type IdGenerator = { create(): string };
export type Clock = { now(): Date };

export type IdentityApplicationPorts = TransactionRepositories & {
  passwords: PasswordHasher;
  dummyPasswordHash: string;
  tokens: TokenGenerator;
  tokenHasher: TokenHasher;
  temporaryPasswords: TemporaryPasswordGenerator;
  ids: IdGenerator;
  clock: Clock;
  transactions: TransactionRunner;
};

export type AuthorizationContext = { userId: string; organizationId: string; role: IdentityRole };
