import { describe, expect, it, vi } from "vitest";

import { startCatalogSyncRun, type CatalogImportItem, type CatalogReview, type CatalogSyncRun, type Company, type CompanyCandidate, type ExternalVehicleIdentity, type Fleet, type ProviderConnection, type Vehicle } from "@/domain/catalog";

import { createCompanyBindingApplication } from "./bind-provider-company";
import { CATALOG_IMPORT_BATCH_SIZE, createImportCatalogApplication } from "./import-catalog";
import type { CatalogImportCandidate, CatalogImportSource, ImportCatalogPorts } from "./ports";
import { createCatalogApplication } from "./use-cases";

function createFixture() {
  const companies = new Map<string, Company>();
  const fleets = new Map<string, Fleet>();
  const vehicles = new Map<string, Vehicle>();
  const candidates = new Map<string, CompanyCandidate>();
  const vehicleIdentities = new Map<string, ExternalVehicleIdentity>();
  const reviews = new Map<string, CatalogReview>();
  const importItems = new Map<string, CatalogImportItem>();
  const syncRuns = new Map<string, CatalogSyncRun>();
  let sequence = 0;
  const ids = { create: () => `id-${++sequence}` };

  const companyPort = { findById: async (id: string) => companies.get(id), save: async (c: Company) => { companies.set(c.id, c); } };
  const fleetPort = { findById: async (id: string) => fleets.get(id), listByCompany: async (companyId: string) => [...fleets.values()].filter((f) => f.companyId === companyId), save: async (f: Fleet) => { fleets.set(f.id, f); } };
  const vehiclePort = { findById: async (id: string) => vehicles.get(id), listByCompany: async (companyId: string) => [...vehicles.values()].filter((v) => v.companyId === companyId), save: async (v: Vehicle) => { vehicles.set(v.id, v); } };

  const ports: ImportCatalogPorts = {
    companies: companyPort,
    fleets: fleetPort,
    vehicles: vehiclePort,
    candidates: {
      findById: async (id) => candidates.get(id),
      findByConnectionAndLabel: async (organizationId, connectionId, normalizedLabel) => [...candidates.values()].find((c) => c.organizationId === organizationId && c.connectionId === connectionId && c.normalizedLabel === normalizedLabel),
      save: async (c) => { candidates.set(c.id, c); },
    },
    vehicleIdentities: {
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId) => [...vehicleIdentities.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.externalId === externalId),
      listByConnection: async (organizationId, connectionId) => [...vehicleIdentities.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId),
      listStaleByRun: async () => [],
      save: async (i) => { vehicleIdentities.set(i.id, i); },
    },
    reviews: {
      findById: async (id) => reviews.get(id),
      findByConnectionAndExternalId: async (organizationId, connectionId, externalId) => [...reviews.values()].find((r) => r.organizationId === organizationId && r.connectionId === connectionId && r.externalId === externalId),
      listPendingByOrganization: async (organizationId) => [...reviews.values()].filter((r) => r.organizationId === organizationId && r.status === "pending"),
      save: async (r) => { reviews.set(r.id, r); },
      resolve: async (r) => { reviews.set(r.id, r); return "resolved"; },
    },
    importItems: {
      findByRunAndExternalId: async (organizationId, connectionId, runId, externalId) => [...importItems.values()].find((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.externalId === externalId),
      listPendingByRun: async (organizationId, connectionId, runId) => [...importItems.values()].filter((i) => i.organizationId === organizationId && i.connectionId === connectionId && i.runId === runId && i.status === "pending"),
      save: async (i) => { importItems.set(i.id, i); },
    },
    syncRuns: {
      findById: async (id) => syncRuns.get(id),
      findLatest: async () => undefined,
      findLastSuccess: async () => undefined,
      claimActive: async (run) => { syncRuns.set(run.id, run); return "claimed"; },
      save: async (run) => { syncRuns.set(run.id, run); },
    },
    ids,
    transactions: { run: async (work) => work({ companies: companyPort, fleets: fleetPort }) },
  };

  return { ports, catalog: createCatalogApplication(ports), binding: createCompanyBindingApplication(ports), importer: createImportCatalogApplication(ports), companies, fleets, vehicles, candidates, vehicleIdentities, reviews, importItems, syncRuns };
}

const admin = { userId: "admin-1", organizationId: "org-a", role: "admin" as const };
const connection: ProviderConnection = { id: "conn-cyber", organizationId: "org-a", credentialRef: "vault:cybermapa/conn-a" };

const fakeSource = (candidates: CatalogImportCandidate[]): CatalogImportSource => ({ loadCompleteSnapshot: async () => ({ kind: "complete", candidates }) });
const newRun = (id = "run-1"): CatalogSyncRun => startCatalogSyncRun(id, { organizationId: "org-a", connectionId: connection.id, trigger: "initial", fullSnapshot: true }, new Date("2026-08-09T00:00:00Z"));

async function bindCompany(fixture: ReturnType<typeof createFixture>, label: string) {
  const created = await fixture.catalog.createCompany({ actor: admin, name: label });
  if (created.kind !== "created") throw new Error("expected company creation");
  const staged = await fixture.binding.stageCompanyCandidate({ connection, externalLabel: label });
  await fixture.binding.bindProviderCompany({ actor: admin, candidateId: staged.candidate.id, companyId: created.company.id });
  return created;
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
