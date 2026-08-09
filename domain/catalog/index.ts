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
export {
  CAPABILITY_PRECEDENCE_SCOPES,
  resolveCapabilitySource,
  resolveCapabilitySourceOrder,
  resolveEligibleCapabilitySource,
  SYSTEM_DEFAULT_CAPABILITY_SOURCE_ORDER,
} from "./precedence";
export type {
  Capability,
  CapabilityPolicy,
  CapabilityPolicyScope,
  CapabilityResolution,
  CapabilityScopeIds,
  CapabilitySourceId,
  CapabilitySourceOrder,
  CapabilitySourceStatus,
  CapabilitySourceStatuses,
} from "./precedence";
