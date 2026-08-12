import type { CatalogImportSource, CatalogSnapshotResult } from "@/application/catalog";
import type { CatalogSyncFailure } from "@/domain/catalog";

import { CybermapaRequestError, type CybermapaClient } from "./client";
import { mapCybermapaCatalog } from "./map-cybermapa-catalog";

type CreateCybermapaImportSourceInput = {
  client: CybermapaClient;
};

function toCatalogSyncFailure(error: unknown): CatalogSyncFailure {
  if (error instanceof CybermapaRequestError) {
    return { category: error.category, httpStatus: error.httpStatus };
  }

  return { category: "internal" };
}

export function createCybermapaImportSource({ client }: CreateCybermapaImportSourceInput): CatalogImportSource {
  return {
    async loadCompleteSnapshot(): Promise<CatalogSnapshotResult> {
      try {
        const records = await client.fetchVehicles();
        const candidates = mapCybermapaCatalog(records);

        const receivedRecordCount = (records as typeof records & { receivedRecordCount?: number }).receivedRecordCount ?? records.length;
        return { kind: "complete", candidates, evidence: { retrievalComplete: true, paginationComplete: true, receivedRecordCount, parseableRecordCount: candidates.length } };
      } catch (error) {
        return { kind: "failed", failure: toCatalogSyncFailure(error) };
      }
    },
  };
}
