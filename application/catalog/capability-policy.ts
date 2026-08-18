import { DEFAULT_GLOBAL_CAPABILITY_SOURCE_ORDER, createGlobalCapabilityPolicy, type GlobalCapabilityPolicy } from "@/domain/catalog";
import type { Capability } from "@/domain/catalog";

export type GlobalCapabilityPolicyRepository = {
  find(capability: Capability): Promise<GlobalCapabilityPolicy | undefined>;
  save(policy: GlobalCapabilityPolicy): Promise<void>;
};

export type GlobalCapabilityPolicyApplication = ReturnType<typeof createGlobalCapabilityPolicyApplication>;

export function createGlobalCapabilityPolicyApplication(ports: { policies: GlobalCapabilityPolicyRepository }) {
  async function resolve(capability: Capability) {
    const policy = await ports.policies.find(capability);
    return policy?.sourceOrder ?? DEFAULT_GLOBAL_CAPABILITY_SOURCE_ORDER[capability] ?? [];
  }

  async function overrideDirectGps(sourceId: string) {
    const current = await resolve("gps");
    const sourceOrder = [sourceId, ...current.filter((candidate: string) => candidate !== sourceId)];
    await ports.policies.save(createGlobalCapabilityPolicy({ id: "global:gps", capability: "gps", sourceOrder }));
  }

  return { resolve, overrideDirectGps };
}
