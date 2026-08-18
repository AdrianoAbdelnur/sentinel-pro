import type { CapabilityStates } from "./capabilities";

export type ProviderContributionPresence = "present" | "absent";

export type ProviderContribution = Readonly<{
  id: string;
  connectionId: string;
  externalId: string;
  vehicleId: string;
  capabilities: CapabilityStates;
  presence: ProviderContributionPresence;
}>;

export type ProviderContributionInput = {
  id: string;
  connectionId: string;
  externalId: string;
  vehicleId: string;
  capabilities: CapabilityStates;
  presence: ProviderContributionPresence;
};

export function createProviderContribution(input: ProviderContributionInput): ProviderContribution {
  return Object.freeze({ ...input, capabilities: Object.freeze({ ...input.capabilities }) });
}
