import { describe, expect, it, vi } from "vitest";

import type { ProviderConnection, ProviderContribution } from "@/domain/catalog-global";

import { createSynchronizeGlobalConnectionApplication, type GlobalSyncPorts, type GlobalSyncRun } from "./synchronize-global-connection";

const connection: ProviderConnection = { id: "connection-1", providerId: "provider-1", credentialRef: "vault:provider", enabled: true, cadenceMinutes: 60 };
const provider = { id: "provider-1", adapterKey: "adapter", capabilities: ["gps"] };
const evidence = { retrievalComplete: true, paginationComplete: true, receivedRecordCount: 1, parseableRecordCount: 1 };
const candidate = { connectionId: "connection-1", externalId: "external-1", plate: "ABC 123", normalizedPlate: "ABC123", placementFleetId: "fleet-1", capabilities: { gps: "eligible" as const }, presence: "present" as const };

function fixture() {
  let now = new Date("2026-08-16T12:00:00Z");
  const runs: GlobalSyncRun[] = [];
  const contributions: ProviderContribution[] = [];
  const ports = {
    clock: { now: () => now },
    ids: { create: vi.fn(() => `id-${runs.length + contributions.length + 1}`) },
    connections: { findById: vi.fn(async (id) => id === connection.id ? connection : undefined), listEnabled: vi.fn(async () => [connection]) },
    providers: { findById: vi.fn(async (id) => id === provider.id ? provider : undefined) },
    runs: {
      findLatest: vi.fn(async () => runs.at(-1)),
      findLastSuccess: vi.fn(async () => [...runs].reverse().find((run) => run.status === "succeeded")),
      findLastConfirmed: vi.fn(async () => [...runs].reverse().find((run) => run.status === "succeeded" && run.snapshot.status === "complete")),
      claimActive: vi.fn(async (run) => runs.some((item) => item.status === "active") ? "already-active" : (runs.push(run), "claimed")),
      save: vi.fn(async (run) => { const index = runs.findIndex((item) => item.id === run.id); if (index === -1) runs.push(run); else runs[index] = run; }),
    },
    leases: {
      claim: vi.fn(async () => ({ outcome: "claimed" as const })),
      release: vi.fn(async () => undefined),
      renew: vi.fn(async () => ({ outcome: "renewed" as const })),
    },
    vehicles: { findByNormalizedPlate: vi.fn(async () => undefined), save: vi.fn(async () => undefined) },
    contributions: {
      findByConnectionAndExternalId: vi.fn(async (connectionId, externalId) => contributions.find((item) => item.connectionId === connectionId && item.externalId === externalId)),
      listByConnectionId: vi.fn(async () => contributions),
      save: vi.fn(async (value) => { const index = contributions.findIndex((item) => item.id === value.id); if (index === -1) contributions.push(value); else contributions[index] = value; }),
    },
    reviews: { findByConnectionAndExternalId: vi.fn(async () => undefined), save: vi.fn(async () => undefined) },
    memberships: { save: vi.fn(async () => undefined) },
    transactions: { run: async <T>(work: (repositories: GlobalSyncPorts) => Promise<T>) => work(ports), isConflict: () => false },
  } as unknown as GlobalSyncPorts;
  return { ports, runs, contributions, setNow: (value: string) => { now = new Date(value); } };
}

