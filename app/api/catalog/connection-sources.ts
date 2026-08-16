import type { CatalogImportSource } from "@/application/catalog";
import { createProviderAdapterRegistry, type ProviderAdapterRegistry } from "@/application/catalog-global";
import type { ProviderConnection } from "@/domain/catalog";
import { createDefaultConnectionSourceFactories, type ConnectionSourceFactories, type ConnectionSourceFactory } from "@/integrations/catalog/connection-source-adapters";

const CREDENTIAL_REF_PROVIDER = /^vault:([a-z0-9]+)\//;

export type { ConnectionSourceFactories, ConnectionSourceFactory } from "@/integrations/catalog/connection-source-adapters";
export type ConnectionSourceRegistry = ProviderAdapterRegistry<ProviderConnection, CatalogImportSource>;
type SourceResolver = ConnectionSourceRegistry | ConnectionSourceFactories;

function resolveProvider(connection: ProviderConnection): string | undefined {
  return CREDENTIAL_REF_PROVIDER.exec(connection.credentialRef)?.[1];
}

function isRegistry(registry: SourceResolver): registry is ConnectionSourceRegistry {
  return typeof (registry as ConnectionSourceRegistry).resolve === "function";
}

function resolveFactory(registry: SourceResolver, adapterKey: string): ConnectionSourceFactory | undefined {
  if (isRegistry(registry)) return registry.has(adapterKey) ? (connection) => registry.resolve(adapterKey, connection) : undefined;
  return registry[adapterKey];
}

export function createConnectionSourceRegistry(factories: ConnectionSourceFactories): ConnectionSourceRegistry {
  const registry = createProviderAdapterRegistry<ProviderConnection, CatalogImportSource>();
  for (const [adapterKey, factory] of Object.entries(factories)) registry.register(adapterKey, factory);
  return registry;
}

export function resolveConnectionSource(connection: ProviderConnection, registry: SourceResolver): CatalogImportSource | undefined {
  const provider = resolveProvider(connection);
  if (!provider) return undefined;
  return isRegistry(registry) ? registry.resolve(provider, connection) : resolveFactory(registry, provider)?.(connection);
}

export type ConnectionSourceProblem = "unsupported" | "missing-company-assignment" | "misconfigured";

export function classifyConnectionSourceProblem(connection: ProviderConnection, registry: SourceResolver): ConnectionSourceProblem {
  const provider = resolveProvider(connection);
  if (!provider || (isRegistry(registry) ? !registry.has(provider) : !resolveFactory(registry, provider))) return "unsupported";
  return connection.companyId ? "misconfigured" : "missing-company-assignment";
}

export { createDefaultConnectionSourceFactories };
