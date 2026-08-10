import { describe, expect, it, vi } from "vitest";

import type { CatalogSyncRun } from "@/domain/catalog";

import type { SynchronizeDueCatalogConnectionsPorts } from "./ports";
import type { SynchronizeCatalogConnectionUseCase } from "./sync-contracts";
import { createSynchronizeDueCatalogConnectionsApplication } from "./synchronize-due-catalog-connections";

function createFixture() {
  const successByKey = new Map<string, CatalogSyncRun>();
  const findLastSuccess = vi.fn(async (organizationId: string, connectionId: string) => successByKey.get(`${organizationId}:${connectionId}`));
  let clockNow = new Date("2026-08-09T06:00:00Z");
  const ports: SynchronizeDueCatalogConnectionsPorts = { syncRuns: { findLastSuccess }, clock: { now: () => clockNow } };
  const setNow = (value: string) => { clockNow = new Date(value); };
  const seedLastSuccess = (organizationId: string, connectionId: string, run: CatalogSyncRun) => { successByKey.set(`${organizationId}:${connectionId}`, run); };
  return { ports, findLastSuccess, setNow, seedLastSuccess };
}

const succeededRun = (organizationId: string, connectionId: string, completedAt: Date, trigger: CatalogSyncRun["trigger"] = "manual"): CatalogSyncRun => ({
  id: `run-${connectionId}`,
  organizationId,
  connectionId,
  trigger,
  status: "succeeded",
  fullSnapshot: true,
  startedAt: completedAt,
  completedAt,
  counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 },
});

const source = { loadCompleteSnapshot: async () => ({ kind: "complete" as const, candidates: [] }) };

describe("a connection due for reconciliation is synchronized on a scheduled trigger", () => {
  it("invokes the synchronizer with trigger 'scheduled' for a connection that has never synchronized successfully", async () => {
    const fixture = createFixture();
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>(async () => ({ kind: "succeeded", run: succeededRun("org-a", "conn-1", fixture.ports.clock.now()) }));
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);

    const result = await app.synchronizeDueCatalogConnections({ candidates: [{ organizationId: "org-a", connectionId: "conn-1", source }] });

    expect(synchronizeCatalogConnection).toHaveBeenCalledWith({ organizationId: "org-a", connectionId: "conn-1", trigger: "scheduled", source });
    expect(result.results).toEqual([{ organizationId: "org-a", connectionId: "conn-1", outcome: { kind: "succeeded", run: expect.anything() } }]);
  });
});

describe("a not-due connection is skipped without leasing", () => {
  it("never calls the synchronizer (which owns leasing) when the last success is inside the six-hour freshness window", async () => {
    const fixture = createFixture();
    fixture.seedLastSuccess("org-a", "conn-1", succeededRun("org-a", "conn-1", new Date("2026-08-09T04:00:00Z")));
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>();
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);

    const result = await app.synchronizeDueCatalogConnections({ candidates: [{ organizationId: "org-a", connectionId: "conn-1", source }] });

    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
    expect(result.results).toEqual([{ organizationId: "org-a", connectionId: "conn-1", outcome: { kind: "skipped-fresh", lastSuccessAt: new Date("2026-08-09T04:00:00Z") } }]);
  });

  it("calls the synchronizer once the last success is exactly six hours old, matching the domain boundary", async () => {
    const fixture = createFixture();
    fixture.seedLastSuccess("org-a", "conn-1", succeededRun("org-a", "conn-1", new Date("2026-08-09T00:00:00Z")));
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>(async () => ({ kind: "succeeded", run: succeededRun("org-a", "conn-1", fixture.ports.clock.now()) }));
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);

    const result = await app.synchronizeDueCatalogConnections({ candidates: [{ organizationId: "org-a", connectionId: "conn-1", source }] });

    expect(synchronizeCatalogConnection).toHaveBeenCalledTimes(1);
    expect(result.results[0]?.outcome.kind).toBe("succeeded");
  });
});

describe("a recent manual success prevents a redundant automatic run", () => {
  it("skips a due-looking connection as fresh when its most recent success was triggered manually less than six hours ago", async () => {
    const fixture = createFixture();
    fixture.seedLastSuccess("org-a", "conn-1", succeededRun("org-a", "conn-1", new Date("2026-08-09T05:00:00Z"), "manual"));
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>();
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);

    const result = await app.synchronizeDueCatalogConnections({ candidates: [{ organizationId: "org-a", connectionId: "conn-1", source }] });

    expect(synchronizeCatalogConnection).not.toHaveBeenCalled();
    expect(result.results[0]?.outcome).toEqual({ kind: "skipped-fresh", lastSuccessAt: new Date("2026-08-09T05:00:00Z") });
  });
});

describe("one connection failing does not stop the rest of the batch", () => {
  it("isolates an unexpected thrown error from one candidate while the others still complete", async () => {
    const fixture = createFixture();
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>(async ({ connectionId }) => {
      if (connectionId === "conn-2") throw new Error("simulated infrastructure failure");
      return { kind: "succeeded", run: succeededRun("org-a", connectionId, fixture.ports.clock.now()) };
    });
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);
    const candidates = [
      { organizationId: "org-a", connectionId: "conn-1", source },
      { organizationId: "org-a", connectionId: "conn-2", source },
      { organizationId: "org-a", connectionId: "conn-3", source },
    ];

    const result = await app.synchronizeDueCatalogConnections({ candidates });

    expect(result.results.map((entry) => entry.outcome.kind)).toEqual(["succeeded", "unexpected-failure", "succeeded"]);
    expect(synchronizeCatalogConnection).toHaveBeenCalledTimes(3);
  });
});

describe("candidates stay scoped to their own tenant", () => {
  it("evaluates each candidate against only its own organizationId, never leaking one tenant's freshness into another's decision", async () => {
    const fixture = createFixture();
    fixture.seedLastSuccess("org-b", "conn-shared-id", succeededRun("org-b", "conn-shared-id", new Date("2026-08-09T05:59:59Z")));
    const synchronizeCatalogConnection = vi.fn<SynchronizeCatalogConnectionUseCase>(async ({ organizationId, connectionId }) => ({ kind: "succeeded", run: succeededRun(organizationId, connectionId, fixture.ports.clock.now()) }));
    const app = createSynchronizeDueCatalogConnectionsApplication(fixture.ports, synchronizeCatalogConnection);

    const result = await app.synchronizeDueCatalogConnections({ candidates: [{ organizationId: "org-a", connectionId: "conn-shared-id", source }] });

    expect(fixture.findLastSuccess).toHaveBeenCalledWith("org-a", "conn-shared-id");
    expect(synchronizeCatalogConnection).toHaveBeenCalledWith({ organizationId: "org-a", connectionId: "conn-shared-id", trigger: "scheduled", source });
    expect(result.results[0]?.outcome.kind).toBe("succeeded");
  });
});
