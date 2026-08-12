import { describe, expect, it, vi } from "vitest";

import type { CatalogImportItem, CatalogReview, CatalogSyncRun, Company, CompanyCandidate, ExternalFleetIdentity, ExternalVehicleIdentity, Fleet, ProviderConnection, Vehicle } from "@/domain/catalog";

import { CATALOG_IMPORT_BATCH_SIZE } from "./import-catalog";
import type { CatalogImportCandidate, CatalogImportSource, CatalogSyncLeaseClaimResult, SynchronizeCatalogConnectionPorts } from "./ports";
import type { CatalogSyncOutcome } from "./sync-contracts";
import { CATALOG_SYNC_LEASE_DURATION_MS, CATALOG_SYNC_LEASE_RENEWAL_INTERVAL_MS, createSynchronizeCatalogConnectionApplication } from "./synchronize-catalog-connection";

type Lease = { organizationId: string; connectionId: string; runId: string; leaseUntil: Date };

function createLeasePort(store: Map<string, Lease>) {
  return {
    async claim(organizationId: string, connectionId: string, runId: string, now: Date, leaseDurationMs: number): Promise<CatalogSyncLeaseClaimResult> {
      const key = `${organizationId}:${connectionId}`;
      const existing = store.get(key);
      if (existing && existing.runId !== runId && existing.leaseUntil.getTime() > now.getTime()) return { outcome: "held" };
      const previousRunId = existing && existing.runId !== runId ? existing.runId : undefined;
      store.set(key, { organizationId, connectionId, runId, leaseUntil: new Date(now.getTime() + leaseDurationMs) });
      return previousRunId ? { outcome: "claimed", previousRunId } : { outcome: "claimed" };
    },
    async release(organizationId: string, connectionId: string, runId: string): Promise<void> {
      const key = `${organizationId}:${connectionId}`;
      const existing = store.get(key);
      if (existing && existing.runId === runId) store.delete(key);
    },
  };
}

