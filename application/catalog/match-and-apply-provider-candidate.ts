import { createCatalogReview, createCatalogVehicle, createGroupEvidenceBinding, createCatalogGroup, createVehiclePlacement, createProviderContribution, createProviderFleetMembership, normalizeGroupEvidence, isEligibleLegacyPlateReview, normalizePlate, isValidNormalizedPlate, type CatalogReview, type CatalogVehicle, type ProviderContribution, type CapabilityStates, type GroupEvidence, type GroupEvidenceBinding, type CatalogGroup, type CatalogDevice, type ProviderVehicleObservation } from "@/domain/catalog";
import { reconcileCanonicalVehicle } from "./reconcile-canonical-vehicle";

type ProviderFleetMembershipEvidence = Readonly<{ externalFleetId: string; label: string }>;

export type ProviderCandidate = Readonly<{
  connectionId: string;
  externalId: string;
  deviceId?: string;
  plate?: string;
  normalizedPlate?: string;
  placementFleetId?: string;
  groupEvidence?: GroupEvidence;
  capabilities: CapabilityStates;
  presence: "present" | "absent";
  providerFleetMembership?: ProviderFleetMembershipEvidence;
  identityConflict?: boolean;
  conflictingVehicleIds?: readonly string[];
  device?: Omit<CatalogDevice, "id" | "vehicleId" | "connectionId" | "deviceId" | "capabilities" | "presence">;
  observation?: Omit<ProviderVehicleObservation, "id" | "contributionId" | "connectionId" | "deviceId">;
}>;

export type MatchAndApplyRepositories = {
  vehicles: {
    findById?(id: string): Promise<CatalogVehicle | undefined>;
    findByNormalizedPlate(normalizedPlate: string): Promise<CatalogVehicle | undefined>;
    findAllByNormalizedPlate?(normalizedPlate: string): Promise<CatalogVehicle[]>;
    save(vehicle: CatalogVehicle): Promise<void>;
  };
  devices?: {
    findByConnectionAndDeviceId(connectionId: string, deviceId: string): Promise<CatalogDevice | undefined>;
    listByVehicleId?(vehicleId: string): Promise<CatalogDevice[]>;
    save(device: CatalogDevice): Promise<void>;
  };
  contributions: {
    findByConnectionAndExternalId(connectionId: string, externalId: string): Promise<ProviderContribution | undefined>;
    save(contribution: ProviderContribution): Promise<void>;
  };
  reviews: {
    findByConnectionAndExternalId?(connectionId: string, externalId: string): Promise<CatalogReview | undefined>;
    save(review: CatalogReview): Promise<void>;
  };
  observations?: { save(observation: ProviderVehicleObservation): Promise<void>; listByVehicleId?(vehicleId: string): Promise<ProviderVehicleObservation[]> };
  conflicts?: { save(conflict: import("@/domain/catalog").CatalogConflict): Promise<void>; findByVehicleId?(vehicleId: string): Promise<import("@/domain/catalog").CatalogConflict[]> };
  memberships?: {
    save(membership: { connectionId: string; externalFleetId: string; vehicleId: string; label: string }): Promise<void>;
    replaceCurrent?(membership: { connectionId: string; externalFleetId: string; vehicleId: string; label: string }): Promise<void>;
    clearCurrent?(connectionId: string, vehicleId: string): Promise<void>;
  };
  groups?: { findById(id: string): Promise<CatalogGroup | undefined>; findByLabel(label: string): Promise<CatalogGroup[]>; save(group: CatalogGroup): Promise<void> };
  evidenceBindings?: { findByEvidence(connectionId: string, kind: string, externalKey: string): Promise<GroupEvidenceBinding[]>; save(binding: GroupEvidenceBinding): Promise<void> };
};

export type MatchAndApplyDependencies = MatchAndApplyRepositories & {
  ids: { create(): string };
  transactions: {
    run<T>(work: (repositories: MatchAndApplyRepositories) => Promise<T>): Promise<T>;
    isConflict(error: unknown): boolean;
  };
  candidate: ProviderCandidate;
  canonicalSourcePrecedence?: readonly string[];
};

export type MatchAndApplyResult =
  | { kind: "reused" | "matched" | "created"; vehicleId: string; contribution: ProviderContribution }
  | { kind: "review"; review: CatalogReview };

