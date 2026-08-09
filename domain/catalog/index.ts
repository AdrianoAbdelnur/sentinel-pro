export * from "./entities";
export * from "./policies";
export * from "./company-candidate";
export * from "./fleet-binding";
export * from "./union-projection";
export {
  bindExternalVehicleIdentity,
  normalizePlate,
  resolveExternalVehicleIdentity,
  resolveVehicleMatch,
  stageExternalVehicleIdentity,
} from "./matching";
export type {
  ActiveCompanyVehicle,
  ExternalVehicleIdentity,
  PlateMatchQuery,
  VehicleIdentityCandidate,
  VehicleIdentityMatchOutcome,
  VehicleMatchOutcome,
} from "./matching";
