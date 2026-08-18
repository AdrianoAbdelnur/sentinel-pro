import type { Capability } from "./capabilities";

export type GlobalCapabilitySourceOrder = readonly string[];
export type GlobalCapabilityPolicy = Readonly<{
  id: string;
  capability: Capability;
  sourceOrder: GlobalCapabilitySourceOrder;
}>;

export type GlobalCapabilityPolicyInput = {
  id: string;
  capability: Capability;
  sourceOrder: GlobalCapabilitySourceOrder;
};

export function createGlobalCapabilityPolicy(input: GlobalCapabilityPolicyInput): GlobalCapabilityPolicy {
  return Object.freeze({ ...input, sourceOrder: Object.freeze([...input.sourceOrder]) });
}

export const DEFAULT_GLOBAL_CAPABILITY_SOURCE_ORDER: Readonly<Record<string, GlobalCapabilitySourceOrder>> = Object.freeze({
  gps: Object.freeze(["cybermapa", "howen"]),
  operationalAlerts: Object.freeze(["cybermapa"]),
  video: Object.freeze(["howen"]),
  videoAlerts: Object.freeze(["howen"]),
});
