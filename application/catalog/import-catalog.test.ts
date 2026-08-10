import { describe, expect, it, vi } from "vitest";

import { startCatalogSyncRun, type CatalogImportItem, type CatalogReview, type CatalogSyncRun, type Company, type CompanyCandidate, type ExternalFleetIdentity, type ExternalVehicleIdentity, type Fleet, type ProviderConnection, type Vehicle } from "@/domain/catalog";
import { mapHowenCatalog } from "@/integrations/howen/map-howen-catalog";

import { createCompanyBindingApplication } from "./bind-provider-company";
import { CATALOG_IMPORT_BATCH_SIZE, createImportCatalogApplication } from "./import-catalog";
import type { CatalogImportCandidate, CatalogImportSource, ImportCatalogPorts } from "./ports";
import { createCatalogApplication } from "./use-cases";

function toIdentityPort(getStore: () => Map<string, ExternalVehicleIdentity>) {
  return {
    findByConnectionAndExternalId: async (organizationId: string, connectionId: string, externalId: string) => [...getStore().values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
    listByConnection: async (organizationId: string, connectionId: string) => [...getStore().values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId),
    listStaleByRun: async () => [],
    save: async (i: ExternalVehicleIdentity) => { getStore().set(i.id, i); },
  };
}
function toFleetIdentityPort(getStore: () => Map<string, ExternalFleetIdentity>) {
  return {
    findByConnectionAndExternalId: async (organizationId: string, connectionId: string, externalId: string) => [...getStore().values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
    listByConnection: async (organizationId: string, connectionId: string) => [...getStore().values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId),
    listByFleetId: async (organizationId: string, fleetId: string) => [...getStore().values()].filter((i) => i.organizationId === organizationId && i.fleetId === fleetId),
    save: async (i: ExternalFleetIdentity) => { getStore().set(i.id, i); },
  };
}
function toImportItemPort(getStore: () => Map<string, CatalogImportItem>) {
  return {
    findByRunAndExternalId: async (organizationId: string, connectionId: string, runId: string, externalId: string) => [...getStore().values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.externalId === externalId),
    listPendingByRun: async (organizationId: string, connectionId: string, runId: string) => [...getStore().values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.status === "pending"),
    save: async (i: CatalogImportItem) => { getStore().set(i.id, i); },
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
  let sequence = 0;
  const ids = { create: () => `id-${++sequence}` };
  const txCrash = { afterVehicleSave: false };

  const companyPort = { findById: async (id: string) => companies.get(id), save: async (c: Company) => { companies.set(c.id, c); } };
  const fleetPort = { findById: async (id: string) => fleets.get(id), listByCompany: async (companyId: string) => [...fleets.values()].filter((f) => f.companyId === companyId), save: async (f: Fleet) => { fleets.set(f.id, f); } };
  const vehiclePort = { findById: async (id: string) => vehicles.get(id), listByCompany: async (companyId: string) => [...vehicles.values()].filter((v) => v.companyId === companyId), save: async (v: Vehicle) => { vehicles.set(v.id, v); if (txCrash.afterVehicleSave) throw new Error("simulated mid-item crash"); } };

  const ports: ImportCatalogPorts = {
    companies: companyPort,
    fleets: fleetPort,
    vehicles: vehiclePort,
    candidates: {
      findById: async (id) => candidates.get(id),
      findByConnectionAndLabel: async (organizationId, connectionId, normalizedLabel) => [...candidates.values()].find((c) => c.organizationId === organizationId && c.connectionId === connectionId && c.normalizedLabel === normalizedLabel),
      save: async (c) => { candidates.set(c.id, c); },
    },
    vehicleIdentities: toIdentityPort(() => vehicleIdentities),
    fleetIdentities: toFleetIdentityPort(() => fleetIdentities),
    reviews: {
      findById: async (id) => reviews.get(id),
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId, subject) => [...reviews.values()].find((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.externalId === externalId && r.subject === subject),
      listPendingByOrganization: async (organizationId) => [...reviews.values()].filter((r) => r.organizationId === organizationId && r.status === "pending"),
      save: async (r) => { reviews.set(r.id, r); },
      resolve: async (r) => { reviews.set(r.id, r); return "resolved"; },
    },
    importItems: toImportItemPort(() => importItems),
    syncRuns: {
      findById: async (id) => syncRuns.get(id),
      findLatest: async () => undefined,
      findLastSuccess: async () => undefined,
      claimActive: async (run) => { syncRuns.set(run.id, run); return "claimed"; },
      save: async (run) => { syncRuns.set(run.id, run); },
    },
    ids,
    transactions: {
      run: async (work) => {
        const pendingVehicles: Vehicle[] = [], pendingIdentities: ExternalVehicleIdentity[] = [], pendingItems: CatalogImportItem[] = [];
        const txVehiclePort = { findById: async (id: string) => vehicles.get(id), listByCompany: async (c: string) => [...vehicles.values()].filter((v) => v.companyId === c), save: async (v: Vehicle) => { pendingVehicles.push(v); if (txCrash.afterVehicleSave) throw new Error("simulated mid-item crash"); } };
        const result = await work({ companies: companyPort, fleets: fleetPort, vehicles: txVehiclePort, vehicleIdentities: { ...toIdentityPort(() => vehicleIdentities), save: async (i: ExternalVehicleIdentity) => { pendingIdentities.push(i); } }, importItems: { ...toImportItemPort(() => importItems), save: async (i: CatalogImportItem) => { pendingItems.push(i); } } });
        for (const v of pendingVehicles) vehicles.set(v.id, v);
        for (const i of pendingIdentities) vehicleIdentities.set(i.id, i);
        for (const i of pendingItems) importItems.set(i.id, i);
        return result;
      },
    },
  };

  return { ports, txCrash, catalog: createCatalogApplication(ports), binding: createCompanyBindingApplication(ports), importer: createImportCatalogApplication(ports), companies, fleets, vehicles, candidates, vehicleIdentities, fleetIdentities, reviews, importItems, syncRuns };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const connection: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "vault:cybermapa/conn-a" };
const connectionHowen: ProviderConnection = { id: "conn-howen", organizationId: "org-a", credentialRef: "vault:howen/conn-a" };

const fakeSource = (candidates: CatalogImportCandidate[]): CatalogImportSource => ({ loadCompleteSnapshot: async () => ({ kind: "complete", candidates }) });
const newRun = (id = "run-1"): CatalogSyncRun => startCatalogSyncRun(id, { organizationId: "org-a", connectionId: connection.id, trigger: "initial", fullSnapshot: true }, new Date("2026-08-09T00:00:00Z"));

async function bindCompany(fixture: ReturnType<typeof createFixture>, label: string) {
  const created = await fixture.catalog.createCompany({ actor: admin, name: label });
  if (created.kind !== "created") throw new Error("expected company creation");
  const staged = await fixture.binding.stageCompanyCandidate({ connection, externalLabel: label });
  await fixture.binding.bindProviderCompany({ actor: admin, candidateId: staged.candidate.id, companyId: created.company.id });
  return created;
}

async function bindConnectionToCompany(fixture: ReturnType<typeof createFixture>, conn: ProviderConnection, companyId: string, label: string) {
  const staged = await fixture.binding.stageCompanyCandidate({ connection: conn, externalLabel: label });
  await fixture.binding.bindProviderCompany({ actor: admin, candidateId: staged.candidate.id, companyId });
}

describe("company binding gates vehicle composition", () => {
  it("stages an unbound company candidate and rejects vehicle composition without creating a Vehicle", async () => {
    const fixture = createFixture();

    const result = await fixture.importer.importCatalog({ connection, run: newRun(), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(result).toEqual({ kind: "completed", counts: { processed: 1, created: 0, linked: 0, reviewed: 0, rejected: 1, absent: 0 }, checkpoint: "ext-1" });
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.candidates.size).toBe(1);
  });

  it("composes the Vehicle once the company is bound in a later run, without duplicating the staged candidate", async () => {
    const fixture = createFixture();
    await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });
    await bindCompany(fixture, "Acme Transport");

    const result = await fixture.importer.importCatalog({ connection, run: newRun("run-2"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(result.kind === "completed" ? result.counts.created : -1).toBe(1);
    expect(fixture.candidates.size).toBe(1);
  });
});

describe("Unassigned placement", () => {
  it("places an unmatched new Vehicle into the Company's Unassigned Fleet and keeps an administrator's later Fleet assignment across a separate re-import", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");

    await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport", normalizedPlate: "ABC123" }]) });
    const [createdVehicle] = [...fixture.vehicles.values()];
    expect(createdVehicle.placement).toEqual({ fleetId: company.unassignedFleet.id, source: "system" });
    expect(createdVehicle.plate).toBe("ABC123");

    const realFleet = await fixture.catalog.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (realFleet.kind !== "created") throw new Error("expected fleet creation");
    await fixture.catalog.assignVehicleFleet({ actor: admin, vehicleId: createdVehicle.id, fleetId: realFleet.fleet.id });
    await fixture.importer.importCatalog({ connection, run: newRun("run-2"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport", normalizedPlate: "ABC123" }]) });
    expect(fixture.vehicles.get(createdVehicle.id)?.placement).toEqual({ fleetId: realFleet.fleet.id, source: "admin" });
    expect(fixture.vehicles.size).toBe(1);
  });
});

describe("duplicate plates route to review, never auto-link", () => {
  it("sends a matching candidate to review instead of auto-linking, and never duplicates that pending review on a later re-import", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");
    await fixture.catalog.createVehicle({ actor: admin, companyId: company.company.id, fleetId: company.unassignedFleet.id, plate: "DUP111" });
    await fixture.catalog.createVehicle({ actor: admin, companyId: company.company.id, fleetId: company.unassignedFleet.id, plate: "DUP111" });
    const candidate = fakeSource([{ externalId: "ext-new", companyLabel: "Acme Transport", normalizedPlate: "DUP111" }]);

    const result = await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: candidate });

    expect(result.kind === "completed" ? result.counts.reviewed : -1).toBe(1);
    expect(fixture.vehicleIdentities.size).toBe(0);
    expect(fixture.vehicles.size).toBe(2);
    expect([...fixture.reviews.values()][0].subject).toBe("vehicle-match");

    await fixture.importer.importCatalog({ connection, run: newRun("run-2"), source: candidate });
    expect(fixture.reviews.size).toBe(1);
  });
});

describe("deterministic bounded batches", () => {
  it("produces the same checkpoint sequence for the same candidate set regardless of the snapshot's array order", async () => {
    const forward: CatalogImportCandidate[] = Array.from({ length: CATALOG_IMPORT_BATCH_SIZE * 2 + 30 }, (_, index) => ({ externalId: `ext-${String(index).padStart(5, "0")}`, companyLabel: "Acme Transport" }));
    const checkpointsFor = async (candidates: CatalogImportCandidate[]) => {
      const fixture = createFixture();
      await bindCompany(fixture, "Acme Transport");
      const seen: Array<string | undefined> = [];
      fixture.ports.syncRuns.save = vi.fn(async (run) => { seen.push(run.checkpoint); });
      await fixture.importer.importCatalog({ connection, run: newRun(), source: fakeSource(candidates) });
      return seen;
    };

    const forwardCheckpoints = await checkpointsFor(forward);
    const reversedCheckpoints = await checkpointsFor([...forward].reverse());

    expect(forwardCheckpoints).toHaveLength(3);
    expect(forwardCheckpoints).toEqual(reversedCheckpoints);
  });
});

describe("resumable checkpoints survive a reordered second snapshot", () => {
  it("resumes from its persisted checkpoint without skipping or reprocessing any externalId, even when the retried fetch reorders the records", async () => {
    const fixture = createFixture();
    await bindCompany(fixture, "Acme Transport");
    const total = CATALOG_IMPORT_BATCH_SIZE * 2 + 15;
    const candidates: CatalogImportCandidate[] = Array.from({ length: total }, (_, index) => ({ externalId: `ext-${String(index).padStart(5, "0")}`, companyLabel: "Acme Transport" }));

    let saveCount = 0;
    const realSave = fixture.ports.syncRuns.save;
    fixture.ports.syncRuns.save = async (run) => { saveCount += 1; if (saveCount === 2) throw new Error("simulated crash"); return realSave(run); };
    const firstAttempt = await fixture.importer.importCatalog({ connection, run: newRun(), source: fakeSource(candidates) });
    expect(firstAttempt).toEqual({ kind: "failed", failure: { category: "internal" } });
    const persistedRun = fixture.syncRuns.get("run-1");
    expect(persistedRun?.checkpoint).toBe(candidates[CATALOG_IMPORT_BATCH_SIZE - 1].externalId);
    expect(fixture.importItems.size).toBe(CATALOG_IMPORT_BATCH_SIZE * 2);
    fixture.ports.syncRuns.save = realSave;
    const resumed = await fixture.importer.importCatalog({ connection, run: persistedRun as CatalogSyncRun, source: fakeSource([...candidates].sort(() => Math.random() - 0.5)) });
    expect(resumed.kind === "completed" ? resumed.counts.processed : -1).toBe(total);
    expect(fixture.importItems.size).toBe(total);
    expect(new Set([...fixture.vehicles.values()].map((v) => v.id)).size).toBe(total);
  });
});

describe("idempotent re-import", () => {
  it("does not duplicate Companies, Fleets, Vehicles, or identities when a fully completed import runs again in a brand-new run", async () => {
    const fixture = createFixture();
    await bindCompany(fixture, "Acme Transport");
    const candidates: CatalogImportCandidate[] = [{ externalId: "ext-1", companyLabel: "Acme Transport", normalizedPlate: "AAA111" }, { externalId: "ext-2", companyLabel: "Acme Transport" }];
    await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource(candidates) });
    const snapshot = { companies: fixture.companies.size, fleets: fixture.fleets.size, vehicles: fixture.vehicles.size, identities: fixture.vehicleIdentities.size, candidates: fixture.candidates.size };

    const result = await fixture.importer.importCatalog({ connection, run: newRun("run-2"), source: fakeSource(candidates) });

    expect(result.kind === "completed" ? result.counts.linked : -1).toBe(2);
    expect({ companies: fixture.companies.size, fleets: fixture.fleets.size, vehicles: fixture.vehicles.size, identities: fixture.vehicleIdentities.size, candidates: fixture.candidates.size }).toEqual(snapshot);
  });
});

describe("full observed scale", () => {
  it("imports 5,542 candidates so every unique externalId reaches exactly one outcome, crossing several batch boundaries", async () => {
    const fixture = createFixture();
    await bindCompany(fixture, "Acme Transport");
    const total = 5542;
    const candidates: CatalogImportCandidate[] = Array.from({ length: total }, (_, index) => ({ externalId: `gps-${String(index).padStart(6, "0")}`, companyLabel: "Acme Transport" }));
    const saveCalls = vi.fn(fixture.ports.syncRuns.save);
    fixture.ports.syncRuns.save = saveCalls;

    const result = await fixture.importer.importCatalog({ connection, run: newRun(), source: fakeSource(candidates) });

    expect(result).toEqual({ kind: "completed", counts: { processed: total, created: total, linked: 0, reviewed: 0, rejected: 0, absent: 0 }, checkpoint: `gps-${String(total - 1).padStart(6, "0")}` });
    expect(saveCalls).toHaveBeenCalledTimes(Math.ceil(total / CATALOG_IMPORT_BATCH_SIZE));
    expect(new Set([...fixture.importItems.values()].map((i) => i.externalId)).size).toBe(total);
  });
});

describe("provider fetch failure leaves canonical state unchanged", () => {
  it("reports the source's failure and writes nothing when the snapshot fetch fails", async () => {
    const fixture = createFixture();
    const failingSource: CatalogImportSource = { loadCompleteSnapshot: async () => ({ kind: "failed", failure: { category: "connectivity" } }) };

    const result = await fixture.importer.importCatalog({ connection, run: newRun(), source: failingSource });

    expect(result).toEqual({ kind: "failed", failure: { category: "connectivity" } });
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.candidates.size).toBe(0);
  });
});

describe("Vehicle and its identity commit together (Finding 1)", () => {
  it("leaves no orphaned Vehicle when the process crashes between the Vehicle write and its identity write, and resume creates exactly one of each", async () => {
    const fixture = createFixture();
    await bindCompany(fixture, "Acme Transport");
    fixture.txCrash.afterVehicleSave = true;

    const attempt = await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });
    expect(attempt).toEqual({ kind: "failed", failure: { category: "internal" } });
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.vehicleIdentities.size).toBe(0);

    fixture.txCrash.afterVehicleSave = false;
    const resumed = await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(resumed.kind === "completed" ? resumed.counts.created : -1).toBe(1);
    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.vehicleIdentities.size).toBe(1);
  });
});

