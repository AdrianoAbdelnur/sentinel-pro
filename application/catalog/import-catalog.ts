import {
  bindExternalVehicleIdentity,
  markCatalogImportItemProcessed,
  normalizeFleetName,
  normalizePlate,
  resolveExternalFleetBinding,
  resolveVehicleMatch,
  stageCatalogImportItem,
  stageExternalFleetIdentity,
  stageExternalVehicleIdentity,
  stageFleetBindingReview,
  stageVehicleMatchReview,
  type ActiveCompanyVehicle,
  type CatalogImportItem,
  type CatalogImportItemOutcome,
  type CatalogSyncRun,
  type ExternalFleetIdentity,
  type ExternalVehicleIdentity,
  type Fleet,
  type ProviderConnection,
  type Vehicle,
} from "@/domain/catalog";

import { createCompanyBindingApplication } from "./bind-provider-company";
import type { ImportCatalogResult } from "./contracts";
import type { CatalogImportCandidate, CatalogImportSource, ImportCatalogPorts } from "./ports";
import { computeVehiclePlacement } from "./use-cases";

export const CATALOG_IMPORT_BATCH_SIZE = 200;

function sortByExternalId(candidates: CatalogImportCandidate[]): CatalogImportCandidate[] {
  return [...candidates].sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
}

function toBatches(candidates: CatalogImportCandidate[]): CatalogImportCandidate[][] {
  const batches: CatalogImportCandidate[][] = [];
  for (let index = 0; index < candidates.length; index += CATALOG_IMPORT_BATCH_SIZE) {
    batches.push(candidates.slice(index, index + CATALOG_IMPORT_BATCH_SIZE));
  }
  return batches;
}

function toActiveCompanyVehicle(vehicle: Vehicle, organizationId: string): ActiveCompanyVehicle | undefined {
  return vehicle.plate === undefined
    ? undefined
    : { vehicleId: vehicle.id, organizationId, companyId: vehicle.companyId, normalizedPlate: normalizePlate(vehicle.plate), label: vehicle.label, active: true };
}

