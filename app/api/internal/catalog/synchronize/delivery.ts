import { NextResponse } from "next/server";

import type { CatalogSyncBatchOutcome, CatalogSyncBatchResult } from "@/application/catalog";
import type { ProviderConnection } from "@/domain/catalog";

const BEARER_PREFIX = "Bearer ";

export function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith(BEARER_PREFIX) ? header.slice(BEARER_PREFIX.length) : "";
}

export function unauthorized() {
  return NextResponse.json({ error: "No autorizado." }, { status: 401 });
}

type OutcomeClassification = { retryable: boolean; permanent: boolean };

function classifyOutcome(outcome: CatalogSyncBatchOutcome): OutcomeClassification {
  switch (outcome.kind) {
    case "succeeded":
    case "skipped-fresh":
    case "not-found":
      return { retryable: false, permanent: false };
    case "already-running":
    case "retryable-failure":
    case "unexpected-failure":
      return { retryable: true, permanent: false };
    default: {
      const exhaustive: never = outcome;
      return exhaustive;
    }
  }
}

function toOutcomeSummary(result: CatalogSyncBatchResult) {
  const failureCategory = result.outcome.kind === "retryable-failure" ? result.outcome.failure.category : undefined;
  return {
    organizationId: result.organizationId,
    connectionId: result.connectionId,
    kind: result.outcome.kind,
    ...classifyOutcome(result.outcome),
    ...(failureCategory ? { failureCategory } : {}),
  };
}

function toUnsupportedSummary(connection: ProviderConnection) {
  return { organizationId: connection.organizationId, connectionId: connection.id, kind: "unsupported-provider" as const, retryable: false, permanent: true };
}

function toMissingCompanyAssignmentSummary(connection: ProviderConnection) {
  return { organizationId: connection.organizationId, connectionId: connection.id, kind: "missing-company-assignment" as const, retryable: false, permanent: true };
}

function toMisconfiguredSummary(connection: ProviderConnection) {
  return { organizationId: connection.organizationId, connectionId: connection.id, kind: "provider-misconfigured" as const, retryable: false, permanent: true };
}

export function toSynchronizeResponse(results: CatalogSyncBatchResult[], unsupported: ProviderConnection[], missingCompanyAssignment: ProviderConnection[], misconfigured: ProviderConnection[]) {
  return NextResponse.json({ results: [...results.map(toOutcomeSummary), ...unsupported.map(toUnsupportedSummary), ...missingCompanyAssignment.map(toMissingCompanyAssignmentSummary), ...misconfigured.map(toMisconfiguredSummary)] });
}
