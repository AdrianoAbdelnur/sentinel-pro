import type { ClientSession, Collection, Db, MongoClient } from "mongodb";
import type { TransactionRepositories } from "@/application/identity";
import type { OrganizationMembership } from "@/domain/identity";
import { toMembershipDocument, toMembershipDomain, toOrganizationDocument, toOrganizationDomain, toSessionDocument, toSessionDomain, toUserDocument, toUserDomain, type MembershipDocument, type OrganizationDocument, type SessionDocument, type UserDocument } from "./documents";

const options = (session?: ClientSession) => session ? { session } : {};
const now = () => new Date();
const lockoutMilliseconds = 15 * 60 * 1000;

type MembershipChange = { organizationId: string; userId: string };

export function createMongoIdentityRepositories(db: Db, client: MongoClient, session?: ClientSession): TransactionRepositories {
  const users = db.collection<UserDocument>("users");
  const organizations = db.collection<OrganizationDocument>("organizations");
  const memberships = db.collection<MembershipDocument>("organization_memberships");
  const sessions = db.collection<SessionDocument>("sessions");
  return {
    users: {
      async findByEmail(emailNormalized) { const document = await users.findOne({ emailNormalized }, options(session)); return document ? toUserDomain(document) : undefined; },
      async findById(id) { const document = await users.findOne({ id }, options(session)); return document ? toUserDomain(document) : undefined; },
      async save(user) {
        const document = toUserDocument(user);
        const existing = await users.findOne({ id: user.id }, options(session));
        await users.replaceOne({ id: user.id }, { ...document, createdAt: existing?.createdAt ?? document.createdAt }, { upsert: true, ...options(session) });
      },
      async compareAndTouchAuthorizationVersion(id, expectedAuthorizationVersion, at) {
        const result = await users.updateOne({ id, authorizationVersion: expectedAuthorizationVersion }, { $inc: { authorizationVersion: 1 }, $set: { updatedAt: at } }, options(session));
        return result.modifiedCount === 1;
      },
      async registerFailedLogin(id, at) {
        const windowStart = new Date(at.getTime() - lockoutMilliseconds);
        const document = await users.findOneAndUpdate({ id }, [
          { $set: { isBlocked: { $gt: ["$blockedUntil", { $literal: at }] }, startsNewWindow: { $or: [{ $eq: [{ $ifNull: ["$failureWindowStartedAt", null] }, null] }, { $lte: ["$failureWindowStartedAt", { $literal: windowStart }] }] } } },
          { $set: { failureWindowStartedAt: { $cond: ["$isBlocked", "$failureWindowStartedAt", { $cond: ["$startsNewWindow", { $literal: at }, "$failureWindowStartedAt"] }] }, failureCount: { $cond: ["$isBlocked", "$failureCount", { $cond: ["$startsNewWindow", 1, { $add: ["$failureCount", 1] }] }] }, blockedUntil: { $cond: ["$isBlocked", "$blockedUntil", { $cond: [{ $gte: [{ $cond: ["$startsNewWindow", 1, { $add: ["$failureCount", 1] }] }, 3] }, { $dateAdd: { startDate: { $literal: at }, unit: "millisecond", amount: lockoutMilliseconds } }, "$$REMOVE"] }] }, updatedAt: { $literal: at } } },
          { $unset: ["isBlocked", "startsNewWindow"] },
        ], { returnDocument: "after", ...options(session) });
        return document ? { failureCount: document.failureCount, ...(document.blockedUntil ? { blockedUntil: document.blockedUntil } : {}) } : undefined;
      },
      async touchAuthorizationVersion(id) { await users.updateOne({ id }, { $inc: { authorizationVersion: 1 }, $set: { updatedAt: now() } }, options(session)); },
    },
    organizations: {
      async findById(id) { const document = await organizations.findOne({ id }, options(session)); return document ? toOrganizationDomain(document) : undefined; },
      async save(organization) { const existing = await organizations.findOne({ id: organization.id }, options(session)); await organizations.replaceOne({ id: organization.id }, toOrganizationDocument(organization, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
    },
    memberships: {
      async findByUserId(userId) { return (await memberships.find({ userId }, options(session)).toArray()).map(toMembershipDomain); },
      async findByUserAndOrganization(userId, organizationId) { const document = await memberships.findOne({ userId, organizationId }, options(session)); return document ? toMembershipDomain(document) : undefined; },
      async listByOrganization(organizationId) { return (await memberships.find({ organizationId }, options(session)).toArray()).map(toMembershipDomain); },
      async save(membership) { const existing = await memberships.findOne({ organizationId: membership.organizationId, userId: membership.userId }, options(session)); await memberships.replaceOne({ organizationId: membership.organizationId, userId: membership.userId }, toMembershipDocument(membership, now(), existing ?? undefined), { upsert: true, ...options(session) }); },
      async deactivateIfNotLastAdmin(input) { const result = await atomicMembershipChange(db, client, session, input, undefined, "inactive"); return result === "changed" ? "deactivated" : result; },
      async changeRoleIfNotLastAdmin(input) { const result = await atomicMembershipChange(db, client, session, input, input.role, undefined); return result; },
    },
    sessions: {
      async create(value) { await sessions.insertOne(toSessionDocument(value), options(session)); },
      async save(value) { await sessions.replaceOne({ id: value.id }, toSessionDocument(value), { upsert: true, ...options(session) }); },
      async touchActive(tokenHash, at, expiresAt) { const document = await sessions.findOneAndUpdate({ tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: at } }, { $set: { lastActivityAt: at, expiresAt } }, { returnDocument: "after", ...options(session) }); return document ? toSessionDomain(document) : undefined; },
      async revokeByTokenHash(tokenHash) { await sessions.updateOne({ tokenHash }, { $set: { revokedAt: now() } }, options(session)); },
      async revokeForUser(userId) { await sessions.updateMany({ userId, revokedAt: { $exists: false } }, { $set: { revokedAt: now() } }, options(session)); },
      async revokeForUserAndOrganization(userId, organizationId) { await sessions.updateMany({ userId, activeOrganizationId: organizationId, revokedAt: { $exists: false } }, { $set: { revokedAt: now() } }, options(session)); },
    },
  };
}

async function atomicMembershipChange(db: Db, client: MongoClient, existingSession: ClientSession | undefined, input: MembershipChange, role: OrganizationMembership["role"] | undefined, status: OrganizationMembership["status"] | undefined): Promise<"not_found" | "last_admin" | "changed"> {
  if (existingSession) return changeMembership(db, existingSession, input, role, status);
  const ownSession = client.startSession();
  try { let result: "not_found" | "last_admin" | "changed" = "not_found"; await ownSession.withTransaction(async () => { result = await changeMembership(db, ownSession, input, role, status); }); return result; } finally { await ownSession.endSession(); }
}

async function changeMembership(db: Db, session: ClientSession, input: MembershipChange, role: OrganizationMembership["role"] | undefined, status: OrganizationMembership["status"] | undefined): Promise<"not_found" | "last_admin" | "changed"> {
  const memberships: Collection<MembershipDocument> = db.collection("organization_memberships");
  const membershipKey: MembershipChange = { organizationId: input.organizationId, userId: input.userId };
  await db.collection<OrganizationDocument>("organizations").updateOne({ id: membershipKey.organizationId }, { $inc: { authorizationVersion: 1 }, $set: { updatedAt: now() } }, { session });
  const target = await memberships.findOne(membershipKey, { session });
  if (!target) return "not_found";
  if (target.status === "active" && target.role === "admin" && (status === "inactive" || role === "operator")) {
    if (await memberships.countDocuments({ organizationId: input.organizationId, status: "active", role: "admin" }, { session }) <= 1) return "last_admin";
  }
  await memberships.updateOne(membershipKey, { $set: { ...(role ? { role } : {}), ...(status ? { status } : {}), updatedAt: now() } }, { session });
  return "changed";
}