describe("synchronize global connection", () => {
  it("does not run concurrently when a lease is held", async () => {
    const { ports } = fixture();
    ports.leases.claim = vi.fn(async () => ({ outcome: "held" as const }));
    const source = { loadSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate], evidence })) };

    await expect(createSynchronizeGlobalConnectionApplication(ports).synchronize({ connectionId: connection.id, trigger: "manual", source })).resolves.toEqual({ kind: "already-running" });
    expect(source.loadSnapshot).not.toHaveBeenCalled();
  });

  it("resumes after the persisted checkpoint and does not duplicate a processed contribution", async () => {
    const { ports, runs, contributions } = fixture();
    runs.push({ id: "run-1", lineageId: "lineage-1", attempt: 1, connectionId: connection.id, trigger: "manual", status: "failed", startedAt: new Date(), checkpoint: "external-1", total: 2, counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "partial" } });
    contributions.push({ id: "contribution-1", connectionId: connection.id, externalId: "external-1", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" });
    const source = { loadSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate, { ...candidate, externalId: "external-2", normalizedPlate: "XYZ999" }], evidence: { ...evidence, receivedRecordCount: 2, parseableRecordCount: 2 } })) };

    const result = await createSynchronizeGlobalConnectionApplication(ports).synchronize({ connectionId: connection.id, trigger: "manual", source });

    expect(result.kind).toBe("succeeded");
    expect(ports.contributions.save).toHaveBeenCalledTimes(1);
    expect(contributions).toHaveLength(2);
    expect(result.kind === "succeeded" ? result.run.checkpoint : undefined).toBe("external-2");
    expect(result.kind === "succeeded" ? result.run.lineageId : undefined).toBe("lineage-1");
    expect(result.kind === "succeeded" ? result.run.attempt : undefined).toBe(2);
    expect(result.kind === "succeeded" ? result.run.total : undefined).toBe(2);
    expect(result.kind === "succeeded" ? result.run.counts.processed : undefined).toBe(2);
  });

  it("imports valid candidates from an incomplete snapshot but never reconciles absent contributions", async () => {
    const { ports, contributions } = fixture();
    contributions.push({ id: "old", connectionId: connection.id, externalId: "missing", vehicleId: "vehicle-1", capabilities: { gps: "eligible" }, presence: "present" });
    const source = { loadSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate], evidence: { ...evidence, paginationComplete: false } })) };

    const result = await createSynchronizeGlobalConnectionApplication(ports).synchronize({ connectionId: connection.id, trigger: "manual", source });

    expect(result.kind).toBe("succeeded");
    expect(contributions.find((item) => item.externalId === "missing")?.presence).toBe("present");
  });

  it("classifies authentication and connectivity failures without retrying permanent authentication errors", async () => {
    const authentication = fixture();
    const source = { loadSnapshot: vi.fn(async () => ({ kind: "failed" as const, failure: { category: "authentication" as const } })) };
    const authResult = await createSynchronizeGlobalConnectionApplication(authentication.ports).synchronize({ connectionId: connection.id, trigger: "scheduler", source });
    expect(authResult).toMatchObject({ kind: "failed", retryable: false });

    const connectivity = fixture();
    const retryableSource = { loadSnapshot: vi.fn(async () => ({ kind: "failed" as const, failure: { category: "connectivity" as const } })) };
    const connectivityResult = await createSynchronizeGlobalConnectionApplication(connectivity.ports).synchronize({ connectionId: connection.id, trigger: "scheduler", source: retryableSource });
    expect(connectivityResult).toMatchObject({ kind: "failed", retryable: true });
  });

  it("keeps a duplicate provider snapshot partial and applies each external item once", async () => {
    const { ports, contributions } = fixture();
    const source = { loadSnapshot: vi.fn(async () => ({ kind: "complete" as const, candidates: [candidate, candidate], evidence: { ...evidence, receivedRecordCount: 2, parseableRecordCount: 2 } })) };

    const result = await createSynchronizeGlobalConnectionApplication(ports).synchronize({ connectionId: connection.id, trigger: "manual", source });

    expect(result.kind).toBe("succeeded");
    expect(result.kind === "succeeded" ? result.run.snapshot : undefined).toMatchObject({ status: "partial", reason: "duplicate-external-id" });
    expect(result.kind === "succeeded" ? result.run.total : undefined).toBe(1);
    expect(result.kind === "succeeded" ? result.run.counts.processed : undefined).toBe(1);
    expect(contributions).toHaveLength(1);
  });

  it("skips disabled and fresh connections while reporting due enabled connections", async () => {
    const { ports } = fixture();
    ports.connections.listEnabled = vi.fn(async () => [connection]);
    const scheduler = createSynchronizeGlobalConnectionApplication(ports);
    expect(await scheduler.listDueConnections()).toEqual([connection]);
    ports.runs.findLastSuccess = vi.fn(async () => ({ id: "fresh", connectionId: connection.id, trigger: "scheduler" as const, status: "succeeded" as const, startedAt: new Date("2026-08-16T11:29:00Z"), completedAt: new Date("2026-08-16T11:30:00Z"), counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, snapshot: { status: "complete" as const } }));
    expect(await scheduler.listDueConnections()).toEqual([]);
  });
});
