import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MongoClient } from "mongodb";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import type { GlobalSyncRun } from "@/application/catalog/synchronize-global-connection";

import { createCatalogSyncRepositories, initializeCatalogDatabase } from "./index";

let replSet: MongoMemoryReplSet;
let client: MongoClient;

beforeAll(async () => {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = new MongoClient(replSet.getUri());
  await client.connect();
}, 60_000);

afterAll(async () => {
  await client?.close();
  await replSet?.stop();
});

const counts = { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 };
const run = (overrides: Partial<GlobalSyncRun> = {}): GlobalSyncRun => ({
  id: "run-1",
  lineageId: "lineage-1",
  attempt: 1,
  connectionId: "connection-1",
  trigger: "manual",
  status: "failed",
  startedAt: new Date("2026-08-17T12:00:00.000Z"),
  completedAt: new Date("2026-08-17T12:01:00.000Z"),
  checkpoint: "external-1",
  total: 2,
  counts,
  snapshot: { status: "partial", reason: "retrieval-unproven", receivedRecordCount: 2, parseableRecordCount: 2, authorizedCandidateCount: 2 },
  ...overrides,
});

async function database(name: string) {
  const db = client.db(`global_sync_${name}_${Date.now()}`);
  await initializeCatalogDatabase(db);
  return db;
}

describe("catalog synchronization Mongo persistence", () => {
  it("keeps attempt identity separate while preserving lineage and checkpoint state", async () => {
    const db = await database("lineage");
    const repositories = createCatalogSyncRepositories(db);
    await repositories.runs.save(run());
    await repositories.runs.save(run({ id: "run-2", attempt: 2, status: "succeeded", checkpoint: "external-2", completedAt: new Date("2026-08-17T12:02:00.000Z") }));

    expect(await repositories.runs.findLatest("connection-1")).toMatchObject({ id: "run-2", lineageId: "lineage-1", attempt: 2, checkpoint: "external-2" });
    expect(await db.collection("catalog_runs").countDocuments({ lineageId: "lineage-1" })).toBe(2);
    expect(await db.collection("catalog_runs").distinct("attempt", { lineageId: "lineage-1" })).toEqual([1, 2]);
  });

  it("persists the checkpoint used to resume a connection run", async () => {
    const db = await database("resume");
    const repositories = createCatalogSyncRepositories(db);
    await repositories.runs.save(run({ status: "active", completedAt: undefined }));
    expect(await repositories.runs.findLatest("connection-1")).toMatchObject({ checkpoint: "external-1", total: 2, counts });
  });

  it("retains cumulative progress and complete snapshot evidence across persistence", async () => {
    const db = await database("progress");
    const repositories = createCatalogSyncRepositories(db);
    const first = run({ status: "active", completedAt: undefined, total: 1, counts: { ...counts, processed: 1 } });
    const second = run({ status: "succeeded", total: 2, counts: { ...counts, processed: 2, created: 2 }, snapshot: { status: "complete", receivedRecordCount: 2, parseableRecordCount: 2, authorizedCandidateCount: 2 } });
    await repositories.runs.save(first);
    await repositories.runs.save(second);

    expect(await repositories.runs.findLastConfirmed("connection-1")).toMatchObject({ total: 2, counts: { processed: 2, created: 2 }, snapshot: { status: "complete", receivedRecordCount: 2, parseableRecordCount: 2, authorizedCandidateCount: 2 } });
  });

  it("enforces lease ownership, renewal, expiry takeover, and release", async () => {
    const db = await database("leases");
    const repositories = createCatalogSyncRepositories(db);
    const now = new Date("2026-08-17T12:00:00.000Z");

    await expect(repositories.leases.claim("connection-1", "run-1", now, 60_000)).resolves.toEqual({ outcome: "claimed" });
    await expect(repositories.leases.claim("connection-1", "run-2", now, 60_000)).resolves.toEqual({ outcome: "held" });
    await expect(repositories.leases.renew("connection-1", "run-1", new Date("2026-08-17T12:00:30.000Z"), 60_000)).resolves.toEqual({ outcome: "renewed" });
    await expect(repositories.leases.claim("connection-1", "run-2", new Date("2026-08-17T12:02:00.000Z"), 60_000)).resolves.toMatchObject({ outcome: "claimed", previousRunId: "run-1" });
    await repositories.leases.release("connection-1", "run-2");
    expect(await db.collection("catalog_leases").countDocuments()).toBe(0);
  });

  it("rejects malformed snapshot run documents while preserving valid evidence", async () => {
    const db = await database("snapshot");
    const repositories = createCatalogSyncRepositories(db);
    await repositories.runs.save(run({ status: "succeeded", snapshot: { status: "complete", receivedRecordCount: 3, parseableRecordCount: 3, authorizedCandidateCount: 2 } }));

    expect(await repositories.runs.findLastConfirmed("connection-1")).toMatchObject({ snapshot: { status: "complete", receivedRecordCount: 3, parseableRecordCount: 3, authorizedCandidateCount: 2 } });
    await expect(db.collection("catalog_runs").insertOne({ ...run(), unexpected: true } as never)).rejects.toThrow();
  });
});