function createFixture() {
  const companies = new Map<string, Company>();
  const fleets = new Map<string, Fleet>();
  const vehicles = new Map<string, Vehicle>();
  const candidates = new Map<string, CompanyCandidate>();
  const vehicleIdentities = new Map<string, ExternalVehicleIdentity>();
  const fleetIdentities = new Map<string, ExternalFleetIdentity>();
  const reviews = new Map<string, CatalogReview>();
  const importItems = new Map<string, CatalogImportItem>();
  const syncRuns = new Map<string, CatalogSyncRun>();
  const leases = new Map<string, Lease>();
  const connections = new Map<string, ProviderConnection>();
  let sequence = 0;
  const ids = { create: () => `id-${++sequence}` };
  const vehicleSaveCrash = { crashOnCallNumber: undefined as number | undefined, calls: 0 };

  const companyPort = { findById: async (id: string) => companies.get(id), save: async (c: Company) => { companies.set(c.id, c); } };
  const fleetPort = { findById: async (id: string) => fleets.get(id), listByCompany: async (companyId: string) => [...fleets.values()].filter((f) => f.companyId === companyId), save: async (f: Fleet) => { fleets.set(f.id, f); } };
  const vehiclePort = { findById: async (id: string) => vehicles.get(id), listByCompany: async (companyId: string) => [...vehicles.values()].filter((v) => v.companyId === companyId), save: async (v: Vehicle) => { vehicles.set(v.id, v); } };

  const identityPort = {
    findByConnectionAndExternalId: async (organizationId: string, connectionId: string, externalId: string) => [...vehicleIdentities.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
    listByConnection: async (organizationId: string, connectionId: string) => [...vehicleIdentities.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId),
    listStaleByRun: async (organizationId: string, connectionId: string, currentRunId: string) => [...vehicleIdentities.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.presence !== "absent" && i.lastSeenRunId !== currentRunId),
    save: async (i: ExternalVehicleIdentity) => { vehicleIdentities.set(i.id, i); },
  };
  const fleetIdentityPort = {
    findByConnectionAndExternalId: async (organizationId: string, connectionId: string, externalId: string) => [...fleetIdentities.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
    listByConnection: async (organizationId: string, connectionId: string) => [...fleetIdentities.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId),
    listByFleetId: async (organizationId: string, fleetId: string) => [...fleetIdentities.values()].filter((i) => i.organizationId === organizationId && i.fleetId === fleetId),
    save: async (i: ExternalFleetIdentity) => { fleetIdentities.set(i.id, i); },
  };
  const importItemPort = {
    findByRunAndExternalId: async (organizationId: string, connectionId: string, runId: string, externalId: string) => [...importItems.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.externalId === externalId),
    listPendingByRun: async (organizationId: string, connectionId: string, runId: string) => [...importItems.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.status === "pending"),
    save: async (i: CatalogImportItem) => { importItems.set(i.id, i); },
  };

  let clockNow = new Date("2026-08-09T00:00:00Z");
  const clock = { now: () => clockNow };
  const setNow = (value: string) => { clockNow = new Date(value); };

  const ports: SynchronizeCatalogConnectionPorts = {
    companies: companyPort,
    fleets: fleetPort,
    vehicles: vehiclePort,
    candidates: {
      findById: async (id) => candidates.get(id),
      findByConnectionAndLabel: async (organizationId, connectionId, normalizedLabel) => [...candidates.values()].find((c) => c.organizationId === organizationId && c.connectionId === connectionId && c.normalizedLabel === normalizedLabel),
      save: async (c) => { candidates.set(c.id, c); },
    },
    vehicleIdentities: identityPort,
    fleetIdentities: fleetIdentityPort,
    reviews: {
      findById: async (id) => reviews.get(id),
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId, subject) => [...reviews.values()].find((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.externalId === externalId && r.subject === subject),
      listPendingByOrganization: async (organizationId) => [...reviews.values()].filter((r) => r.organizationId === organizationId && r.status === "pending"),
      save: async (r) => { reviews.set(r.id, r); },
      resolve: async (r) => { reviews.set(r.id, r); return "resolved"; },
    },
    importItems: importItemPort,
    syncRuns: {
      findById: async (id) => syncRuns.get(id),
      findLatest: async (organizationId, connectionId) => [...syncRuns.values()].filter((r) => r.organizationId === organizationId && r.connectionId === connectionId).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0],
      findLastSuccess: async (organizationId, connectionId) => [...syncRuns.values()].filter((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.status === "succeeded").sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime())[0],
      findLastConfirmed: async (organizationId, connectionId) => [...syncRuns.values()].filter((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.status === "succeeded" && r.fullSnapshot && r.snapshot?.status === "complete").sort((a, b) => (b.completedAt as Date).getTime() - (a.completedAt as Date).getTime())[0],
      claimActive: async (run) => {
        const activeExists = [...syncRuns.values()].some((r) => r.organizationId === run.organizationId && r.connectionId === run.connectionId && r.status === "active" && r.id !== run.id);
        if (activeExists) return "already-active";
        syncRuns.set(run.id, run);
        return "claimed";
      },
      save: async (run) => { syncRuns.set(run.id, run); },
    },
    syncLeases: createLeasePort(leases),
    connections: { findById: async (organizationId, id) => [...connections.values()].find((c) => c.organizationId === organizationId && c.id === id), listAll: async () => [...connections.values()], save: async (c) => { connections.set(c.id, c); } },
    clock,
    ids,
    transactions: {
      run: async (work) => {
        const pendingVehicles: Vehicle[] = [], pendingIdentities: ExternalVehicleIdentity[] = [], pendingItems: CatalogImportItem[] = [];
        const txVehiclePort = { findById: async (id: string) => vehicles.get(id), listByCompany: async (c: string) => [...vehicles.values()].filter((v) => v.companyId === c), save: async (v: Vehicle) => { vehicleSaveCrash.calls += 1; if (vehicleSaveCrash.crashOnCallNumber === vehicleSaveCrash.calls) throw new Error("simulated mid-item crash"); pendingVehicles.push(v); } };
        const result = await work({ companies: companyPort, fleets: fleetPort, vehicles: txVehiclePort, vehicleIdentities: { ...identityPort, save: async (i: ExternalVehicleIdentity) => { pendingIdentities.push(i); } }, importItems: { ...importItemPort, save: async (i: CatalogImportItem) => { pendingItems.push(i); } } });
        for (const v of pendingVehicles) vehicles.set(v.id, v);
        for (const i of pendingIdentities) vehicleIdentities.set(i.id, i);
        for (const i of pendingItems) importItems.set(i.id, i);
        return result;
      },
    },
  };

  return { ports, setNow, vehicleSaveCrash, sync: createSynchronizeCatalogConnectionApplication(ports), companies, fleets, vehicles, candidates, vehicleIdentities, fleetIdentities, reviews, importItems, syncRuns, leases, connections };
}

const connectionA: ProviderConnection = {
  id: "conn-cyber",
  organizationId: "org-a",
  credentialRef: "vault:cybermapa/master",
  companyId: "id-1",
  authorizedExternalCompanyLabels: ["acme transport"],
};
const connectionOtherTenant: ProviderConnection = { id: "conn-stolen", organizationId: "org-b", credentialRef: "vault:cybermapa/org-b" };

const fakeSource = (candidates: CatalogImportCandidate[]): CatalogImportSource => ({ loadCompleteSnapshot: async () => ({ kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount: candidates.length, parseableRecordCount: candidates.length } }) });
const failingSource = (): CatalogImportSource => ({ loadCompleteSnapshot: async () => ({ kind: "failed", failure: { category: "connectivity" } }) });const sourceWithEvidence = (candidates: CatalogImportCandidate[], evidence: { retrievalComplete: boolean; paginationComplete: boolean; receivedRecordCount: number; parseableRecordCount: number }): CatalogImportSource => ({ loadCompleteSnapshot: async () => ({ kind: "complete", candidates, evidence }) });

async function bindCompany(fixture: ReturnType<typeof createFixture>, connection: ProviderConnection, label: string) {
  const companyId = fixture.ports.ids.create();
  const unassignedId = fixture.ports.ids.create();
  await fixture.ports.companies.save({ id: companyId, organizationId: connection.organizationId, name: label });
  await fixture.ports.fleets.save({ id: unassignedId, companyId, name: "Unassigned", kind: "unassigned" });
  const candidateId = fixture.ports.ids.create();
  await fixture.ports.candidates.save({ id: candidateId, organizationId: connection.organizationId, connectionId: connection.id, normalizedLabel: label.trim().toLowerCase(), companyId });
  return { companyId, unassignedId };
}

describe("initial synchronization", () => {
  it("runs a first-ever synchronization to completion regardless of trigger, since a connection with no prior success is always due", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "initial", source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(outcome.kind).toBe("succeeded");
    expect(outcome.kind === "succeeded" ? outcome.run.counts.created : -1).toBe(1);
    expect(fixture.leases.size).toBe(0);
  });
});

