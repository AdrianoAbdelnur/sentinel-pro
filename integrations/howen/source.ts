import type { CatalogImportSource, CatalogSnapshotResult } from "@/application/catalog";

import type { HowenClient } from "./client";
import { mapHowenCatalog } from "./map-howen-catalog";

type CreateHowenImportSourceInput = {
  client: HowenClient;
  companyId: string;
};

export function createHowenImportSource({ client, companyId }: CreateHowenImportSourceInput): CatalogImportSource {
  return {
    async loadCompleteSnapshot(): Promise<CatalogSnapshotResult> {
      try {
        const records = await client.fetchRoster();
        const candidates = mapHowenCatalog(records, companyId);

        const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length;
        return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: candidates.length } };
      } catch {
        return { kind: "failed", failure: { category: "internal" } };
      }
    },
  };
}