const isNormalizedPlate = (value: string | undefined): value is string => value !== undefined && isValidNormalizedPlate(value);
const candidateDeviceId = (candidate: ProviderCandidate): string => candidate.deviceId?.trim() || candidate.externalId.trim();
const candidateNormalizedPlate = (candidate: ProviderCandidate): string | undefined => {
  const evidence = candidate.plate ?? candidate.normalizedPlate;
  if (!evidence?.trim()) return undefined;
  const normalized = normalizePlate(evidence);
  return isValidNormalizedPlate(normalized) ? normalized : undefined;
};
const deviceCapabilities = (candidate: ProviderCandidate): Record<string, "eligible" | "absent" | "unsupported" | "stale" | "unavailable"> => Object.fromEntries(Object.entries(candidate.capabilities).filter((entry): entry is [string, "eligible" | "absent" | "unsupported" | "stale" | "unavailable"] => entry[1] !== undefined));

async function refreshCanonical(repositories: MatchAndApplyRepositories, vehicle: CatalogVehicle, observation: ProviderVehicleObservation | undefined, sourcePrecedence?: readonly string[]): Promise<void> {
  if (!observation || !repositories.observations?.listByVehicleId) return;
  const result = reconcileCanonicalVehicle(vehicle, await repositories.observations.listByVehicleId(vehicle.id), sourcePrecedence, await repositories.devices?.listByVehicleId?.(vehicle.id));
  if (result.vehicle !== vehicle) await repositories.vehicles.save(result.vehicle);
  if (repositories.conflicts) {
    if (result.conflict) await repositories.conflicts.save(result.conflict);
    else if (repositories.conflicts.findByVehicleId) {
      for (const conflict of await repositories.conflicts.findByVehicleId(vehicle.id)) {
        if (conflict.status === "open") await repositories.conflicts.save({ ...conflict, status: "resolved" });
      }
    }
  }
}

async function resolvePlacement(
  repositories: MatchAndApplyRepositories,
  candidate: ProviderCandidate,
  ids: { create(): string },
): Promise<{ groupId: string; authority: "authoritative" | "fallback"; evidenceBindingId: string } | { review: CatalogReview } | undefined> {
  if (!candidate.groupEvidence || !repositories.groups || !repositories.evidenceBindings) {
    return candidate.placementFleetId === undefined ? undefined : { groupId: candidate.placementFleetId, authority: "fallback", evidenceBindingId: "" };
  }
  const evidence = normalizeGroupEvidence(candidate.groupEvidence);
  const matches = await repositories.evidenceBindings.findByEvidence(evidence.connectionId, evidence.kind, evidence.externalKey);
  if (matches.length > 1) {
    return { review: createCatalogReview({ id: ids.create(), connectionId: candidate.connectionId, externalId: candidate.externalId, reason: "ambiguous-group-evidence", normalizedPlate: candidate.normalizedPlate, candidateVehicleIds: [], evidenceKey: evidence.externalKey, candidateGroupIds: matches.map((match) => match.groupId) }) };
  }
  if (matches.length === 1) {
    if (matches[0].evidence.label !== evidence.label) await repositories.evidenceBindings.save(createGroupEvidenceBinding({ ...matches[0], evidence }));
    return { groupId: matches[0].groupId, authority: evidence.authority, evidenceBindingId: matches[0].id };
  }
  const labelMatches = await repositories.groups.findByLabel(evidence.label);
  if (labelMatches.length > 1) return { review: createCatalogReview({ id: ids.create(), connectionId: candidate.connectionId, externalId: candidate.externalId, reason: "ambiguous-group-evidence", normalizedPlate: candidate.normalizedPlate, candidateVehicleIds: [], evidenceKey: evidence.externalKey, candidateGroupIds: labelMatches.map((group) => group.id) }) };
  const existingGroup = labelMatches[0];
  if (existingGroup) {
    const binding = createGroupEvidenceBinding({ id: ids.create(), groupId: existingGroup.id, evidence });
    await repositories.evidenceBindings.save(binding);
    return { groupId: existingGroup.id, authority: evidence.authority, evidenceBindingId: binding.id };
  }
  const group = createCatalogGroup({ id: ids.create(), label: evidence.label });
  const binding = createGroupEvidenceBinding({ id: ids.create(), groupId: group.id, evidence });
  await repositories.groups.save(group);
  await repositories.evidenceBindings.save(binding);
  return { groupId: group.id, authority: evidence.authority, evidenceBindingId: binding.id };
}

