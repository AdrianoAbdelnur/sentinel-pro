import type { CatalogSyncFailure, CatalogSyncRun, CatalogSyncTrigger } from "@/domain/catalog";

import type { CatalogImportSource } from "./ports";

export type SynchronizeCatalogConnectionInput = {
  organizationId: string;
  connectionId: string;
  trigger: CatalogSyncTrigger;
  source: CatalogImportSource;
};

export type CatalogSyncOutcome =
  | { kind: "succeeded"; run: CatalogSyncRun }
  | { kind: "skipped-fresh"; lastSuccessAt: Date }
  | { kind: "already-running" }
  | { kind: "retryable-failure"; run: CatalogSyncRun; failure: CatalogSyncFailure }
  | { kind: "not-found" };
