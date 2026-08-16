export type ProviderFleetMembership = Readonly<{
  connectionId: string;
  externalFleetId: string;
  vehicleId: string;
  label: string;
}>;

export type ProviderFleetMembershipInput = {
  connectionId: string;
  externalFleetId: string;
  vehicleId: string;
  label: string;
};

export function createProviderFleetMembership(input: ProviderFleetMembershipInput): ProviderFleetMembership {
  return Object.freeze({ ...input });
}
