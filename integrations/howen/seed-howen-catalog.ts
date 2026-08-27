import { matchAndApplyProviderCandidate, type MatchAndApplyRepositories, type MatchAndApplyResult, type ProviderCandidate } from "@/application/catalog/match-and-apply-provider-candidate";
import { isValidNormalizedPlate, normalizePlate } from "@/domain/catalog";

import type { HowenRosterRecord } from "./responses";

export type HowenCatalogOptions = Readonly<{
  connectionId: string;
  resolveInitialPlacementFleetId(fleet: { externalFleetId: string; label: string }): string | undefined;
  resolveFleetCompany?(fleetId: string | undefined): { company?: string; companySourceFleetId?: string; outcome: "direct" | "ancestor" | "unresolved" };
}>;

export type HowenSeedRepositories = MatchAndApplyRepositories;

export type HowenSeedDependencies = HowenCatalogOptions & {
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

export function mapHowenCatalog(records: HowenRosterRecord[], options: HowenCatalogOptions): ProviderCandidate[] {
  const seenExternalIds = new Set<string>();
  const candidates: ProviderCandidate[] = [];

  for (const record of records) {
    const externalId = text(record.deviceno);
    if (!externalId || seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    const rawPlate = text(record.plateno);
    const normalizedPlate = rawPlate === undefined ? undefined : normalizePlate(rawPlate);
    const fleetId = text(record.fleetid);
    const fleetLabel = text(record.fleetname);
    const providerFleetMembership = fleetId && fleetLabel ? { externalFleetId: fleetId, label: fleetLabel } : undefined;
    const placementFleetId = providerFleetMembership === undefined ? undefined : options.resolveInitialPlacementFleetId(providerFleetMembership);
    const company = options.resolveFleetCompany?.(fleetId);

    candidates.push({
      connectionId: options.connectionId,
      externalId,
      ...(rawPlate !== undefined ? { plate: rawPlate } : {}),
      ...(normalizedPlate !== undefined && isValidNormalizedPlate(normalizedPlate) ? { normalizedPlate } : {}),
      ...(placementFleetId !== undefined ? { placementFleetId } : {}),
      ...(providerFleetMembership !== undefined ? { groupEvidence: { connectionId: options.connectionId, kind: "fleet-membership" as const, externalKey: fleetId as string, label: fleetLabel as string, authority: "fallback" as const } } : {}),
      ...(providerFleetMembership !== undefined ? { providerFleetMembership } : {}),
      deviceId: externalId,
      device: {
        kind: text(record.devicetype),
        model: text(record.deviceModel),
      },
      observation: {
        providerKey: "howen",
        plate: rawPlate,
        normalizedPlate,
        name: text(record.devicename),
        ...(company?.company ? { company: company.company } : {}),
        ...(fleetId ? { directFleetId: fleetId } : {}),
        ...(company?.companySourceFleetId ? { companySourceFleetId: company.companySourceFleetId } : {}),
        companyResolution: company?.outcome === "direct" ? "direct" as const : company?.outcome === "ancestor" ? "ancestor" as const : "unresolved" as const,
        observedAt: new Date(),
      },
      capabilities: { gps: "eligible", video: "eligible", videoAlerts: "eligible" },
      presence: "present",
    });
  }

  return candidates;
}

export async function seedHowenCatalog(dependencies: HowenSeedDependencies): Promise<HowenSeedResult> {
  const candidates = mapHowenCatalog(dependencies.records, dependencies);
  const outcomes: MatchAndApplyResult[] = [];

  for (const candidate of candidates) {
    outcomes.push(await matchAndApplyProviderCandidate({ candidate, ids: dependencies.ids, transactions: dependencies.transactions, ...dependencies.repositories }));
  }

  return { processed: candidates.length, outcomes };
}
