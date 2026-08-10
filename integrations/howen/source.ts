import type { CatalogImportSource, CatalogSnapshotResult } from "@/application/catalog";

import type { HowenClient } from "./client";
import { mapHowenCatalog } from "./map-howen-catalog";

type CreateHowenImportSourceInput = {
  client: HowenClient;
  companyLabel: string;
};

export function createHowenImportSource({ client, companyLabel }: CreateHowenImportSourceInput): CatalogImportSource {
  return {
    async loadCompleteSnapshot(): Promise<CatalogSnapshotResult> {
      try {
        const records = await client.fetchRoster();
        const candidates = mapHowenCatalog(records, companyLabel);

        if (records.length > 0 && candidates.length === 0) {
          return { kind: "failed", failure: { category: "invalid-response" } };
        }

        return { kind: "complete", candidates };
      } catch {
        return { kind: "failed", failure: { category: "internal" } };
      }
    },
  };
}
