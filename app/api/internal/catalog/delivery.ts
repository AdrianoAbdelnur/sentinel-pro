import { NextResponse } from "next/server";

import type { CatalogSyncOutcome, CatalogSyncRun } from "@/application/catalog/synchronize-connection";

export function readBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
}

export function unauthorized() { return NextResponse.json({ error: "Unauthorized." }, { status: 401 }); }
export function forbidden() { return NextResponse.json({ error: "Forbidden." }, { status: 403 }); }
export function badRequest() { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
export function unavailable() { return NextResponse.json({ error: "Provider adapter is unavailable." }, { status: 409 }); }

export function toCatalogSyncResponse(outcome: CatalogSyncOutcome) {
  switch (outcome.kind) {
    case "succeeded": return NextResponse.json({ status: outcome.kind, counts: outcome.run.counts });
    case "skipped-fresh": return NextResponse.json({ status: outcome.kind });
    case "already-running": return NextResponse.json({ status: outcome.kind }, { status: 409 });
    case "not-found": return forbidden();
    case "misconfigured": return unavailable();
    case "failed": return NextResponse.json({ status: outcome.kind, retryable: outcome.retryable, failureCategory: outcome.failure.category }, { status: outcome.retryable ? 502 : 409 });
    default: { const exhaustive: never = outcome; return exhaustive; }
  }
}

export function projectCatalogSyncRun(run: CatalogSyncRun | undefined) {
  if (!run) return undefined;
  return { status: run.status, trigger: run.trigger, startedAt: run.startedAt, completedAt: run.completedAt, checkpoint: run.checkpoint, counts: run.counts, snapshot: run.snapshot, ...(run.failure ? { failure: { category: run.failure.category, httpStatus: run.failure.httpStatus } } : {}) };
}
