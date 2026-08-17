import { matchAndApplyProviderCandidate, type MatchAndApplyRepositories, type MatchAndApplyResult, type ProviderCandidate } from "@/application/catalog-global/match-and-apply-provider-candidate";
import { normalizePlate } from "@/domain/catalog";

import type { HowenRosterRecord } from "./responses";

export type HowenGlobalCatalogOptions = Readonly<{
  connectionId: string;
  resolveInitialPlacementFleetId(fleet: { externalFleetId: string; label: string }): string | undefined;
}>;

export type HowenSeedRepositories = MatchAndApplyRepositories;

export type HowenSeedDependencies = HowenGlobalCatalogOptions & {
  records: HowenRosterRecord[];
  ids: { create(): string };
  repositories: HowenSeedRepositories;
  transactions: {
    run<T>(work: (repositories: HowenSeedRepositories) => Promise<T>): Promise<T>;
    isConflict(error: unknown): boolean;
  };
};

export type HowenSeedResult = {
  processed: number;
  outcomes: MatchAndApplyResult[];
};

function text(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function isValidatedPlate(value: string): boolean {
  return /^(?:[A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(value);
}

export function mapHowenGlobalCatalog(records: HowenRosterRecord[], options: HowenGlobalCatalogOptions): ProviderCandidate[] {
  const seenExternalIds = new Set<string>();
  const candidates: ProviderCandidate[] = [];

  for (const record of records) {
    const externalId = text(record.deviceno);
    if (!externalId || seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    const rawPlate = text(record.devicename);
    const normalizedPlate = rawPlate === undefined ? undefined : normalizePlate(rawPlate);
    const fleetId = text(record.fleetid);
    const fleetLabel = text(record.fleetname);
    const providerFleetMembership = fleetId && fleetLabel ? { externalFleetId: fleetId, label: fleetLabel } : undefined;
    const placementFleetId = providerFleetMembership === undefined ? undefined : options.resolveInitialPlacementFleetId(providerFleetMembership);

    candidates.push({
      connectionId: options.connectionId,
      externalId,
      ...(rawPlate !== undefined ? { plate: rawPlate } : {}),
      ...(normalizedPlate !== undefined && isValidatedPlate(normalizedPlate) ? { normalizedPlate } : {}),
      ...(placementFleetId !== undefined ? { placementFleetId } : {}),
      ...(providerFleetMembership !== undefined ? { groupEvidence: { connectionId: options.connectionId, kind: "fleet-membership" as const, externalKey: fleetId as string, label: fleetLabel as string, authority: "fallback" as const } } : {}),
      ...(providerFleetMembership !== undefined ? { providerFleetMembership } : {}),
      capabilities: { video: "eligible", videoAlerts: "eligible" },
      presence: "present",
    });
  }

  return candidates;
}

export async function seedHowenCatalog(dependencies: HowenSeedDependencies): Promise<HowenSeedResult> {
  const candidates = mapHowenGlobalCatalog(dependencies.records, dependencies);
  const outcomes: MatchAndApplyResult[] = [];

  for (const candidate of candidates) {
    outcomes.push(await matchAndApplyProviderCandidate({ candidate, ids: dependencies.ids, transactions: dependencies.transactions, ...dependencies.repositories }));
  }

  return { processed: candidates.length, outcomes };
}
