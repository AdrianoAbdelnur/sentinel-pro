import { createCatalogReview, createCatalogVehicle, createGroupEvidenceBinding, createCatalogGroup, createVehiclePlacement, createProviderContribution, createProviderFleetMembership, normalizeGroupEvidence, type CatalogReview, type CatalogVehicle, type ProviderContribution, type CapabilityStates, type GroupEvidence, type GroupEvidenceBinding, type CatalogGroup } from "@/domain/catalog";

type ProviderFleetMembershipEvidence = Readonly<{ externalFleetId: string; label: string }>;

export type ProviderCandidate = Readonly<{
  connectionId: string;
  externalId: string;
  plate?: string;
  normalizedPlate?: string;
  placementFleetId?: string;
  groupEvidence?: GroupEvidence;
  capabilities: CapabilityStates;
  presence: "present" | "absent";
  providerFleetMembership?: ProviderFleetMembershipEvidence;
  identityConflict?: boolean;
  conflictingVehicleIds?: readonly string[];
}>;

export type MatchAndApplyRepositories = {
  vehicles: {
    findByNormalizedPlate(normalizedPlate: string): Promise<CatalogVehicle | undefined>;
    save(vehicle: CatalogVehicle): Promise<void>;
  };
  contributions: {
    findByConnectionAndExternalId(connectionId: string, externalId: string): Promise<ProviderContribution | undefined>;
    save(contribution: ProviderContribution): Promise<void>;
  };
  reviews: {
    findByConnectionAndExternalId?(connectionId: string, externalId: string): Promise<CatalogReview | undefined>;
    save(review: CatalogReview): Promise<void>;
  };
  memberships?: {
    save(membership: { connectionId: string; externalFleetId: string; vehicleId: string; label: string }): Promise<void>;
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
};

export type MatchAndApplyResult =
  | { kind: "reused" | "matched" | "created"; vehicleId: string; contribution: ProviderContribution }
  | { kind: "review"; review: CatalogReview };

const isNormalizedPlate = (value: string | undefined): value is string => value !== undefined && /^[A-Z0-9]+$/.test(value);

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

async function applyPlacement(repositories: MatchAndApplyRepositories, vehicle: CatalogVehicle, placement: Awaited<ReturnType<typeof resolvePlacement>>): Promise<CatalogVehicle> {
  if (!placement || "review" in placement) return vehicle;
  const current = vehicle.placement;
  const canReplace = !current ? vehicle.placementFleetId === "" || placement.authority === "authoritative" : placement.authority === "authoritative" || current.authority !== "authoritative";
  if (!canReplace || (vehicle.placementFleetId === placement.groupId && current)) return vehicle;
  const updated = createCatalogVehicle({ ...vehicle, placementFleetId: placement.groupId, placement: createVehiclePlacement({ groupId: placement.groupId, authority: placement.authority, evidenceBindingId: placement.evidenceBindingId || undefined, assignedAt: new Date() }) });
  await repositories.vehicles.save(updated);
  return updated;
}

async function saveProviderFleetMembership(
  repositories: MatchAndApplyRepositories,
  candidate: ProviderCandidate,
  vehicleId: string,
): Promise<void> {
  if (!candidate.providerFleetMembership || !repositories.memberships) return;
  await repositories.memberships.save(createProviderFleetMembership({
    connectionId: candidate.connectionId,
    externalFleetId: candidate.providerFleetMembership.externalFleetId,
    vehicleId,
    label: candidate.providerFleetMembership.label,
  }));
}

export async function matchAndApplyProviderCandidate(dependencies: MatchAndApplyDependencies): Promise<MatchAndApplyResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await dependencies.transactions.run(async (repositories) => {
    const placement = await resolvePlacement(repositories, dependencies.candidate, dependencies.ids);
    if (placement && "review" in placement) {
      const existingReview = await repositories.reviews.findByConnectionAndExternalId?.(dependencies.candidate.connectionId, dependencies.candidate.externalId);
      if (existingReview) return { kind: "review", review: existingReview };
      await repositories.reviews.save(placement.review);
      return { kind: "review", review: placement.review };
    }
    const existingContribution = await repositories.contributions.findByConnectionAndExternalId(dependencies.candidate.connectionId, dependencies.candidate.externalId);
    if (existingContribution) {
      const contribution = createProviderContribution({
        ...existingContribution,
        capabilities: { ...existingContribution.capabilities, ...dependencies.candidate.capabilities },
        presence: dependencies.candidate.presence,
      });
      await repositories.contributions.save(contribution);
      const existingVehicle = await repositories.vehicles.findByNormalizedPlate(dependencies.candidate.normalizedPlate ?? "");
      if (existingVehicle) await applyPlacement(repositories, existingVehicle, placement);
      await saveProviderFleetMembership(repositories, dependencies.candidate, existingContribution.vehicleId);
      return { kind: "reused", vehicleId: existingContribution.vehicleId, contribution };
    }

    const existingReview = await repositories.reviews.findByConnectionAndExternalId?.(dependencies.candidate.connectionId, dependencies.candidate.externalId);
    if (existingReview) return { kind: "review", review: existingReview };

    const reviewReason = dependencies.candidate.identityConflict
      ? "conflicting-identity"
      : !isNormalizedPlate(dependencies.candidate.normalizedPlate)
        ? dependencies.candidate.normalizedPlate === undefined ? "missing-plate" : "malformed-plate"
        : undefined;
    if (reviewReason) {
      const review = createCatalogReview({
        id: dependencies.ids.create(),
        connectionId: dependencies.candidate.connectionId,
        externalId: dependencies.candidate.externalId,
        reason: reviewReason,
        ...(dependencies.candidate.normalizedPlate !== undefined ? { normalizedPlate: dependencies.candidate.normalizedPlate } : {}),
        candidateVehicleIds: dependencies.candidate.conflictingVehicleIds ?? [],
      });
      await repositories.reviews.save(review);
      return { kind: "review", review };
    }

    const normalizedPlate = dependencies.candidate.normalizedPlate;
    if (!isNormalizedPlate(normalizedPlate)) throw new Error("Unsafe plate evidence reached matching");
    const matchedVehicle = await repositories.vehicles.findByNormalizedPlate(normalizedPlate);
    if (!matchedVehicle && !placement) {
      const review = createCatalogReview({
        id: dependencies.ids.create(),
        connectionId: dependencies.candidate.connectionId,
        externalId: dependencies.candidate.externalId,
        reason: "missing-placement",
        normalizedPlate,
        candidateVehicleIds: [],
      });
      await repositories.reviews.save(review);
      return { kind: "review", review };
    }
    const vehicle = matchedVehicle ?? createCatalogVehicle({
      id: dependencies.ids.create(),
      normalizedPlate,
      plate: dependencies.candidate.plate ?? normalizedPlate,
      placementFleetId: placement && "groupId" in placement ? placement.groupId : dependencies.candidate.placementFleetId as string,
    });
    const placedVehicle = await applyPlacement(repositories, vehicle, placement);
    if (!matchedVehicle && placedVehicle === vehicle) await repositories.vehicles.save(vehicle);

    const contribution = createProviderContribution({
      id: dependencies.ids.create(),
      connectionId: dependencies.candidate.connectionId,
      externalId: dependencies.candidate.externalId,
      vehicleId: placedVehicle.id,
      capabilities: dependencies.candidate.capabilities,
      presence: dependencies.candidate.presence,
    });
    await repositories.contributions.save(contribution);
    await saveProviderFleetMembership(repositories, dependencies.candidate, vehicle.id);
    return { kind: matchedVehicle ? "matched" : "created", vehicleId: vehicle.id, contribution };
      });
    } catch (error) {
      if (!dependencies.transactions.isConflict(error) || attempt === 2) throw error;
    }
  }
  throw new Error("Matcher transaction attempts exhausted");
}
