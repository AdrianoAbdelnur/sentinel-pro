import { matchAndApplyProviderCandidate, type MatchAndApplyRepositories, type MatchAndApplyResult, type ProviderCandidate } from "@/application/catalog/match-and-apply-provider-candidate";
import { isValidNormalizedPlate, normalizeGroupLabel, normalizePlate } from "@/domain/catalog";

import type { CybermapaVehicleRecord } from "./responses";

export type CybermapaCatalogOptions = Readonly<{
  connectionId: string;
  placementFleetId?: string;
}>;

export type CybermapaSeedRepositories = MatchAndApplyRepositories;

export type CybermapaSeedDependencies = CybermapaCatalogOptions & {
  records: CybermapaVehicleRecord[];
  ids: { create(): string };
  repositories: CybermapaSeedRepositories;
  transactions: {
    run<T>(work: (repositories: CybermapaSeedRepositories) => Promise<T>): Promise<T>;
    isConflict(error: unknown): boolean;
  };
};

export type CybermapaSeedResult = {
  processed: number;
  outcomes: MatchAndApplyResult[];
};

function externalId(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = typeof value === "number" ? String(value) : value.trim();
  return normalized === "" ? undefined : normalized;
}

function plate(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed === "" || trimmed === undefined ? undefined : trimmed;
}

export function mapCybermapaCatalog(records: CybermapaVehicleRecord[], options: CybermapaCatalogOptions): ProviderCandidate[] {
  const seenExternalIds = new Set<string>();
  const candidates: ProviderCandidate[] = [];

  for (const record of records) {
    const id = externalId(record.gps_id);
    if (!id || seenExternalIds.has(id)) continue;
    seenExternalIds.add(id);

    const rawPlate = plate(record.patente);
    const normalizedPlate = rawPlate === undefined ? undefined : normalizePlate(rawPlate) || undefined;
    candidates.push({
      connectionId: options.connectionId,
      externalId: id,
      ...(rawPlate !== undefined ? { plate: rawPlate } : {}),
      ...(normalizedPlate !== undefined && isValidNormalizedPlate(normalizedPlate) ? { normalizedPlate } : {}),
      ...(options.placementFleetId !== undefined ? { placementFleetId: options.placementFleetId } : {}),
      ...(record.nombre_empresa?.trim() ? { groupEvidence: { connectionId: options.connectionId, kind: "company-label" as const, externalKey: normalizeGroupLabel(record.nombre_empresa), label: record.nombre_empresa.trim(), authority: "authoritative" as const } } : {}),
      capabilities: { gps: "eligible", operationalAlerts: "eligible" },
      presence: "present",
    });
  }

  return candidates;
}

export async function seedCybermapaCatalog(dependencies: CybermapaSeedDependencies): Promise<CybermapaSeedResult> {
  const candidates = mapCybermapaCatalog(dependencies.records, dependencies);
  const outcomes: MatchAndApplyResult[] = [];

  for (const candidate of candidates) {
    outcomes.push(await matchAndApplyProviderCandidate({
      candidate,
      ids: dependencies.ids,
      transactions: dependencies.transactions,
      ...dependencies.repositories,
    }));
  }

  return { processed: candidates.length, outcomes };
}