async function applyPlacement(repositories: MatchAndApplyRepositories, vehicle: CatalogVehicle, placement: Awaited<ReturnType<typeof resolvePlacement>>, allowInitialPlacement = false): Promise<CatalogVehicle> {
  if (!placement || "review" in placement) return vehicle;
  const current = vehicle.placement;
  const canReplace = allowInitialPlacement && !current;
  if (!canReplace || (vehicle.placementFleetId === placement.groupId && current)) return vehicle;
  const updated = createCatalogVehicle({ ...vehicle, placementFleetId: placement.groupId, placement: createVehiclePlacement({ groupId: placement.groupId, authority: placement.authority, ...(placement.evidenceBindingId ? { evidenceBindingId: placement.evidenceBindingId } : {}), assignedAt: new Date() }) });
  await repositories.vehicles.save(updated);
  return updated;
}

async function saveProviderFleetMembership(
  repositories: MatchAndApplyRepositories,
  candidate: ProviderCandidate,
  vehicleId: string,
): Promise<void> {
  if (!repositories.memberships) return;
  if (!candidate.providerFleetMembership) {
    await repositories.memberships.clearCurrent?.(candidate.connectionId, vehicleId);
    return;
  }
  const membership = createProviderFleetMembership({
    connectionId: candidate.connectionId,
    externalFleetId: candidate.providerFleetMembership.externalFleetId,
    vehicleId,
    label: candidate.providerFleetMembership.label,
  });
  if (repositories.memberships.replaceCurrent) await repositories.memberships.replaceCurrent(membership);
  else await repositories.memberships.save(membership);
}

