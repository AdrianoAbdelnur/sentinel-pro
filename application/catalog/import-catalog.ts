import {
  bindExternalVehicleIdentity,
  markCatalogImportItemProcessed,
  normalizePlate,
  resolveVehicleMatch,
  stageCatalogImportItem,
  stageExternalVehicleIdentity,
  stageVehicleMatchReview,
  type ActiveCompanyVehicle,
  type CatalogImportItemOutcome,
  type CatalogSyncRun,
  type ExternalVehicleIdentity,
  type ProviderConnection,
  type Vehicle,
} from "@/domain/catalog";

import { createCompanyBindingApplication } from "./bind-provider-company";
import type { ImportCatalogResult } from "./contracts";
import type { CatalogImportCandidate, CatalogImportSource, ImportCatalogPorts } from "./ports";
import { createCatalogApplication } from "./use-cases";

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
  const catalog = createCatalogApplication(ports);

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

  async function processBoundCandidate(
    connection: ProviderConnection,
    companyId: string,
    candidate: CatalogImportCandidate,
    identities: ExternalVehicleIdentity[],
    companyVehiclesCache: Map<string, ActiveCompanyVehicle[]>,
  ): Promise<CatalogImportItemOutcome> {
    const normalizedPlate = candidate.normalizedPlate ?? normalizePlate("");
    const companyVehicles = await loadCompanyVehicles(companyId, connection.organizationId, companyVehiclesCache);
    const match = resolveVehicleMatch(
      { organizationId: connection.organizationId, connectionId: connection.id, companyId, externalId: candidate.externalId, normalizedPlate },
      identities,
      companyVehicles,
    );

    if (match.kind === "review") {
      const existingReview = await ports.reviews.findByConnectionAndExternalId(connection.organizationId, connection.id, candidate.externalId);
      if (!existingReview) {
        await ports.reviews.save(
          stageVehicleMatchReview(ports.ids.create(), { organizationId: connection.organizationId, connectionId: connection.id, companyId, externalId: candidate.externalId, normalizedPlate, candidateVehicleIds: match.candidateVehicleIds }),
        );
      }
      return "reviewed";
    }

    const vehicleId = match.kind === "unmatched" ? ports.ids.create() : match.vehicleId;
    const placed = await catalog.placeVehicleCandidates({ organizationId: connection.organizationId, companyId, candidates: [{ externalRef: vehicleId, plate: candidate.normalizedPlate, label: candidate.label }] });
    if (placed.kind === "placed" && placed.vehicles[0]) {
      const active = toActiveCompanyVehicle(placed.vehicles[0], connection.organizationId);
      if (active) companyVehiclesCache.set(companyId, [...companyVehicles.filter((vehicle) => vehicle.vehicleId !== active.vehicleId), active]);
    }

    if (match.kind === "unmatched" || match.kind === "auto-linked") {
      const identity = bindExternalVehicleIdentity(stageExternalVehicleIdentity(ports.ids.create(), connection, candidate.externalId), vehicleId);
      await ports.vehicleIdentities.save(identity);
      identities.push(identity);
    }

    return match.kind === "unmatched" ? "created" : "linked";
  }

  async function importCatalog({ connection, run, source }: { connection: ProviderConnection; run: CatalogSyncRun; source: CatalogImportSource }): Promise<ImportCatalogResult> {
    const snapshot = await source.loadCompleteSnapshot();
    if (snapshot.kind === "failed") return { kind: "failed", failure: snapshot.failure };

    const sorted = sortByExternalId(snapshot.candidates);
    const remaining = sorted.filter((candidate) => run.checkpoint === undefined || candidate.externalId > (run.checkpoint as string));
    const batches = toBatches(remaining);
    const identities = await ports.vehicleIdentities.listByConnection(connection.organizationId, connection.id);
    const companyVehiclesCache = new Map<string, ActiveCompanyVehicle[]>();
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
          const outcome: CatalogImportItemOutcome = staged.candidate.companyId
            ? await processBoundCandidate(connection, staged.candidate.companyId, candidate, identities, companyVehiclesCache)
            : "rejected";

          await ports.importItems.save(markCatalogImportItemProcessed(item, outcome));
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
