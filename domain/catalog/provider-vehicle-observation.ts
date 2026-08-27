export type ProviderVehicleObservation = Readonly<{
  id: string;
  contributionId: string;
  connectionId: string;
  deviceId: string;
  providerKey?: string;
  plate?: string;
  normalizedPlate?: string;
  name?: string;
  make?: string;
  model?: string;
  company?: string;
  directFleetId?: string;
  companySourceFleetId?: string;
  companyResolution: "direct" | "ancestor" | "unresolved" | "not-applicable";
  presence?: "present" | "absent";
  active?: boolean;
  observedAt: Date;
}>;

export function createProviderVehicleObservation(input: ProviderVehicleObservation): ProviderVehicleObservation {
  return Object.freeze({ ...input });
}