describe("scheduled trigger rechecks freshness after leasing", () => {
  it("skips a scheduled trigger as fresh when a manual success completed less than six hours before the injected clock, proving a recent manual run satisfies automatic cadence", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([]) });
    fixture.setNow("2026-08-09T05:00:00Z");

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", source: fakeSource([]) });

    expect(outcome.kind).toBe("skipped-fresh");
    expect(fixture.leases.size).toBe(0);
    expect([...fixture.syncRuns.values()]).toHaveLength(1);
  });

  it("runs a scheduled trigger once the last success is exactly six hours old, and a manual trigger always runs regardless of freshness", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([]) });
    fixture.setNow("2026-08-09T06:00:00Z");

    const scheduledOutcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", source: fakeSource([]) });
    fixture.setNow("2026-08-09T06:00:01Z");
    const manualOutcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([]) });

    expect(scheduledOutcome.kind).toBe("succeeded");
    expect(manualOutcome.kind).toBe("succeeded");
  });
});

describe("mutual exclusion", () => {
  it("returns already-running without starting a second run when a lease is already held, even before any active run document has been written", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    fixture.leases.set("org-a:conn-cyber", { organizationId: "org-a", connectionId: "conn-cyber", runId: "run-held", leaseUntil: new Date("2026-08-09T00:05:00Z") });

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([]) });

    expect(outcome).toEqual({ kind: "already-running" });
    expect(fixture.syncRuns.size).toBe(0);
  });

  it("lets exactly one of two concurrent triggers against the same connection start a run, and the loser reports already-running without invoking the import source", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const loadCompleteSnapshot = vi.fn(async () => ({ kind: "complete" as const, candidates: [], evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount: 0, parseableRecordCount: 0 } }));
    const sharedSource: CatalogImportSource = { loadCompleteSnapshot };

    const [first, second] = await Promise.all([
      fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: sharedSource }),
      fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", source: sharedSource }),
    ]);

    const outcomes = [first.kind, second.kind].sort();
    expect(outcomes).toEqual(["already-running", "succeeded"]);
    expect(loadCompleteSnapshot).toHaveBeenCalledTimes(1);
    expect([...fixture.syncRuns.values()].filter((r) => r.status === "active")).toHaveLength(0);
  });
});

