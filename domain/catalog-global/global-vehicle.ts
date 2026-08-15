export type GlobalVehicle = Readonly<{
  id: string;
  normalizedPlate: string;
  plate: string;
  placementFleetId: string;
}>;

export type GlobalVehicleInput = {
  id: string;
  normalizedPlate: string;
  plate: string;
  placementFleetId: string;
};

export function createGlobalVehicle(input: GlobalVehicleInput): GlobalVehicle {
  return Object.freeze({ ...input });
}

export function retainGlobalVehiclePlacement(vehicle: GlobalVehicle, proposedPlacementFleetId: string): GlobalVehicle {
  void proposedPlacementFleetId;
  return vehicle;
}
