import type { Capability } from "./capabilities";

export type Provider = Readonly<{
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

export type ProviderInput = {
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

export function createProvider(input: ProviderInput): Provider {
  return Object.freeze({ ...input, capabilities: Object.freeze([...input.capabilities]) });
}

export function createProviderConnection(input: ProviderConnectionInput): ProviderConnection {
  return Object.freeze({ ...input });
}
