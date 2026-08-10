import { describe, expect, it, vi } from "vitest";

import type { CatalogSyncRun, ProviderConnection } from "@/domain/catalog";

import type { GetCatalogSyncStatusPorts } from "./ports";
import { createGetCatalogSyncStatusApplication } from "./get-catalog-sync-status";

function createFixture() {
  const connections = new Map<string, ProviderConnection>();
  const runs: CatalogSyncRun[] = [];
  let clockNow = new Date("2026-08-09T06:00:00Z");
  const findLatest = vi.fn(async (organizationId: string, connectionId: string) => [...runs].filter((r) => r.organizationId === organizationId && r.connectionId === connectionId).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0]);
  const findLastSuccess = vi.fn(async (organizationId: string, connectionId: string) => [...runs].filter((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.status === "succeeded").sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime())[0]);
  const ports: GetCatalogSyncStatusPorts = {
    connections: { findById: async (organizationId, id) => [...connections.values()].find((c) => c.organizationId === organizationId && c.id === id) },
    syncRuns: { findLatest, findLastSuccess },
    clock: { now: () => clockNow },
  };
  return { ports, connections, runs, findLatest, findLastSuccess, setNow: (value: string) => { clockNow = new Date(value); } };
}

const connectionA: ProviderConnection = { id: "conn-1", organizationId: "org-a", credentialRef: "vault:cybermapa/org-a-secret" };

describe("cross-tenant access is refused before any run history is read", () => {
  it("reports not-found for a connectionId owned by another tenant, without ever querying its run history", async () => {
    const fixture = createFixture();
    fixture.connections.set("conn-1", { ...connectionA, organizationId: "org-b" });
    fixture.runs.push({ id: "run-1", organizationId: "org-b", connectionId: "conn-1", trigger: "manual", status: "succeeded", fullSnapshot: true, startedAt: fixture.ports.clock.now(), completedAt: fixture.ports.clock.now(), counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
    const app = createGetCatalogSyncStatusApplication(fixture.ports);

    const result = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });

    expect(result).toEqual({ kind: "not-found" });
    expect(fixture.findLatest).not.toHaveBeenCalled();
    expect(fixture.findLastSuccess).not.toHaveBeenCalled();
  });
});

describe("a connection with no synchronization history", () => {
  it("is reported as due with no latest run and no last success", async () => {
    const fixture = createFixture();
    fixture.connections.set("conn-1", connectionA);
    const app = createGetCatalogSyncStatusApplication(fixture.ports);

    const result = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });

    expect(result).toEqual({ kind: "found", status: { connectionId: "conn-1", latestRun: undefined, lastSuccessAt: undefined, isDue: true } });
  });
});

describe("freshness derives from the last SUCCESSFUL run, not merely the latest run", () => {
  it("keeps isDue and lastSuccessAt anchored to the successful run even when a failed run is more recent, and never leaks the connection's credential into the projection", async () => {
    const fixture = createFixture();
    fixture.connections.set("conn-1", connectionA);
    const success: CatalogSyncRun = { id: "run-1", organizationId: "org-a", connectionId: "conn-1", trigger: "manual", status: "succeeded", fullSnapshot: true, startedAt: new Date("2026-08-09T00:00:00Z"), completedAt: new Date("2026-08-09T00:00:00Z"), counts: { processed: 5, created: 5, linked: 0, reviewed: 0, rejected: 0, absent: 0 } };
    const failed: CatalogSyncRun = { id: "run-2", organizationId: "org-a", connectionId: "conn-1", trigger: "scheduled", status: "failed", fullSnapshot: true, startedAt: new Date("2026-08-09T01:00:00Z"), completedAt: new Date("2026-08-09T01:01:00Z"), counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, failureSummary: "Provider connection unreachable" };
    fixture.runs.push(success, failed);
    const app = createGetCatalogSyncStatusApplication(fixture.ports);

    const result = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });

    expect(result.kind).toBe("found");
    expect(result.kind === "found" ? result.status.latestRun : undefined).toEqual({ status: "failed", trigger: "scheduled", startedAt: failed.startedAt, completedAt: failed.completedAt, counts: failed.counts, failureSummary: "Provider connection unreachable" });
    expect(result.kind === "found" ? result.status.lastSuccessAt : undefined).toEqual(new Date("2026-08-09T00:00:00Z"));
    expect(result.kind === "found" ? result.status.isDue : undefined).toBe(true);
    expect(JSON.stringify(result)).not.toContain("vault:cybermapa/org-a-secret");
  });
});

describe("the latest run is projected through an explicit allowlist, never passed through wholesale", () => {
  it("exposes only status, trigger, startedAt, completedAt, counts, and failureSummary, so a future field added to CatalogSyncRun cannot silently widen what admins see", async () => {
    const fixture = createFixture();
    fixture.connections.set("conn-1", connectionA);
    fixture.runs.push({ id: "run-1", organizationId: "org-a", connectionId: "conn-1", trigger: "manual", status: "succeeded", fullSnapshot: true, checkpoint: "ext-999", startedAt: new Date("2026-08-09T00:00:00Z"), completedAt: new Date("2026-08-09T00:05:00Z"), counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
    const app = createGetCatalogSyncStatusApplication(fixture.ports);

    const result = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });
    const latestRun = result.kind === "found" ? result.status.latestRun : undefined;

    expect(latestRun && Object.keys(latestRun).sort()).toEqual(["completedAt", "counts", "failureSummary", "startedAt", "status", "trigger"]);
    expect(latestRun).not.toHaveProperty("id");
    expect(latestRun).not.toHaveProperty("organizationId");
    expect(latestRun).not.toHaveProperty("connectionId");
    expect(latestRun).not.toHaveProperty("checkpoint");
    expect(latestRun).not.toHaveProperty("fullSnapshot");
  });
});

describe("the six-hour freshness boundary is inclusive on the due side (consistent with isCatalogSyncDue)", () => {
  it("is not due one second before six hours and due exactly at six hours, using the injected clock", async () => {
    const fixture = createFixture();
    fixture.connections.set("conn-1", connectionA);
    fixture.runs.push({ id: "run-1", organizationId: "org-a", connectionId: "conn-1", trigger: "manual", status: "succeeded", fullSnapshot: true, startedAt: new Date("2026-08-09T00:00:00Z"), completedAt: new Date("2026-08-09T00:00:00Z"), counts: { processed: 1, created: 1, linked: 0, reviewed: 0, rejected: 0, absent: 0 } });
    const app = createGetCatalogSyncStatusApplication(fixture.ports);

    fixture.setNow("2026-08-09T05:59:59Z");
    const notYetDue = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });
    fixture.setNow("2026-08-09T06:00:00Z");
    const due = await app.getCatalogSyncStatus({ organizationId: "org-a", connectionId: "conn-1" });

    expect(notYetDue.kind === "found" ? notYetDue.status.isDue : undefined).toBe(false);
    expect(due.kind === "found" ? due.status.isDue : undefined).toBe(true);
  });
});
