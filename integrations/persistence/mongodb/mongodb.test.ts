import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import { createMongoIdentityRepositories, identityIndexes, MongoTransactionRunner, migrateIdentityDatabase } from "./index";
import { createIdentityApplication } from "@/application/identity";

const execFileAsync = promisify(execFile);

let replSet: MongoMemoryReplSet; let client: MongoClient;
beforeAll(async () => { replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } }); client = new MongoClient(replSet.getUri()); await client.connect(); }, 60_000);
afterAll(async () => { await client?.close(); await replSet?.stop(); });
describe("Mongo identity persistence", () => {
  it("backfills the platform role for the existing initial administrator", async () => {
    const db = client.db(`identity_${Date.now()}`);
    await migrateIdentityDatabase(db);
    const now = new Date();
    await db.collection("users").insertOne({ schemaVersion: 1, id: "initial-admin", firstName: "Initial", lastName: "Admin", emailNormalized: "initial@test.dev", passwordHash: "hash", passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now });

    await migrateIdentityDatabase(db);

    await expect(db.collection("users").findOne({ id: "initial-admin" })).resolves.toMatchObject({ platformRole: "super-admin" });
  });

  it("creates strict validators and all required indexes idempotently", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); await migrateIdentityDatabase(db);
    const users = await db.collection("users").indexes(); const organizations = await db.collection("organizations").indexes(); const memberships = await db.collection("organization_memberships").indexes(); const sessions = await db.collection("sessions").indexes();
    expect(users.find((index) => index.name === "users_email_normalized_unique")?.unique).toBe(true);
    expect(organizations.map((index) => index.name)).toEqual(expect.arrayContaining(["organizations_seed_key_unique", "organizations_authorization_version"]));
    expect(memberships.map((index) => index.name)).toEqual(expect.arrayContaining(["memberships_organization_user_unique", "memberships_user_lookup", "memberships_organization_status_role_lookup"]));
    expect(sessions.map((index) => index.name)).toEqual(expect.arrayContaining(["sessions_token_hash_unique", "sessions_expiry_ttl", "sessions_user_tenant_revocation_lookup"]));
    expect(sessions.find((index) => index.name === "sessions_expiry_ttl")?.expireAfterSeconds).toBe(0);
    await expect(db.collection("sessions").insertOne({ schemaVersion: 1, id: "raw", tokenHash: "h", token: "forbidden", userId: "u", lastActivityAt: new Date(), expiresAt: new Date(), createdAt: new Date() })).rejects.toThrow();
    await expect(db.collection("users").insertOne({ emailNormalized: "bad" })).rejects.toThrow();
    await expect(db.collection("users").insertOne({ schemaVersion: 1, id: "raw-user", firstName: "Raw", lastName: "User", emailNormalized: "raw@example.test", passwordHash: "hash", passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: new Date(), updatedAt: new Date(), unexpected: true })).rejects.toThrow();
    await expect(db.collection("organization_memberships").insertOne({ schemaVersion: 1, organizationId: "org", userId: "u", role: "owner", status: "active", createdAt: new Date(), updatedAt: new Date() })).rejects.toThrow();
    for (const [name, indexes] of Object.entries(identityIndexes)) {
      const actual = await db.collection(name).indexes();
      for (const { key, options } of indexes) expect(actual).toContainEqual(expect.objectContaining({ key, ...options }));
    }
  });
  it("enforces uniqueness and only touches active unrevoked sessions", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({id:"u",firstName:"A",lastName:"B",emailNormalized:"a@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now});
    await expect(repos.users.save({id:"u2",firstName:"A",lastName:"B",emailNormalized:"a@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now})).rejects.toThrow();
    await repos.sessions.create({id:"s",tokenHash:"hash",userId:"u",lastActivityAt:now,expiresAt:new Date(now.getTime()+1_000),createdAt:now});
    expect((await repos.sessions.touchActive("hash",now,new Date(now.getTime()+1000)))?.id).toBe("s"); await repos.sessions.revokeByTokenHash("hash");
    await expect(repos.sessions.touchActive("hash",now,new Date(now.getTime()+1000))).resolves.toBeUndefined();
  });
  it("touches a session only before expiry and scopes revocation to its tenant", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.sessions.create({ id: "a", tokenHash: "a", userId: "u", activeOrganizationId: "org-a", lastActivityAt: now, expiresAt: new Date(now.getTime() + 1), createdAt: now });
    await repos.sessions.create({ id: "b", tokenHash: "b", userId: "u", activeOrganizationId: "org-b", lastActivityAt: now, expiresAt: new Date(now.getTime() + 1), createdAt: now });
    const touched = await repos.sessions.touchActive("a", now, new Date(now.getTime() + 12 * 60 * 60 * 1000));
    expect(touched).toMatchObject({ id: "a", lastActivityAt: now, expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000) });
    await repos.sessions.revokeForUserAndOrganization("u", "org-a");
    expect(await repos.sessions.touchActive("a", now, new Date(now.getTime() + 2))).toBeUndefined();
    expect((await repos.sessions.touchActive("b", now, new Date(now.getTime() + 2)))?.id).toBe("b");
    await repos.sessions.create({ id: "expired", tokenHash: "expired", userId: "u", lastActivityAt: now, expiresAt: now, createdAt: now });
    expect(await repos.sessions.touchActive("expired", now, new Date(now.getTime() + 1))).toBeUndefined();
  });
  it("runs transactional repositories with rollback", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const runner = new MongoTransactionRunner(client, db);
    await expect(runner.run(async ({ users }) => { const now = new Date(); await users.save({id:"rollback",firstName:"A",lastName:"B",emailNormalized:"rollback@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now}); throw new Error("rollback"); })).rejects.toThrow("rollback");
    expect(await db.collection("users").countDocuments({ id: "rollback" })).toBe(0);
  });
});


describe("identity seed entrypoint", () => {
  it("creates the initial platform admin when the organization already exists", async () => {
    const database = `identity_seed_existing_org_${Date.now()}`;
    const env = {
      ...process.env,
      SENTINEL_MONGODB_URI: replSet.getUri(),
      SENTINEL_MONGODB_DATABASE: database,
      SENTINEL_INITIAL_ORGANIZATION_NAME: "Initial Organization",
      SENTINEL_INITIAL_ADMIN_EMAIL: "admin@example.test",
      SENTINEL_INITIAL_ADMIN_PASSWORD: "temporary-password",
    };
    const db = client.db(database);
    await migrateIdentityDatabase(db);
    await db.collection("organizations").insertOne({ schemaVersion: 1, id: "initial", name: "Initial Organization", seedKey: "initial", status: "active", authorizationVersion: 0, createdAt: new Date(), updatedAt: new Date() });

    await execFileAsync(process.execPath, ["scripts/identity-seed.mjs"], { cwd: process.cwd(), env });

    await expect(db.collection("users").findOne({ id: "initial-admin" })).resolves.toMatchObject({ platformRole: "super-admin" });
    await expect(db.collection("organization_memberships").findOne({ organizationId: "initial", userId: "initial-admin" })).resolves.toMatchObject({ role: "admin", status: "active" });
  }, 60_000);

  it("allows two concurrent executions and creates one initial identity", async () => {
    const database = `identity_seed_entry_${Date.now()}`;
    const env = {
      ...process.env,
      SENTINEL_MONGODB_URI: replSet.getUri(),
      SENTINEL_MONGODB_DATABASE: database,
      SENTINEL_INITIAL_ORGANIZATION_NAME: "Initial Organization",
      SENTINEL_INITIAL_ADMIN_EMAIL: "admin@example.test",
      SENTINEL_INITIAL_ADMIN_PASSWORD: "temporary-password",
    };
    const runSeed = () => execFileAsync(process.execPath, ["scripts/identity-seed.mjs"], { cwd: process.cwd(), env });

    await expect(Promise.all([runSeed(), runSeed()])).resolves.toHaveLength(2);
    const db = client.db(database);
    await expect(db.collection("organizations").countDocuments()).resolves.toBe(1);
    await expect(db.collection("users").countDocuments()).resolves.toBe(1);
    await expect(db.collection("users").findOne({ id: "initial-admin" })).resolves.toMatchObject({ platformRole: "super-admin" });
    await expect(db.collection("organization_memberships").countDocuments()).resolves.toBe(1);
  }, 60_000);
});

describe("atomic identity mutations", () => {
  it("rolls back a failed seed, retries it, and makes concurrent reseeds idempotent", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({ id: "existing", firstName: "E", lastName: "U", emailNormalized: "root@test.dev", passwordHash: "h", passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now });
    const app = createIdentityApplication({ ...repos, passwords: { hash: async (value: string) => value, verify: async () => false }, dummyPasswordHash: "dummy", tokens: { create: async () => "token" }, tokenHasher: { hash: async (value: string) => value }, temporaryPasswords: { create: () => "temporary" }, ids: { create: () => "generated" }, clock: { now: () => now }, transactions: new MongoTransactionRunner(client, db) });
    const failed = { organizationId: "seed", organizationName: "Seed", administrator: { id: "admin", firstName: "A", lastName: "D", email: "root@test.dev", passwordHash: "h" } };
    await expect(app.seed(failed)).rejects.toThrow();
    expect(await db.collection("organizations").countDocuments({ id: "seed" })).toBe(0);
    const input = { ...failed, administrator: { ...failed.administrator, email: "admin@test.dev" } };
    await expect(app.seed(input)).resolves.toEqual({ kind: "seeded" });
    const reseeds = await Promise.all([app.seed(input), app.seed(input)]);
    expect(reseeds).toEqual([{ kind: "already_seeded" }, { kind: "already_seeded" }]);
    expect(await db.collection("organization_memberships").countDocuments({ organizationId: "seed" })).toBe(1);
  });
  it("seeds an empty database exactly once when two initial seeds race", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    let entered = 0; let release!: () => void; let bothEntered!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const barrier = new Promise<void>((resolve) => { bothEntered = resolve; });
    const transactions = new MongoTransactionRunner(client, db);
    const app = createIdentityApplication({ ...repos, passwords: { hash: async (value: string) => value, verify: async () => false }, dummyPasswordHash: "dummy", tokens: { create: async () => "token" }, tokenHasher: { hash: async (value: string) => value }, temporaryPasswords: { create: () => "temporary" }, ids: { create: () => "generated" }, clock: { now: () => now }, transactions: { run: async (work) => transactions.run(async (transactionalRepositories) => { entered += 1; if (entered === 2) bothEntered(); await waiting; return work(transactionalRepositories); }) } });
    const input = { organizationId: "concurrent-seed", organizationName: "Concurrent Seed", administrator: { id: "concurrent-admin", firstName: "A", lastName: "D", email: "concurrent-admin@test.dev", passwordHash: "hash" } };
    const first = app.seed(input); const second = app.seed(input); await barrier; release();
    expect(await Promise.all([first, second])).toEqual(expect.arrayContaining([{ kind: "seeded" }, { kind: "already_seeded" }]));
    await expect(db.collection("organizations").countDocuments({ id: input.organizationId })).resolves.toBe(1);
    await expect(db.collection("users").countDocuments({ id: input.administrator.id })).resolves.toBe(1);
    await expect(db.collection("organization_memberships").countDocuments({ organizationId: input.organizationId, userId: input.administrator.id })).resolves.toBe(1);
  });
  it("rejects a login after a barrier lets reset replace the verified password", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({ id: "u", firstName: "A", lastName: "B", emailNormalized: "a@test.dev", passwordHash: "old", passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now });
    await repos.memberships.save({ organizationId: "org", userId: "u", role: "operator", status: "active" });
    let release!: () => void; let reached!: () => void;
    const waiting = new Promise<void>((resolve) => { release = resolve; }); const barrier = new Promise<void>((resolve) => { reached = resolve; });
    const passwords = { hash: async (value: string) => value, verify: async (value: string, hash: string) => { const valid = value === hash; if (hash === "old") { reached(); await waiting; } return valid; } };
    let serial = 0;
    const app = createIdentityApplication({ ...repos, passwords, dummyPasswordHash: "dummy", tokens: { create: async () => `token-${++serial}` }, tokenHasher: { hash: async (value: string) => value }, temporaryPasswords: { create: () => "new" }, ids: { create: () => `id-${++serial}` }, clock: { now: () => now }, transactions: new MongoTransactionRunner(client, db) });
    const login = app.login({ email: "a@test.dev", password: "old" }); await barrier;
    await expect(app.resetPassword({ actor: { userId: "admin", organizationId: "org", role: "admin" }, userId: "u", temporaryPassword: "reset" })).resolves.toMatchObject({ kind: "reset" });
    release();
    await expect(login).resolves.toEqual({ kind: "invalid_credentials" });
    expect(await db.collection("sessions").countDocuments({ userId: "u" })).toBe(0);
  });
  it("rejects a password change when reset revokes its session at the forced barrier", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({ id: "u", firstName: "A", lastName: "B", emailNormalized: "a@test.dev", passwordHash: "old", passwordChangeRequired: true, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now });
    await repos.memberships.save({ organizationId: "org", userId: "u", role: "operator", status: "active" }); await repos.sessions.create({ id: "s", tokenHash: "token", userId: "u", lastActivityAt: now, expiresAt: new Date(now.getTime() + 60_000), createdAt: now });
    let release!: () => void; let reached!: () => void; const waiting = new Promise<void>((resolve) => { release = resolve; }); const barrier = new Promise<void>((resolve) => { reached = resolve; });
    const passwords = { verify: async () => false, hash: async (value: string) => { if (value === "changed-password") { reached(); await waiting; } return value; } };
    const app = createIdentityApplication({ ...repos, passwords, dummyPasswordHash: "dummy", tokens: { create: async () => "unused" }, tokenHasher: { hash: async (value: string) => value }, temporaryPasswords: { create: () => "temporary" }, ids: { create: () => "unused" }, clock: { now: () => now }, transactions: new MongoTransactionRunner(client, db) });
    const changing = app.changePassword({ token: "token", password: "changed-password" }); await barrier;
    await app.resetPassword({ actor: { userId: "admin", organizationId: "org", role: "admin" }, userId: "u", temporaryPassword: "reset" }); release();
    await expect(changing).resolves.toEqual({ kind: "forbidden" });
    expect((await repos.users.findById("u"))?.passwordHash).toBe("reset");
  });
  it("allows exactly one controlled compare-and-swap writer for an authorization version", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({id:"cas",firstName:"A",lastName:"B",emailNormalized:"cas@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now});
    let release!: () => void; let reached = 0; let signal!: () => void;
    const barrier = new Promise<void>((resolve) => { release = resolve; });
    const bothReady = new Promise<void>((resolve) => { signal = resolve; });
    const contender = async () => { const snapshot = await repos.users.findById("cas"); reached += 1; if (reached === 2) signal(); await barrier; return repos.users.compareAndTouchAuthorizationVersion("cas", snapshot!.authorizationVersion, now); };
    const first = contender(); const second = contender(); await bothReady; release();
    expect(await Promise.all([first, second])).toEqual(expect.arrayContaining([true, false]));
    expect((await repos.users.findById("cas"))?.authorizationVersion).toBe(1);
  });
  it("counts concurrent failures atomically and blocks after the third", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date();
    await repos.users.save({id:"race",firstName:"A",lastName:"B",emailNormalized:"race@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now});
    await Promise.all(Array.from({length:3}, () => repos.users.registerFailedLogin("race", now)));
    const user = await repos.users.findById("race"); expect(user?.failureCount).toBe(3); expect(user?.blockedUntil).toEqual(new Date(now.getTime()+900000));
  });
  it("does not extend an active lockout and starts a new failure window after fifteen minutes", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client); const now = new Date("2026-01-01T00:00:00.000Z");
    await repos.users.save({id:"window",firstName:"A",lastName:"B",emailNormalized:"window@test.dev",passwordHash:"h",passwordChangeRequired:false,status:"active",failureCount:0,authorizationVersion:0,createdAt:now,updatedAt:now});
    await Promise.all([repos.users.registerFailedLogin("window", now), repos.users.registerFailedLogin("window", now), repos.users.registerFailedLogin("window", now)]);
    const blocked = await repos.users.findById("window");
    await repos.users.registerFailedLogin("window", new Date(now.getTime() + 60_000));
    expect((await repos.users.findById("window"))?.blockedUntil).toEqual(blocked?.blockedUntil);
    await repos.users.registerFailedLogin("window", new Date(now.getTime() + 15 * 60_000));
    const restarted = await repos.users.findById("window");
    expect(restarted?.failureCount).toBe(1);
    expect(restarted?.blockedUntil).toBeUndefined();
  });
  it("leaves one admin when parallel demotions race", async () => {
    const db = client.db(`identity_${Date.now()}`); await migrateIdentityDatabase(db); const repos = createMongoIdentityRepositories(db, client);
    await repos.organizations.save({id:"org",name:"Org",status:"active"});
    await Promise.all(["a","b"].map(id => repos.memberships.save({organizationId:"org",userId:id,role:"admin",status:"active"})));
    const results = await Promise.all([repos.memberships.changeRoleIfNotLastAdmin({organizationId:"org",userId:"a",role:"operator"}),repos.memberships.changeRoleIfNotLastAdmin({organizationId:"org",userId:"b",role:"operator"})]);
    expect(results).toContain("last_admin"); expect((await repos.memberships.listByOrganization("org")).filter(m=>m.role==="admin"&&m.status==="active")).toHaveLength(1);
  });
});
