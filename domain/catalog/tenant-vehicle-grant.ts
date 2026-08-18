export type TenantVehicleGrant = Readonly<{
  organizationId: string;
  vehicleId: string;
}>;

export type TenantVehicleGrantInput = {
  organizationId: string;
  vehicleId: string;
};

export function createTenantVehicleGrant(input: TenantVehicleGrantInput): TenantVehicleGrant {
  return Object.freeze({ ...input });
}
