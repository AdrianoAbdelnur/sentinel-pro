import type { ClientSession, Db, Filter } from "mongodb";
import type { CatalogSyncLeaseDocument, CatalogSyncRunDocument } from "./catalog-documents";
import type { GlobalSyncRun } from "@/application/catalog/synchronize-global-connection";

const options = (session?: ClientSession) => session ? { session } : {};
const isDuplicate = (error: unknown) => typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000;
const now = () => new Date();

function toDocument(run: GlobalSyncRun, existing?: CatalogSyncRunDocument): CatalogSyncRunDocument {
  return {
    schemaVersion: 2,
    id: run.id,
    lineageId: run.lineageId,
    attempt: run.attempt,
    connectionId: run.connectionId,
    trigger: run.trigger,
    status: run.status,
    startedAt: run.startedAt,
    ...(run.completedAt ? { completedAt: run.completedAt } : {}),
    ...(run.checkpoint ? { checkpoint: run.checkpoint } : {}),
    total: run.total,
    counts: run.counts,
    snapshot: run.snapshot,
    ...(run.failure ? { failure: run.failure } : {}),
    createdAt: existing?.createdAt ?? now(),
    updatedAt: now(),
  };
}

export function createCatalogSyncRepositories(db: Db, session?: ClientSession) {
  const runs = db.collection<CatalogSyncRunDocument>("catalog_runs");
  const leases = db.collection<CatalogSyncLeaseDocument>("catalog_leases");
  const findRun = async (filter: Filter<CatalogSyncRunDocument>) => runs.findOne(filter, options(session)) as Promise<CatalogSyncRunDocument | null>;
  const syncRuns = {
      async findLatest(connectionId: string) { return (await runs.find({ connectionId }, options(session)).sort({ startedAt: -1, attempt: -1 }).limit(1).next()) as GlobalSyncRun | undefined; },
      async findLastSuccess(connectionId: string) { return (await runs.find({ connectionId, status: "succeeded" }, options(session)).sort({ completedAt: -1 }).limit(1).next()) as GlobalSyncRun | undefined; },
      async findLastConfirmed(connectionId: string) { return (await runs.find({ connectionId, status: "succeeded", "snapshot.status": "complete" }, options(session)).sort({ completedAt: -1 }).limit(1).next()) as GlobalSyncRun | undefined; },
      async claimActive(run: GlobalSyncRun) { try { await runs.insertOne(toDocument(run), options(session)); return "claimed" as const; } catch (error) { if (isDuplicate(error)) return "already-active" as const; throw error; } },
      async save(run: GlobalSyncRun) { const existing = await findRun({ id: run.id }); await runs.replaceOne({ id: run.id }, toDocument(run, existing ?? undefined), { upsert: true, ...options(session) }); },
    };
  const syncLeases = {
      async claim(connectionId: string, runId: string, claimNow: Date, durationMs: number) {
        const leaseUntil = new Date(claimNow.getTime() + durationMs);
        try {
          const before = await leases.findOneAndUpdate({ connectionId, $or: [{ leaseUntil: { $lte: claimNow } }, { runId }] }, { $set: { runId, leaseUntil, updatedAt: claimNow }, $setOnInsert: { schemaVersion: 2, createdAt: claimNow } }, { upsert: true, returnDocument: "before", ...options(session) });
          return before && before.runId !== runId ? { outcome: "claimed" as const, previousRunId: before.runId } : { outcome: "claimed" as const };
        } catch (error) { if (isDuplicate(error)) return { outcome: "held" as const }; throw error; }
      },
      async renew(connectionId: string, runId: string, claimNow: Date, durationMs: number) {
        const result = await leases.updateOne({ connectionId, runId, leaseUntil: { $gt: claimNow } }, { $set: { leaseUntil: new Date(claimNow.getTime() + durationMs), updatedAt: claimNow } }, options(session));
        return result.matchedCount === 1 ? { outcome: "renewed" as const } : { outcome: "held" as const };
      },
      async release(connectionId: string, runId: string) { await leases.deleteOne({ connectionId, runId }, options(session)); },
    };
  return { runs: syncRuns, leases: syncLeases, syncRuns, syncLeases };
}
