import type { Capability } from "./capabilities";

export type ProviderDefinition = Readonly<{
  id: string;
  adapterKey: string;
  capabilities: readonly Capability[];
}>;

export type ProviderConnection = Readonly<{
  id: string;
  providerId: string;
  credentialRef: string;
  enabled: boolean;
  cadenceMinutes: number;
}>;

export type ProviderDefinitionInput = {
  id: string;
  adapterKey: string;
  capabilities: readonly Capability[];
};

export type ProviderConnectionInput = {
  id: string;
  providerId: string;
  credentialRef: string;
  enabled: boolean;
  cadenceMinutes: number;
};

export function createProviderDefinition(input: ProviderDefinitionInput): ProviderDefinition {
  return Object.freeze({ ...input, capabilities: Object.freeze([...input.capabilities]) });
}

export function createProviderConnection(input: ProviderConnectionInput): ProviderConnection {
  return Object.freeze({ ...input });
}