describe("a swallowed placement write reports its real outcome (Finding 6)", () => {
  it("reports rejected instead of linked when the matched identity's Vehicle belongs to a different Company than the currently bound candidate", async () => {
    const fixture = createFixture();
    const companyA = await bindCompany(fixture, "Acme Transport");
    await fixture.importer.importCatalog({ connection, run: newRun("run-1"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });
    const [vehicleUnderA] = [...fixture.vehicles.values()];
    const companyB = await fixture.catalog.createCompany({ actor: admin, name: "Globex" });
    if (companyB.kind !== "created") throw new Error("expected company creation");
    const [candidate] = [...fixture.candidates.values()];
    fixture.candidates.set(candidate.id, { ...candidate, companyId: companyB.company.id });

    const result = await fixture.importer.importCatalog({ connection, run: newRun("run-2"), source: fakeSource([{ externalId: "ext-1", companyLabel: "Acme Transport" }]) });

    expect(result.kind === "completed" ? result.counts.rejected : -1).toBe(1);
    expect(fixture.vehicles.get(vehicleUnderA.id)?.companyId).toBe(companyA.company.id);
  });
});

describe("checkpoint set-change (Finding 3) — decision: self-heals on the next checkpoint-less run", () => {
  it("silently skips a newly-appeared externalId sorting below the current checkpoint, then picks it up on a later run with no checkpoint", async () => {
    const fixture = createFixture();
    await bindCompany(fixture, "Acme Transport");
    const midRun = { ...newRun("run-mid"), checkpoint: "ext-00010" };

    const midResult = await fixture.importer.importCatalog({ connection, run: midRun, source: fakeSource([{ externalId: "ext-00003", companyLabel: "Acme Transport" }, { externalId: "ext-00020", companyLabel: "Acme Transport" }]) });

    expect(midResult.kind === "completed" ? midResult.counts.processed : -1).toBe(1);
    expect([...fixture.importItems.values()].some((item) => item.externalId === "ext-00003")).toBe(false);

    const healedResult = await fixture.importer.importCatalog({ connection, run: newRun("run-full"), source: fakeSource([{ externalId: "ext-00003", companyLabel: "Acme Transport" }]) });

    expect(healedResult.kind === "completed" ? healedResult.counts.created : -1).toBe(1);
  });
});

describe("canonical Fleet union across bound provider identities (Howen fleet binding)", () => {
  it("keeps the canonical Fleet roster as the union of Cybermapa- and Howen-contributed Vehicles, adding Howen's Vehicles alongside the admin-placed ones without touching what Howen never reports", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");
    await bindConnectionToCompany(fixture, connectionHowen, company.company.id, "Acme Transport");
    const realFleet = await fixture.catalog.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (realFleet.kind !== "created") throw new Error("expected fleet creation");
    await fixture.importer.importCatalog({ connection, run: newRun("run-cyber"), source: fakeSource([{ externalId: "cyber-v1", companyLabel: "Acme Transport", normalizedPlate: "AAA111" }, { externalId: "cyber-v2", companyLabel: "Acme Transport", normalizedPlate: "BBB222" }]) });
    const [v1, v2] = [...fixture.vehicles.values()];
    await fixture.catalog.assignVehicleFleet({ actor: admin, vehicleId: v1.id, fleetId: realFleet.fleet.id });
    await fixture.catalog.assignVehicleFleet({ actor: admin, vehicleId: v2.id, fleetId: realFleet.fleet.id });
    fixture.fleetIdentities.set("preseed", { id: "preseed", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route", fleetId: realFleet.fleet.id });

    const result = await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-howen"), source: fakeSource([{ externalId: "howen-d1", companyLabel: "Acme Transport", externalFleetId: "H900", fleetLabel: "North Route" }, { externalId: "howen-d2", companyLabel: "Acme Transport", externalFleetId: "H900", fleetLabel: "North Route" }]) });

    expect(result.kind === "completed" ? result.counts.created : -1).toBe(2);
    expect(fixture.vehicles.size).toBe(4);
    const roster = [...fixture.vehicles.values()].filter((v) => v.placement.fleetId === realFleet.fleet.id).map((v) => v.id).sort();
    expect(roster).toEqual([...fixture.vehicles.values()].map((v) => v.id).sort());
    expect(fixture.vehicles.get(v1.id)?.placement.fleetId).toBe(realFleet.fleet.id);
    expect(fixture.vehicles.get(v2.id)?.placement.fleetId).toBe(realFleet.fleet.id);
  });

  it("does not auto-link a Howen device whose devicename exactly equals an existing Cybermapa Vehicle's plate, creating a separate Vehicle instead of a false merge", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");
    await bindConnectionToCompany(fixture, connectionHowen, company.company.id, "Acme Transport");
    await fixture.importer.importCatalog({ connection, run: newRun("run-cyber"), source: fakeSource([{ externalId: "cyber-v2", companyLabel: "Acme Transport", normalizedPlate: "AA264KK" }]) });
    const [v2] = [...fixture.vehicles.values()];
    const howenCandidates = mapHowenCatalog([{ deviceno: "howen-d1", devicename: "AA264KK", fleetid: "F1", fleetname: "North" }], "Acme Transport");

    const result = await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-howen"), source: fakeSource(howenCandidates) });

    expect(result.kind === "completed" ? { created: result.counts.created, linked: result.counts.linked } : {}).toEqual({ created: 1, linked: 0 });
    expect(fixture.vehicles.size).toBe(2);
    expect(fixture.vehicles.has(v2.id)).toBe(true);
  });
});

describe("Howen Fleet identity pending admin review", () => {
  it("places a new Howen-only Vehicle into the Company's Unassigned Fleet and stages exactly one pending Fleet binding review until an administrator binds it, never auto-binding by label", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");
    await bindConnectionToCompany(fixture, connectionHowen, company.company.id, "Acme Transport");
    const candidate = fakeSource([{ externalId: "howen-v9", companyLabel: "Acme Transport", externalFleetId: "H999", fleetLabel: "West Route" }]);

    const result = await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-1"), source: candidate });

    expect(result.kind === "completed" ? result.counts.created : -1).toBe(1);
    const [vehicle] = [...fixture.vehicles.values()];
    expect(vehicle.placement).toEqual({ fleetId: company.unassignedFleet.id, source: "system" });
    expect([...fixture.reviews.values()].filter((r) => r.subject === "fleet-binding")).toHaveLength(1);

    await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-2"), source: candidate });
    expect([...fixture.reviews.values()].filter((r) => r.subject === "fleet-binding")).toHaveLength(1);
    expect(fixture.fleetIdentities.size).toBe(1);
  });
});

