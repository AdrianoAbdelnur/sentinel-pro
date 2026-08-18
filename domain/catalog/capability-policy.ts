import type { Capability } from "./capabilities";

export type CapabilitySourceOrder = readonly string[];
export type CapabilityPolicy = Readonly<{
  id: string;
  capability: Capability;
  sourceOrder: CapabilitySourceOrder;
}>;

export type CapabilityPolicyInput = {
  id: string;
  capability: Capability;
  sourceOrder: CapabilitySourceOrder;
};

export function createCapabilityPolicy(input: CapabilityPolicyInput): CapabilityPolicy {
  return Object.freeze({ ...input, sourceOrder: Object.freeze([...input.sourceOrder]) });
}

export const DEFAULT_CAPABILITY_SOURCE_ORDER: Readonly<Record<string, CapabilitySourceOrder>> = Object.freeze({
  gps: Object.freeze(["cybermapa", "howen"]),
  operationalAlerts: Object.freeze(["cybermapa"]),
  video: Object.freeze(["howen"]),
  videoAlerts: Object.freeze(["howen"]),
});