export async function matchAndApplyProviderCandidate(dependencies: MatchAndApplyDependencies): Promise<MatchAndApplyResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await dependencies.transactions.run(async (repositories) => {
    const normalizedCandidatePlate = candidateNormalizedPlate(dependencies.candidate);
    const candidate = { ...dependencies.candidate, normalizedPlate: normalizedCandidatePlate };
    const deviceId = candidateDeviceId(candidate);
    const existingDevice = await repositories.devices?.findByConnectionAndDeviceId(candidate.connectionId, deviceId);
    const contributionByDevice = await repositories.contributions.findByConnectionAndExternalId(candidate.connectionId, deviceId);
    const contributionByExternalId = candidate.externalId === deviceId
      ? contributionByDevice
      : await repositories.contributions.findByConnectionAndExternalId(candidate.connectionId, candidate.externalId);
    const linkedVehicleIds = [...new Set([existingDevice?.vehicleId, contributionByDevice?.vehicleId, contributionByExternalId?.vehicleId].filter((value): value is string => value !== undefined))];
    if (linkedVehicleIds.length > 1) {
      const previous = await repositories.reviews.findByConnectionAndExternalId?.(candidate.connectionId, deviceId);
      if (previous) return { kind: "review", review: previous };
      const conflictReview = createCatalogReview({ id: dependencies.ids.create(), connectionId: candidate.connectionId, externalId: deviceId, reason: "conflicting-identity", candidateVehicleIds: linkedVehicleIds });
      await repositories.reviews.save(conflictReview);
      return { kind: "review", review: conflictReview };
    }
    const existingContribution = contributionByDevice ?? contributionByExternalId;
    const legacyReview = await repositories.reviews.findByConnectionAndExternalId?.(candidate.connectionId, deviceId);
    if (legacyReview && !isEligibleLegacyPlateReview(legacyReview)) return { kind: "review", review: legacyReview };
    const placement = await resolvePlacement(repositories, candidate, dependencies.ids);
    if (placement && "review" in placement) {
      const existingReview = await repositories.reviews.findByConnectionAndExternalId?.(candidate.connectionId, candidate.externalId);
      if (existingReview) return { kind: "review", review: existingReview };
      if (legacyReview) return { kind: "review", review: legacyReview };
      await repositories.reviews.save(placement.review);
      return { kind: "review", review: placement.review };
    }
    const existingVehicleId = existingDevice?.vehicleId ?? existingContribution?.vehicleId;
    if (existingVehicleId) {
      const plateMatches = isNormalizedPlate(candidate.normalizedPlate)
        ? repositories.vehicles.findAllByNormalizedPlate
          ? await repositories.vehicles.findAllByNormalizedPlate(candidate.normalizedPlate)
          : ((await repositories.vehicles.findByNormalizedPlate(candidate.normalizedPlate)) ? [await repositories.vehicles.findByNormalizedPlate(candidate.normalizedPlate) as CatalogVehicle] : [])
        : [];
      const conflictingVehicleIds = [...new Set([existingVehicleId, ...plateMatches.map((vehicle) => vehicle.id)])];
      if (conflictingVehicleIds.some((vehicleId) => vehicleId !== existingVehicleId)) {
        const review = legacyReview
          ? { ...legacyReview, reason: "conflicting-identity" as const, normalizedPlate: candidate.normalizedPlate, candidateVehicleIds: conflictingVehicleIds }
          : createCatalogReview({ id: dependencies.ids.create(), connectionId: candidate.connectionId, externalId: deviceId, reason: "conflicting-identity", normalizedPlate: candidate.normalizedPlate, candidateVehicleIds: conflictingVehicleIds });
        await repositories.reviews.save(review);
        return { kind: "review", review };
      }
      const contribution = createProviderContribution({
        ...(existingContribution ?? { id: dependencies.ids.create(), connectionId: candidate.connectionId, externalId: candidate.externalId, vehicleId: existingVehicleId, capabilities: {} }),
        deviceId,
        capabilities: candidate.capabilities,
        presence: candidate.presence,
        observedCompany: candidate.observation?.company,
        observedPlate: candidate.observation?.plate,
        observedName: candidate.observation?.name,
        observedMake: candidate.observation?.make,
        observedModel: candidate.observation?.model,
        observedAt: candidate.observation?.observedAt,
      });
      await repositories.contributions.save(contribution);
      const existingVehicle = await repositories.vehicles.findById?.(existingVehicleId) ?? await repositories.vehicles.findByNormalizedPlate(candidate.normalizedPlate ?? "");
      if (existingVehicle) await applyPlacement(repositories, existingVehicle, placement);
      if (repositories.devices) await repositories.devices.save({ id: existingDevice?.id ?? dependencies.ids.create(), vehicleId: existingVehicleId, connectionId: candidate.connectionId, deviceId, kind: candidate.device?.kind, make: candidate.device?.make, model: candidate.device?.model, status: candidate.device?.status, capabilities: deviceCapabilities(candidate), presence: candidate.presence });
      const currentObservation = repositories.observations && candidate.observation ? { id: `observation:${contribution.id}`, contributionId: contribution.id, connectionId: candidate.connectionId, deviceId, providerKey: candidate.observation.providerKey, plate: candidate.observation.plate, normalizedPlate: candidate.observation.normalizedPlate, name: candidate.observation.name, make: candidate.observation.make, model: candidate.observation.model, company: candidate.observation.company, directFleetId: candidate.observation.directFleetId, companySourceFleetId: candidate.observation.companySourceFleetId, companyResolution: candidate.observation.companyResolution, presence: candidate.presence, active: candidate.presence === "present" && candidate.device?.status === "active", observedAt: candidate.observation.observedAt } : undefined;
      if (currentObservation) await repositories.observations!.save(currentObservation);
      if (existingVehicle) await refreshCanonical(repositories, existingVehicle, currentObservation, dependencies.canonicalSourcePrecedence);
      await saveProviderFleetMembership(repositories, candidate, existingVehicleId);
      if (legacyReview && isEligibleLegacyPlateReview(legacyReview)) await repositories.reviews.save({ ...legacyReview, status: "resolved", resolvedVehicleId: existingVehicleId });
      return { kind: "reused", vehicleId: existingVehicleId, contribution };
    }

    const existingReview = legacyReview;
    if (existingReview && !isEligibleLegacyPlateReview(existingReview)) return { kind: "review", review: existingReview };

    const reviewReason = candidate.identityConflict
      ? "conflicting-identity"
      : undefined;
    if (reviewReason) {
      const review = createCatalogReview({
        id: dependencies.ids.create(),
        connectionId: candidate.connectionId,
        externalId: candidate.externalId,
        reason: reviewReason,
        ...(candidate.normalizedPlate !== undefined ? { normalizedPlate: candidate.normalizedPlate } : {}),
        candidateVehicleIds: candidate.conflictingVehicleIds ?? [],
      });
      await repositories.reviews.save(review);
      return { kind: "review", review };
    }

    const normalizedPlate = candidate.normalizedPlate;
    const matches = isNormalizedPlate(normalizedPlate)
      ? repositories.vehicles.findAllByNormalizedPlate ? await repositories.vehicles.findAllByNormalizedPlate(normalizedPlate) : ((await repositories.vehicles.findByNormalizedPlate(normalizedPlate)) ? [await repositories.vehicles.findByNormalizedPlate(normalizedPlate) as CatalogVehicle] : [])
      : [];
    if (matches.length > 1) {
      const review = createCatalogReview({ id: dependencies.ids.create(), connectionId: candidate.connectionId, externalId: candidate.externalId, reason: "ambiguous-match", normalizedPlate, candidateVehicleIds: matches.map((vehicle) => vehicle.id) });
      await repositories.reviews.save(review);
      return { kind: "review", review };
    }
    const matchedVehicle = matches[0];
    const vehicle = matchedVehicle ?? createCatalogVehicle({
      id: dependencies.ids.create(),
      normalizedPlate: normalizedPlate ?? "",
      plate: candidate.plate ?? normalizedPlate ?? "",
      placementFleetId: placement && "groupId" in placement ? placement.groupId : candidate.placementFleetId ?? "",
      ...(candidate.observation?.name ? { name: candidate.observation.name } : {}),
      ...(candidate.observation?.make ? { make: candidate.observation.make } : {}),
      ...(candidate.observation?.model ? { model: candidate.observation.model } : {}),
      ...(candidate.observation?.company ? { company: candidate.observation.company } : {}),
      active: candidate.presence === "present" && candidate.device?.status === "active",
    });
    const placedVehicle = await applyPlacement(repositories, vehicle, placement, !matchedVehicle);
    if (!matchedVehicle && placedVehicle === vehicle) await repositories.vehicles.save(vehicle);

    const contribution = createProviderContribution({
      id: dependencies.ids.create(),
      connectionId: candidate.connectionId,
      externalId: candidate.externalId,
      deviceId,
      vehicleId: placedVehicle.id,
      capabilities: candidate.capabilities,
      presence: candidate.presence,
      ...(candidate.observation?.company ? { observedCompany: candidate.observation.company } : {}),
      ...(candidate.observation?.plate ? { observedPlate: candidate.observation.plate } : {}),
      ...(candidate.observation?.observedAt ? { observedAt: candidate.observation.observedAt } : {}),
      ...(candidate.observation?.name ? { observedName: candidate.observation.name } : {}),
      ...(candidate.observation?.make ? { observedMake: candidate.observation.make } : {}),
      ...(candidate.observation?.model ? { observedModel: candidate.observation.model } : {}),
    });
    await repositories.contributions.save(contribution);
    if (repositories.devices) await repositories.devices.save({ id: dependencies.ids.create(), vehicleId: placedVehicle.id, connectionId: candidate.connectionId, deviceId, kind: candidate.device?.kind, make: candidate.device?.make, model: candidate.device?.model, status: candidate.device?.status, capabilities: deviceCapabilities(candidate), presence: candidate.presence });
    const currentObservation = repositories.observations && candidate.observation ? { id: `observation:${contribution.id}`, contributionId: contribution.id, connectionId: candidate.connectionId, deviceId, providerKey: candidate.observation.providerKey, plate: candidate.observation.plate, normalizedPlate: candidate.observation.normalizedPlate, name: candidate.observation.name, make: candidate.observation.make, model: candidate.observation.model, company: candidate.observation.company, directFleetId: candidate.observation.directFleetId, companySourceFleetId: candidate.observation.companySourceFleetId, companyResolution: candidate.observation.companyResolution, presence: candidate.presence, active: candidate.presence === "present" && candidate.device?.status === "active", observedAt: candidate.observation.observedAt } : undefined;
    if (currentObservation) await repositories.observations!.save(currentObservation);
    await refreshCanonical(repositories, placedVehicle, currentObservation, dependencies.canonicalSourcePrecedence);
    if (existingReview && isEligibleLegacyPlateReview(existingReview)) await repositories.reviews.save({ ...existingReview, status: "resolved", resolvedVehicleId: placedVehicle.id });
    await saveProviderFleetMembership(repositories, candidate, vehicle.id);
    return { kind: matchedVehicle ? "matched" : "created", vehicleId: vehicle.id, contribution };
      });
    } catch (error) {
      if (!dependencies.transactions.isConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Matcher transaction attempts exhausted");
}