describe("a thrown error during import still releases the lease (Risk #15)", () => {
  it("releases the lease and records a retryable failure when loadCompleteSnapshot throws instead of returning a failed result", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const throwingSource: CatalogImportSource = { loadCompleteSnapshot: async () => { throw new Error("provider crashed before returning a result"); } };

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: throwingSource });

    expect(outcome.kind).toBe("retryable-failure");
    expect(outcome.kind === "retryable-failure" ? outcome.run.status : undefined).toBe("failed");
    expect(fixture.leases.size).toBe(0);
    expect([...fixture.syncRuns.values()].filter((run) => run.status === "active")).toHaveLength(0);
  });
});

describe("retryable failure and recovery", () => {
  it("marks the run as a retryable failure and preserves canonical state when the source snapshot fetch fails outright", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: failingSource() });

    expect(outcome.kind).toBe("retryable-failure");
    expect(outcome.kind === "retryable-failure" ? outcome.run.status : undefined).toBe("failed");
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.leases.size).toBe(0);
  });

  it("recovers on a retried manual trigger after a mid-import crash, without duplicating the vehicle and identity already committed before the crash", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const candidates: CatalogImportCandidate[] = [{ externalId: "ext-1", companyLabel: "Acme Transport" }, { externalId: "ext-2", companyLabel: "Acme Transport" }];
    fixture.vehicleSaveCrash.crashOnCallNumber = 2;

    const failed = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(candidates) });
    expect(failed.kind).toBe("retryable-failure");
    expect(fixture.vehicles.size).toBe(1);

    fixture.vehicleSaveCrash.crashOnCallNumber = undefined;
    const recovered = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(candidates) });

    expect(recovered.kind).toBe("succeeded");
    expect(recovered.kind === "succeeded" ? { created: recovered.run.counts.created, linked: recovered.run.counts.linked } : {}).toEqual({ created: 1, linked: 1 });
    expect(fixture.vehicles.size).toBe(2);
  });
});

