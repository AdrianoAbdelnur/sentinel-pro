import argon2 from "argon2";
import { MongoClient } from "mongodb";
import { execFileSync } from "node:child_process";
import { ARGON2ID_OPTIONS } from "../integrations/security/argon2id-options.mjs";

const uri = process.env.SENTINEL_MONGODB_URI;
const database = process.env.SENTINEL_MONGODB_DATABASE;
const organizationName = process.env.SENTINEL_INITIAL_ORGANIZATION_NAME;
const email = process.env.SENTINEL_INITIAL_ADMIN_EMAIL;
const password = process.env.SENTINEL_INITIAL_ADMIN_PASSWORD;
if (!uri || !database || !organizationName || !email || !password) process.exitCode = 1;
else {
  execFileSync(process.execPath, ["--experimental-strip-types", "integrations/persistence/mongodb/migrate.ts"], { stdio: "inherit", env: process.env });
  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db(database);
    await client.withSession((session) => session.withTransaction(async () => {
      const organization = await db.collection("organizations").findOne({ seedKey: "initial" }, { session });
      if (organization) return;
      const now = new Date();
      const userId = "initial-admin";
      await db.collection("organizations").insertOne({ schemaVersion: 1, id: "initial", name: organizationName, seedKey: "initial", status: "active", authorizationVersion: 0, createdAt: now, updatedAt: now }, { session });
      await db.collection("users").updateOne({ emailNormalized: email.trim().toLowerCase() }, { $setOnInsert: { schemaVersion: 1, id: userId, firstName: process.env.SENTINEL_INITIAL_ADMIN_FIRST_NAME ?? "Administrator", lastName: process.env.SENTINEL_INITIAL_ADMIN_LAST_NAME ?? "Sentinel", emailNormalized: email.trim().toLowerCase(), passwordHash: await argon2.hash(password, ARGON2ID_OPTIONS), passwordChangeRequired: false, status: "active", failureCount: 0, authorizationVersion: 0, createdAt: now, updatedAt: now } }, { upsert: true, session });
      const user = await db.collection("users").findOne({ emailNormalized: email.trim().toLowerCase() }, { session });
      await db.collection("organization_memberships").updateOne({ organizationId: "initial", userId: user.id }, { $setOnInsert: { schemaVersion: 1, organizationId: "initial", userId: user.id, role: "admin", status: "active", createdAt: now, updatedAt: now } }, { upsert: true, session });
    }));
  } finally { await client.close(); }
}
