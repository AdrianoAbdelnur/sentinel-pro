import { DEFAULT_CAPABILITY_SOURCE_ORDER, createCapabilityPolicy, type CapabilityPolicy } from "@/domain/catalog";
import type { Capability } from "@/domain/catalog";

export type CapabilityPolicyRepository = {
  find(capability: Capability): Promise<CapabilityPolicy | undefined>;
  save(policy: CapabilityPolicy): Promise<void>;
};

export type CapabilityPolicyApplication = ReturnType<typeof createCapabilityPolicyApplication>;

export function createCapabilityPolicyApplication(ports: { policies: CapabilityPolicyRepository }) {
  async function resolve(capability: Capability) {
    const policy = await ports.policies.find(capability);
    return policy?.sourceOrder ?? DEFAULT_CAPABILITY_SOURCE_ORDER[capability] ?? [];
  }

  async function overrideDirectGps(sourceId: string) {
    const current = await resolve("gps");
    const sourceOrder = [sourceId, ...current.filter((candidate: string) => candidate !== sourceId)];
    await ports.policies.save(createCapabilityPolicy({ id: "gps", capability: "gps", sourceOrder }));
  }

  return { resolve, overrideDirectGps };
}
