export type CatalogSyncTrigger = "initial" | "scheduled" | "manual";
export type CatalogSyncRunStatus = "active" | "succeeded" | "failed";

export type CatalogSyncCounts = {
  processed: number;
  created: number;
  linked: number;
  reviewed: number;
  rejected: number;
  absent: number;
};

export type CatalogSyncRun = {
  id: string;
  organizationId: string;
  connectionId: string;
  trigger: CatalogSyncTrigger;
  status: CatalogSyncRunStatus;
  fullSnapshot: boolean;
  startedAt: Date;
  completedAt?: Date;
  checkpoint?: string;
  counts: CatalogSyncCounts;
  failureSummary?: string;
};

const ZERO_COUNTS: CatalogSyncCounts = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };

export type CatalogSyncFailureCategory = "authentication" | "connectivity" | "invalid-response" | "timeout" | "rate-limited" | "internal";

export type CatalogSyncFailure = { category: CatalogSyncFailureCategory; httpStatus?: number; providerErrorCode?: string };

const FAILURE_CATEGORY_LABEL: Record<CatalogSyncFailureCategory, string> = { authentication: "Authentication failed", connectivity: "Provider connection unreachable", "invalid-response": "Provider returned an invalid response", timeout: "Provider request timed out", "rate-limited": "Provider rate limit exceeded", internal: "Internal synchronization error" };

const PROVIDER_ERROR_CODE_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

function composeFailureSummary({ category, httpStatus, providerErrorCode }: CatalogSyncFailure): string {
  const code = providerErrorCode !== undefined && PROVIDER_ERROR_CODE_PATTERN.test(providerErrorCode) ? providerErrorCode : undefined;
  return [FAILURE_CATEGORY_LABEL[category], ...(httpStatus !== undefined ? [`HTTP ${httpStatus}`] : []), ...(code !== undefined ? [`code ${code}`] : [])].join(" - ");
}

export function startCatalogSyncRun(
  id: string,
  params: { organizationId: string; connectionId: string; trigger: CatalogSyncTrigger; fullSnapshot: boolean },
  startedAt: Date,
): CatalogSyncRun {
  return { id, ...params, status: "active", startedAt, counts: { ...ZERO_COUNTS } };
}

export function succeedCatalogSyncRun(run: CatalogSyncRun, completedAt: Date, counts: CatalogSyncCounts): CatalogSyncRun {
  return { ...run, status: "succeeded", completedAt, counts };
}

export function failCatalogSyncRun(run: CatalogSyncRun, completedAt: Date, failure: CatalogSyncFailure): CatalogSyncRun {
  return { ...run, status: "failed", completedAt, failureSummary: composeFailureSummary(failure) };
}