describe("absence reconciliation gated on a successful full snapshot", () => {
  it("marks a previously linked identity absent once a later successful full snapshot omits it, leaving the canonical Vehicle in place", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(Array.from({ length: 10 }, (_, index) => ({ externalId: `ext-${index}`, companyLabel: "Acme Transport" }))) });
    const [vehicle] = [...fixture.vehicles.values()];
    const identityAfterFirstRun = [...fixture.vehicleIdentities.values()].find((identity) => identity.externalId === "ext-0") as ExternalVehicleIdentity;
    expect(identityAfterFirstRun.presence).toBe("present");
    fixture.setNow("2026-08-09T07:00:00Z");

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(Array.from({ length: 9 }, (_, index) => ({ externalId: `ext-${index + 1}`, companyLabel: "Acme Transport" }))) });

    expect(outcome.kind === "succeeded" ? outcome.run.counts.absent : -1).toBe(1);
    expect(fixture.vehicleIdentities.get(identityAfterFirstRun.id)?.presence).toBe("absent");
    expect(fixture.vehicles.get(vehicle.id)).toEqual(vehicle);
  });

  it("never reconciles absence for a failed run, so a transiently-omitted device stays present and cannot later be silently auto-linked into a different plate-colliding Vehicle", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport", normalizedPlate: "AAA111" }]) });
    const [identityAfterFirstRun] = [...fixture.vehicleIdentities.values()];
    fixture.setNow("2026-08-09T07:00:00Z");

    const failedRun = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: failingSource() });
    expect(failedRun.kind).toBe("retryable-failure");
    expect(fixture.vehicleIdentities.get(identityAfterFirstRun.id)?.presence).toBe("present");

    fixture.setNow("2026-08-09T08:00:00Z");
    const nextSnapshot = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([{ externalId: "ext-2", companyLabel: "Acme Transport", normalizedPlate: "AAA111" }]) });

    expect(nextSnapshot.kind === "succeeded" ? nextSnapshot.run.counts.reviewed : -1).toBe(1);
    expect(fixture.vehicles.size).toBe(1);
    expect([...fixture.reviews.values()]).toHaveLength(1);
  });
});

describe("connection scoping closes forged organizationId access (Risk #2)", () => {
  it("refuses to synchronize when the caller's trusted organizationId does not own the requested connectionId in the repository, leaving no run, lease, or candidate behind", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionOtherTenant.id, connectionOtherTenant);

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: connectionOtherTenant.id, trigger: "manual", source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(outcome).toEqual({ kind: "not-found" });
    expect(fixture.syncRuns.size).toBe(0);
    expect(fixture.leases.size).toBe(0);
    expect(fixture.candidates.size).toBe(0);
  });
});

describe("external scope authorization", () => {
  it("imports only each Company's authorized fleet from a shared master response and remains idempotent", async () => {
    const mixedSource = fakeSource([
      { externalId: "device-x", companyId: "forged-company-b", externalFleetId: "fleet-x" },
      { externalId: "device-y", companyId: "forged-company-a", externalFleetId: "fleet-y" },
      { externalId: "device-z", companyId: "forged-company-a", externalFleetId: "fleet-z" },
    ]);
    const prepare = async (fixture: ReturnType<typeof createFixture>, connection: ProviderConnection) => {
      fixture.connections.set(connection.id, connection);
      await fixture.ports.companies.save({ id: connection.companyId as string, organizationId: "org-a", name: connection.companyId as string });
      await fixture.ports.fleets.save({ id: `${connection.companyId}-unassigned`, companyId: connection.companyId as string, name: "Unassigned", kind: "unassigned" });
    };
    const companyA = { id: "connection-a", organizationId: "org-a", credentialRef: "vault:howen/master", companyId: "company-a", authorizedExternalFleetIds: ["fleet-x"] };
    const companyB = { id: "connection-b", organizationId: "org-a", credentialRef: "vault:howen/master", companyId: "company-b", authorizedExternalFleetIds: ["fleet-y"] };
    const fixtureA = createFixture();
    const fixtureB = createFixture();
    await prepare(fixtureA, companyA);
    await prepare(fixtureB, companyB);

    await fixtureA.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: companyA.id, trigger: "manual", source: mixedSource });
    await fixtureB.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: companyB.id, trigger: "manual", source: mixedSource });
    await fixtureA.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: companyA.id, trigger: "manual", source: mixedSource });

    expect([...fixtureA.vehicles.values()]).toHaveLength(1);
    expect([...fixtureA.vehicles.values()][0]).toMatchObject({ companyId: "company-a" });
    expect([...fixtureA.vehicleIdentities.values()].map((identity) => identity.externalId)).toEqual(["device-x"]);
    expect([...fixtureB.vehicles.values()]).toHaveLength(1);
    expect([...fixtureB.vehicles.values()][0]).toMatchObject({ companyId: "company-b" });
    expect([...fixtureB.vehicleIdentities.values()].map((identity) => identity.externalId)).toEqual(["device-y"]);
  });
});

