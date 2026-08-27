import type { CapabilityStates } from "./capabilities";

export type ProviderContributionPresence = "present" | "absent";

export type ProviderContribution = Readonly<{
  id: string;
  connectionId: string;
  externalId: string;
  vehicleId: string;
  capabilities: CapabilityStates;
  presence: ProviderContributionPresence;
  deviceId?: string;
  observedCompany?: string;
  observedPlate?: string;
  observedName?: string;
  observedMake?: string;
  observedModel?: string;
  observedAt?: Date;
}>;

export type ProviderContributionInput = {
  id: string;
  connectionId: string;
  externalId: string;
  vehicleId: string;
  capabilities: CapabilityStates;
  presence: ProviderContributionPresence;
  deviceId?: string;
  observedCompany?: string;
  observedPlate?: string;
  observedName?: string;
  observedMake?: string;
  observedModel?: string;
  observedAt?: Date;
};

export function createProviderContribution(input: ProviderContributionInput): ProviderContribution {
  return Object.freeze({ ...input, capabilities: Object.freeze({ ...input.capabilities }) });
}
