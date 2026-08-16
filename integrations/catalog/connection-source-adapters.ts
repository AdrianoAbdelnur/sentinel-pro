import type { CatalogImportSource } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";
import { createCybermapaClient } from "@/integrations/cybermapa/client";
import { readCybermapaConfig } from "@/integrations/cybermapa/config";
import { createCybermapaImportSource } from "@/integrations/cybermapa/source";
import { createHowenClient, type HowenClient } from "@/integrations/howen/client";
import { readHowenConfig } from "@/integrations/howen/config";
import { createHowenSessionManager } from "@/integrations/howen/session";
import { createHowenImportSource } from "@/integrations/howen/source";

export type ConnectionSourceFactory = (connection: ProviderConnection) => CatalogImportSource | undefined;
export type ConnectionSourceFactories = Record<string, ConnectionSourceFactory>;

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
