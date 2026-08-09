export type Company = {
  id: string;
  organizationId: string;
  name: string;
};

export type FleetKind = "standard" | "unassigned";

export type Fleet = {
  id: string;
  companyId: string;
  name: string;
  kind: FleetKind;
};

export type VehicleOrigin = "native" | "provider";
export type PlacementSource = "system" | "admin";

export type VehiclePlacement = {
  fleetId: string;
  source: PlacementSource;
};

export type Vehicle = {
  id: string;
  companyId: string;
  origin: VehicleOrigin;
  placement: VehiclePlacement;
  label?: string;
  plate?: string;
  internalCode?: string;
};