describe("Howen omitting a previously linked Vehicle from a later roster", () => {
  it("leaves a previously Howen-linked Vehicle in its Fleet when a later roster omits it, moving or deleting nothing", async () => {
    const fixture = createFixture();
    const company = await bindCompany(fixture, "Acme Transport");
    await bindConnectionToCompany(fixture, connectionHowen, company.company.id, "Acme Transport");
    const realFleet = await fixture.catalog.createFleet({ actor: admin, companyId: company.company.id, name: "North" });
    if (realFleet.kind !== "created") throw new Error("expected fleet creation");
    fixture.fleetIdentities.set("preseed", { id: "preseed", organizationId: "org-a", connectionId: "conn-howen", entityKind: "fleet", externalId: "H900", label: "north route", fleetId: realFleet.fleet.id });
    await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-1"), source: fakeSource([{ externalId: "howen-v3", companyLabel: "Acme Transport", externalFleetId: "H900", fleetLabel: "North Route" }]) });
    const [v3] = [...fixture.vehicles.values()];
    expect(v3.placement.fleetId).toBe(realFleet.fleet.id);

    await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun("run-2"), source: fakeSource([]) });

    expect(fixture.vehicles.size).toBe(1);
    expect(fixture.vehicles.get(v3.id)?.placement).toEqual({ fleetId: realFleet.fleet.id, source: "system" });
  });
});

describe("Company unavailable gates Howen Fleet composition too", () => {
  it("creates no canonical Fleet, Vehicle, or Fleet-binding review when a Howen connection's Company is not yet bound", async () => {
    const fixture = createFixture();

    const result = await fixture.importer.importCatalog({ connection: connectionHowen, run: newRun(), source: fakeSource([{ externalId: "howen-v1", companyLabel: "Acme Transport", externalFleetId: "H900", fleetLabel: "North Route" }]) });

    expect(result.kind === "completed" ? result.counts.rejected : -1).toBe(1);
    expect(fixture.vehicles.size).toBe(0);
    expect(fixture.fleetIdentities.size).toBe(0);
    expect(fixture.reviews.size).toBe(0);
  });
});