describe("the lease duration constant is pinned (regression guard)", () => {
  it("keeps the lease duration at five minutes, so a change here is a deliberate decision rather than a silent regression", () => {
    expect(CATALOG_SYNC_LEASE_DURATION_MS).toBe(5 * 60 * 1000);
  });
});

describe("the renewal interval stays safely inside the lease duration (regression guard)", () => {
  it("keeps the renewal interval at no more than a third of the lease duration, so a future change to either constant cannot silently make renewal arrive too late", () => {
    expect(CATALOG_SYNC_LEASE_RENEWAL_INTERVAL_MS).toBeGreaterThan(0);
    expect(CATALOG_SYNC_LEASE_RENEWAL_INTERVAL_MS).toBeLessThanOrEqual(CATALOG_SYNC_LEASE_DURATION_MS / 3);
  });
});

describe("active-run uniqueness independently blocks a takeover with no lease held (Finding 1)", () => {
  it("returns already-running via claimActive's own uniqueness check when an ACTIVE run already exists for the connection but no lease is held for it", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    fixture.syncRuns.set("run-active", {
      id: "run-active",
      organizationId: "org-a",
      connectionId: "conn-cyber",
      trigger: "manual",
      status: "active",
      fullSnapshot: true,
      startedAt: new Date("2026-08-09T00:00:00Z"),
      counts: { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 },
    });

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource([]) });

    expect(outcome).toEqual({ kind: "already-running" });
    expect(fixture.leases.size).toBe(0);
    expect([...fixture.syncRuns.values()]).toHaveLength(1);
  });
});

describe("lease renewal keeps a single long batch alive on a time debounce, not a batch boundary (Finding 2)", () => {
  it("renews the held lease mid-batch purely on elapsed time, so a rival trigger arriving after the original lease window — while the one and only batch is still in progress — still finds it held", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const total = CATALOG_IMPORT_BATCH_SIZE;
    const candidates: CatalogImportCandidate[] = Array.from({ length: total }, (_, index) => ({ externalId: `ext-${String(index).padStart(5, "0")}`, companyLabel: "Acme Transport" }));
    const loadCompleteSnapshot = vi.fn(async () => ({ kind: "complete" as const, candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount: candidates.length, parseableRecordCount: candidates.length } }));
    const sharedSource: CatalogImportSource = { loadCompleteSnapshot };

    let rivalOutcome: CatalogSyncOutcome | undefined;
    let itemCount = 0;
    const originalFindItem = fixture.ports.importItems.findByRunAndExternalId;
    fixture.ports.importItems.findByRunAndExternalId = async (organizationId, connectionId, runId, externalId) => {
      itemCount += 1;
      fixture.setNow(new Date(fixture.ports.clock.now().getTime() + 3000).toISOString());
      if (itemCount === 150) {
        rivalOutcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "scheduled", source: sharedSource });
      }
      return originalFindItem(organizationId, connectionId, runId, externalId);
    };

    const ownerOutcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: sharedSource });

    expect(rivalOutcome).toEqual({ kind: "already-running" });
    expect(ownerOutcome.kind).toBe("succeeded");
    expect(ownerOutcome.kind === "succeeded" ? ownerOutcome.run.counts.created : -1).toBe(total);
    expect(fixture.vehicleIdentities.size).toBe(total);
    expect(fixture.leases.size).toBe(0);
    expect([...fixture.syncRuns.values()].filter((run) => run.status === "active")).toHaveLength(0);
  });
});

