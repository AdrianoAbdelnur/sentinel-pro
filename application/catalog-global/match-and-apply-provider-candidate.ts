import { createGlobalCatalogReview, createGlobalVehicle, createProviderContribution, createProviderFleetMembership, type GlobalCatalogReview, type GlobalVehicle, type ProviderContribution, type CapabilityStates } from "@/domain/catalog-global";

type ProviderFleetMembershipEvidence = Readonly<{ externalFleetId: string; label: string }>;

export type ProviderCandidate = Readonly<{
  connectionId: string;
  externalId: string;
  plate?: string;
  normalizedPlate?: string;
  placementFleetId?: string;
  capabilities: CapabilityStates;
  presence: "present" | "absent";
  providerFleetMembership?: ProviderFleetMembershipEvidence;
  identityConflict?: boolean;
  conflictingVehicleIds?: readonly string[];
}>;

export type MatchAndApplyRepositories = {
  vehicles: {
    findByNormalizedPlate(normalizedPlate: string): Promise<GlobalVehicle | undefined>;
    save(vehicle: GlobalVehicle): Promise<void>;
  };
  contributions: {
    findByConnectionAndExternalId(connectionId: string, externalId: string): Promise<ProviderContribution | undefined>;
    save(contribution: ProviderContribution): Promise<void>;
  };
  reviews: {
    findByConnectionAndExternalId?(connectionId: string, externalId: string): Promise<GlobalCatalogReview | undefined>;
    save(review: GlobalCatalogReview): Promise<void>;
  };
  memberships?: {
    save(membership: { connectionId: string; externalFleetId: string; vehicleId: string; label: string }): Promise<void>;
  };
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
  | { kind: "review"; review: GlobalCatalogReview };

const isNormalizedPlate = (value: string | undefined): value is string => value !== undefined && /^[A-Z0-9]+$/.test(value);

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
    const existingContribution = await repositories.contributions.findByConnectionAndExternalId(dependencies.candidate.connectionId, dependencies.candidate.externalId);
    if (existingContribution) {
      const contribution = createProviderContribution({
        ...existingContribution,
        capabilities: { ...existingContribution.capabilities, ...dependencies.candidate.capabilities },
        presence: dependencies.candidate.presence,
      });
      await repositories.contributions.save(contribution);
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
      const review = createGlobalCatalogReview({
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
    if (!matchedVehicle && dependencies.candidate.placementFleetId === undefined) {
      const review = createGlobalCatalogReview({
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
    const vehicle = matchedVehicle ?? createGlobalVehicle({
      id: dependencies.ids.create(),
      normalizedPlate,
      plate: dependencies.candidate.plate ?? normalizedPlate,
      placementFleetId: dependencies.candidate.placementFleetId as string,
    });
    if (!matchedVehicle) await repositories.vehicles.save(vehicle);

    const contribution = createProviderContribution({
      id: dependencies.ids.create(),
      connectionId: dependencies.candidate.connectionId,
      externalId: dependencies.candidate.externalId,
      vehicleId: vehicle.id,
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
