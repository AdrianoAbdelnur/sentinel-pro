export type Capability = string;

export type CapabilitySourceStatus = "eligible" | "absent" | "unsupported" | "stale" | "unavailable";

export type CapabilityStates = Partial<Record<Capability, CapabilitySourceStatus>>;