describe("a renewal that discovers the lease was already stolen stops the run instead of continuing to write (Finding 1 follow-up)", () => {
  it("fails the run as soon as a debounced renewal finds the lease held by someone else, leaving items after that point unprocessed", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const total = 10;
    const candidates: CatalogImportCandidate[] = Array.from({ length: total }, (_, index) => ({ externalId: `ext-${String(index).padStart(5, "0")}`, companyLabel: "Acme Transport" }));

    const originalFindItem = fixture.ports.importItems.findByRunAndExternalId;
    fixture.ports.importItems.findByRunAndExternalId = async (organizationId, connectionId, runId, externalId) => {
      fixture.setNow(new Date(fixture.ports.clock.now().getTime() + 40_000).toISOString());
      return originalFindItem(organizationId, connectionId, runId, externalId);
    };

    let claimCalls = 0;
    const originalClaim = fixture.ports.syncLeases.claim.bind(fixture.ports.syncLeases);
    fixture.ports.syncLeases.claim = async (organizationId, connectionId, runId, now, leaseDurationMs) => {
      claimCalls += 1;
      if (claimCalls === 2) return { outcome: "held" };
      return originalClaim(organizationId, connectionId, runId, now, leaseDurationMs);
    };

    const outcome = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(candidates) });

    expect(outcome.kind).toBe("retryable-failure");
    expect(outcome.kind === "retryable-failure" ? outcome.run.status : undefined).toBe("failed");
    expect(claimCalls).toBeGreaterThanOrEqual(2);
    expect(fixture.vehicleIdentities.size).toBe(3);
  });
});







describe("snapshot integrity", () => {
  it("imports valid partial candidates but preserves unseen identities, rejects unexpected empty and parse-degraded snapshots, then recovers on a confirmed run idempotently", async () => {
    const fixture = createFixture();
    fixture.connections.set(connectionA.id, connectionA);
    await bindCompany(fixture, connectionA, "Acme Transport");
    const full = Array.from({ length: 10 }, (_, index) => ({ externalId: `safe-${index}`, companyLabel: "Acme Transport" }));
    await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(full) });
    const partial = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: sourceWithEvidence(full.slice(0, 2), { retrievalComplete: true, paginationComplete: false, receivedRecordCount: 10, parseableRecordCount: 2 }) });
    expect(partial.kind === "succeeded" ? partial.run.snapshot : undefined).toMatchObject({ status: "partial", reason: "pagination-unproven" });
    expect([...fixture.vehicleIdentities.values()].every((identity) => identity.presence === "present")).toBe(true);
    const empty = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: sourceWithEvidence([], { retrievalComplete: true, paginationComplete: true, receivedRecordCount: 0, parseableRecordCount: 0 }) });
    expect(empty.kind === "succeeded" ? empty.run.snapshot?.reason : undefined).toBe("unexpected-empty");
    const degraded = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: sourceWithEvidence(full.slice(0, 2), { retrievalComplete: true, paginationComplete: true, receivedRecordCount: 100, parseableRecordCount: 2 }) });
    expect(degraded.kind === "succeeded" ? degraded.run.snapshot?.reason : undefined).toBe("parse-quality-below-threshold");
    const recovered = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(full) });
    const retried = await fixture.sync.synchronizeCatalogConnection({ organizationId: "org-a", connectionId: "conn-cyber", trigger: "manual", source: fakeSource(full) });
    expect(recovered.kind === "succeeded" ? recovered.run.fullSnapshot : false).toBe(true);
    expect(retried.kind === "succeeded" ? retried.run.counts.absent : -1).toBe(0);
    expect(fixture.vehicleIdentities.size).toBe(10);
  });
});
