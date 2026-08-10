import type { CatalogSyncCounts, CatalogSyncFailure, CatalogSyncRun, CatalogSyncRunStatus, CatalogSyncTrigger } from "@/domain/catalog";

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

export type SynchronizeCatalogConnectionUseCase = (input: SynchronizeCatalogConnectionInput) => Promise<CatalogSyncOutcome>;

export type CatalogSyncBatchCandidate = {
  organizationId: string;
  connectionId: string;
  source: CatalogImportSource;
};

export type CatalogSyncBatchOutcome = CatalogSyncOutcome | { kind: "unexpected-failure" };

export type CatalogSyncBatchResult = {
  organizationId: string;
  connectionId: string;
  outcome: CatalogSyncBatchOutcome;
};

export type SynchronizeDueCatalogConnectionsInput = {
  candidates: CatalogSyncBatchCandidate[];
};

export type SynchronizeDueCatalogConnectionsResult = {
  results: CatalogSyncBatchResult[];
};

export type CatalogSyncRunSummary = {
  status: CatalogSyncRunStatus;
  trigger: CatalogSyncTrigger;
  startedAt: Date;
  completedAt?: Date;
  counts: CatalogSyncCounts;
  failureSummary?: string;
};

export type CatalogSyncStatus = {
  connectionId: string;
  latestRun?: CatalogSyncRunSummary;
  lastSuccessAt?: Date;
  isDue: boolean;
};

export type GetCatalogSyncStatusInput = { organizationId: string; connectionId: string };

export type GetCatalogSyncStatusResult = { kind: "found"; status: CatalogSyncStatus } | { kind: "not-found" };