export function createImportCatalogApplication(ports: ImportCatalogPorts) {
  const binding = createCompanyBindingApplication(ports);

  async function loadCompanyVehicles(companyId: string, organizationId: string, cache: Map<string, ActiveCompanyVehicle[]>): Promise<ActiveCompanyVehicle[]> {
    const cached = cache.get(companyId);
    if (cached) return cached;
    const loaded = (await ports.vehicles.listByCompany(companyId)).reduce<ActiveCompanyVehicle[]>((accumulator, vehicle) => {
      const active = toActiveCompanyVehicle(vehicle, organizationId);
      return active ? [...accumulator, active] : accumulator;
    }, []);
    cache.set(companyId, loaded);
    return loaded;
  }

  async function loadCompanyFleets(companyId: string, cache: Map<string, Fleet[]>): Promise<Fleet[]> {
    const cached = cache.get(companyId);
    if (cached) return cached;
    const loaded = await ports.fleets.listByCompany(companyId);
    cache.set(companyId, loaded);
    return loaded;
  }

  async function resolveCandidateFleetPlacement(
    connection: ProviderConnection,
    companyId: string,
    candidate: CatalogImportCandidate,
    fleetIdentities: ExternalFleetIdentity[],
  ): Promise<string | undefined> {
    if (!candidate.externalFleetId) return undefined;
    const label = normalizeFleetName(candidate.fleetLabel ?? candidate.externalFleetId);
    const outcome = resolveExternalFleetBinding(
      { organizationId: connection.organizationId, connectionId: connection.id, entityKind: "fleet", externalId: candidate.externalFleetId, label },
      fleetIdentities,
    );
    if (outcome.kind === "reused") return outcome.fleetId;

    const alreadyStaged = fleetIdentities.some((identity) => identity.connectionId === connection.id && identity.externalId === candidate.externalFleetId);
    if (!alreadyStaged) {
      const identity = stageExternalFleetIdentity(ports.ids.create(), connection, candidate.externalFleetId, candidate.fleetLabel ?? candidate.externalFleetId);
      await ports.fleetIdentities.save(identity);
      fleetIdentities.push(identity);
    }

    const existingReview = await ports.reviews.findByConnectionAndExternalId(connection.organizationId, connection.id, candidate.externalFleetId, "fleet-binding");
    if (!existingReview) {
      await ports.reviews.save(
        stageFleetBindingReview(ports.ids.create(), { organizationId: connection.organizationId, connectionId: connection.id, companyId, externalId: candidate.externalFleetId, label: candidate.fleetLabel ?? candidate.externalFleetId, candidateFleetIds: outcome.candidateFleetIds ?? [] }),
      );
    }

    return undefined;
  }

  async function processBoundCandidate(
    connection: ProviderConnection,
    companyId: string,
    candidate: CatalogImportCandidate,
    identities: ExternalVehicleIdentity[],
    fleetIdentities: ExternalFleetIdentity[],
    companyVehiclesCache: Map<string, ActiveCompanyVehicle[]>,
    companyFleetsCache: Map<string, Fleet[]>,
    item: CatalogImportItem,
  ): Promise<CatalogImportItemOutcome> {
    const normalizedPlate = candidate.normalizedPlate ?? normalizePlate("");
    const companyVehicles = await loadCompanyVehicles(companyId, connection.organizationId, companyVehiclesCache);
    const match = resolveVehicleMatch(
      { organizationId: connection.organizationId, connectionId: connection.id, companyId, externalId: candidate.externalId, normalizedPlate },
      identities,
      companyVehicles,
    );

    if (match.kind === "review") {
      const existingReview = await ports.reviews.findByConnectionAndExternalId(connection.organizationId, connection.id, candidate.externalId, "vehicle-match");
      if (!existingReview) {
        await ports.reviews.save(
          stageVehicleMatchReview(ports.ids.create(), { organizationId: connection.organizationId, connectionId: connection.id, companyId, externalId: candidate.externalId, normalizedPlate, candidateVehicleIds: match.candidateVehicleIds }),
        );
      }
      await ports.importItems.save(markCatalogImportItemProcessed(item, "reviewed"));
      return "reviewed";
    }

    const vehicleId = match.kind === "unmatched" ? ports.ids.create() : match.vehicleId;
    const identity = match.kind === "unmatched" || match.kind === "auto-linked"
      ? bindExternalVehicleIdentity(stageExternalVehicleIdentity(ports.ids.create(), connection, candidate.externalId), vehicleId)
      : undefined;
    const fleets = await loadCompanyFleets(companyId, companyFleetsCache);
    const unassignedFleetId = fleets.find((fleet) => fleet.kind === "unassigned")?.id;
    const matchedFleetId = await resolveCandidateFleetPlacement(connection, companyId, candidate, fleetIdentities);

    const outcome = await ports.transactions.run(async (txRepos) => {
      const existingVehicle = await txRepos.vehicles.findById(vehicleId);
      if ((existingVehicle && existingVehicle.companyId !== companyId) || unassignedFleetId === undefined) {
        await txRepos.importItems.save(markCatalogImportItemProcessed(item, "rejected"));
        return { kind: "rejected" as const, vehicle: undefined };
      }
      const vehicle = computeVehiclePlacement(existingVehicle, companyId, unassignedFleetId, fleets, { externalRef: vehicleId, plate: candidate.normalizedPlate, label: candidate.label, matchedFleetId });
      await txRepos.vehicles.save(vehicle);
      if (identity) await txRepos.vehicleIdentities.save(identity);
      const finalOutcome: CatalogImportItemOutcome = match.kind === "unmatched" ? "created" : "linked";
      await txRepos.importItems.save(markCatalogImportItemProcessed(item, finalOutcome));
      return { kind: finalOutcome, vehicle };
    });

    if (outcome.vehicle) {
      if (identity) identities.push(identity);
      const active = toActiveCompanyVehicle(outcome.vehicle, connection.organizationId);
      if (active) companyVehiclesCache.set(companyId, [...companyVehicles.filter((vehicle) => vehicle.vehicleId !== active.vehicleId), active]);
    }
    return outcome.kind;
  }

  async function importCatalog({ connection, run, source }: { connection: ProviderConnection; run: CatalogSyncRun; source: CatalogImportSource }): Promise<ImportCatalogResult> {
    const snapshot = await source.loadCompleteSnapshot();
    if (snapshot.kind === "failed") return { kind: "failed", failure: snapshot.failure };

    const sorted = sortByExternalId(snapshot.candidates);
    const remaining = sorted.filter((candidate) => run.checkpoint === undefined || candidate.externalId > (run.checkpoint as string));
    const batches = toBatches(remaining);
    const identities = await ports.vehicleIdentities.listByConnection(connection.organizationId, connection.id);
    const fleetIdentities = await ports.fleetIdentities.listByConnection(connection.organizationId, connection.id);
    const companyVehiclesCache = new Map<string, ActiveCompanyVehicle[]>();
    const companyFleetsCache = new Map<string, Fleet[]>();
    let counts = { ...run.counts };
    let checkpoint = run.checkpoint;

    try {
      for (const batch of batches) {
        for (const candidate of batch) {
          const existingItem = await ports.importItems.findByRunAndExternalId(connection.organizationId, connection.id, run.id, candidate.externalId);
          if (existingItem?.status === "processed") {
            const priorOutcome = existingItem.outcome;
            counts = { ...counts, processed: counts.processed + 1, ...(priorOutcome ? { [priorOutcome]: counts[priorOutcome] + 1 } : {}) };
            continue;
          }
          const item = existingItem ?? stageCatalogImportItem(ports.ids.create(), { organizationId: connection.organizationId, connectionId: connection.id, runId: run.id, externalId: candidate.externalId });
          if (!existingItem) await ports.importItems.save(item);

          const staged = await binding.stageCompanyCandidate({ connection, externalLabel: candidate.companyLabel });
          let outcome: CatalogImportItemOutcome;
          if (staged.candidate.companyId) {
            outcome = await processBoundCandidate(connection, staged.candidate.companyId, candidate, identities, fleetIdentities, companyVehiclesCache, companyFleetsCache, item);
          } else {
            outcome = "rejected";
            await ports.importItems.save(markCatalogImportItemProcessed(item, outcome));
          }

          counts = { ...counts, processed: counts.processed + 1, [outcome]: counts[outcome] + 1 };
        }
        checkpoint = batch[batch.length - 1]?.externalId ?? checkpoint;
        await ports.syncRuns.save({ ...run, checkpoint, counts });
      }
    } catch {
      return { kind: "failed", failure: { category: "internal" } };
    }

    return { kind: "completed", counts, checkpoint };
  }

  return { importCatalog };
}
