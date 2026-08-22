export type OrganizationVehicleAccess = Readonly<{
  organizationId: string;
  vehicleId: string;
}>;

export type OrganizationVehicleAccessInput = {
  organizationId: string;
  vehicleId: string;
};

export function createOrganizationVehicleAccess(input: OrganizationVehicleAccessInput): OrganizationVehicleAccess {
  return Object.freeze({ ...input });
}
