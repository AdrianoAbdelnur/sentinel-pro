import type { CatalogImportSource } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import { createCybermapaClient } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { createCybermapaImportSource } from "@/integrations/cybermapa/source";
import { createHowenClient, type HowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { createHowenImportSource } from "@/integrations/howen/source";

const CREDENTIAL_REF_PROVIDER = /^vault:([a-z0-9]+)\//;

export type ConnectionSourceFactory = (connection: ProviderConnection) => CatalogImportSource | undefined;
export type ConnectionSourceFactories = Record<string, ConnectionSourceFactory>;

function resolveProvider(connection: ProviderConnection): string | undefined {
  return CREDENTIAL_REF_PROVIDER.exec(connection.credentialRef)?.[1];
}

export function resolveConnectionSource(connection: ProviderConnection, factories: ConnectionSourceFactories): CatalogImportSource | undefined {
  const provider = resolveProvider(connection);
  return provider ? factories[provider]?.(connection) : undefined;
}

export type ConnectionSourceProblem = "unsupported" | "missing-company-assignment" | "misconfigured";

export function classifyConnectionSourceProblem(connection: ProviderConnection, factories: ConnectionSourceFactories): ConnectionSourceProblem {
  const provider = resolveProvider(connection);
  if (!provider || !factories[provider]) return "unsupported";
  return connection.companyId ? "misconfigured" : "missing-company-assignment";
}

function createHowenConnectionFactory(): ConnectionSourceFactory {
  let client: HowenClient | undefined;
  return (connection) => {
    if (!connection.companyId) return undefined;
    try {
      if (!client) {
        const config = readHowenConfig();
        client = createHowenClient({ config, session: createHowenSessionManager({ config }) });
      }
      return createHowenImportSource({ client, companyId: connection.companyId });
    } catch {
      return undefined;
    }
  };
}

export function createDefaultConnectionSourceFactories(): ConnectionSourceFactories {
  return {
    cybermapa: () => createCybermapaImportSource({ client: createCybermapaClient({ config: readCybermapaConfig() }) }),
    howen: createHowenConnectionFactory(),
  };
}
