import type { VehiclePlacement } from "./catalog-group";
export type CatalogVehicle = Readonly<{
  id: string;
  normalizedPlate: string;
  plate: string;
  name?: string;
  make?: string;
  model?: string;
  company?: string;
  active?: boolean;
  placementFleetId: string;
  placement?: VehiclePlacement;
}>;

export type CatalogVehicleInput = {
  id: string;
  normalizedPlate: string;
  plate: string;
  placementFleetId: string;
  placement?: VehiclePlacement;
  name?: string;
  make?: string;
  model?: string;
  company?: string;
  active?: boolean;
};

export function createCatalogVehicle(input: CatalogVehicleInput): CatalogVehicle {
  return Object.freeze({ ...input });
}

export function retainCatalogVehiclePlacement(vehicle: CatalogVehicle, proposedPlacementFleetId: string): CatalogVehicle {
  void proposedPlacementFleetId;
  return vehicle;
}
