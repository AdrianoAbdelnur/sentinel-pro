import { matchAndApplyProviderCandidate, type ProviderCandidate } from "./match-and-apply-provider-candidate";
import type { GlobalCatalogRepositories } from "./ports";
import type { ProviderConnection, ProviderDefinition } from "@/domain/catalog-global";

export type GlobalSyncTrigger = "initial" | "manual" | "internal" | "scheduler";
export type GlobalSyncFailureCategory = "authentication" | "connectivity" | "invalid-response" | "timeout" | "rate-limited" | "internal";
export type GlobalSyncFailure = { category: GlobalSyncFailureCategory; httpStatus?: number; providerErrorCode?: string };
export type GlobalSnapshotEvidence = { retrievalComplete: boolean; paginationComplete: boolean; receivedRecordCount: number; parseableRecordCount: number };
export type GlobalSnapshot = { kind: "complete"; candidates: ProviderCandidate[]; evidence?: GlobalSnapshotEvidence } | { kind: "failed"; failure: GlobalSyncFailure };
export type GlobalSyncSource = { loadSnapshot(): Promise<GlobalSnapshot> };
export type GlobalSyncCounts = { processed: number; created: number; linked: number; reviewed: number; rejected: number; absent: number };
export type GlobalSyncProgress = { connectionId: string; lineageId: string; runId: string; total: number; checkpoint?: string; counts: GlobalSyncCounts; currentGroup?: string };
export type GlobalSyncProgressListener = (progress: GlobalSyncProgress) => Promise<void> | void;
export type GlobalSyncRun = { id: string; lineageId: string; attempt: number; connectionId: string; trigger: GlobalSyncTrigger; status: "active" | "succeeded" | "failed"; startedAt: Date; completedAt?: Date; checkpoint?: string; total: number; counts: GlobalSyncCounts; snapshot: { status: "complete" | "partial"; reason?: string; receivedRecordCount?: number; parseableRecordCount?: number; authorizedCandidateCount?: number }; failure?: GlobalSyncFailure };
export type GlobalSyncOutcome =
  | { kind: "succeeded"; run: GlobalSyncRun }
  | { kind: "failed"; run: GlobalSyncRun; retryable: boolean; failure: GlobalSyncFailure }
  | { kind: "already-running" }
  | { kind: "skipped-fresh"; lastSuccessAt: Date }
  | { kind: "not-found" }
  | { kind: "misconfigured" };
export type GlobalSyncStatus = { connectionId: string; latestRun?: GlobalSyncRun; lastSuccessAt?: Date; isDue: boolean };

export type GlobalSyncPorts = GlobalCatalogRepositories & {
  clock: { now(): Date };
  ids: { create(): string };
  connections: GlobalCatalogRepositories["connections"];
  providers: { findById(id: string): Promise<ProviderDefinition | undefined> };
  runs: {
    findLatest(connectionId: string): Promise<GlobalSyncRun | undefined>;
    findLastSuccess(connectionId: string): Promise<GlobalSyncRun | undefined>;
    findLastConfirmed(connectionId: string): Promise<GlobalSyncRun | undefined>;
    claimActive(run: GlobalSyncRun): Promise<"claimed" | "already-active">;
    save(run: GlobalSyncRun): Promise<void>;
  };
  leases: {
    claim(connectionId: string, runId: string, now: Date, durationMs: number): Promise<{ outcome: "claimed" | "held"; previousRunId?: string }>;
    renew(connectionId: string, runId: string, now: Date, durationMs: number): Promise<{ outcome: "renewed" | "held" }>;
    release(connectionId: string, runId: string): Promise<void>;
  };
  transactions: {
    run<T>(work: (repositories: GlobalCatalogRepositories) => Promise<T>): Promise<T>;
    isConflict(error: unknown): boolean;
  };
};

export const GLOBAL_SYNC_LEASE_DURATION_MS = 5 * 60 * 1000;
const ZERO_COUNTS: GlobalSyncCounts = { processed: 0, created: 0, linked: 0, reviewed: 0, rejected: 0, absent: 0 };

function isRetryable(failure: GlobalSyncFailure): boolean {
  return failure.category === "connectivity" || failure.category === "timeout" || failure.category === "rate-limited" || failure.category === "internal";
}

function assessSnapshot(evidence: GlobalSnapshotEvidence | undefined, candidateCount: number, previous: GlobalSyncRun | undefined, duplicateCount: number) {
  if (duplicateCount > 0) return { status: "partial" as const, reason: "duplicate-external-id", ...evidence, authorizedCandidateCount: candidateCount };
  if (!evidence || !evidence.retrievalComplete) return { status: "partial" as const, reason: "retrieval-unproven", ...evidence, authorizedCandidateCount: candidateCount };
  if (!evidence.paginationComplete) return { status: "partial" as const, reason: "pagination-unproven", ...evidence, authorizedCandidateCount: candidateCount };
  if (evidence.receivedRecordCount > 0 && evidence.parseableRecordCount / evidence.receivedRecordCount < 0.98) return { status: "partial" as const, reason: "parse-quality-below-threshold", ...evidence, authorizedCandidateCount: candidateCount };
  if (previous?.snapshot.status === "complete" && evidence.receivedRecordCount === 0) return { status: "partial" as const, reason: "unexpected-empty", ...evidence, authorizedCandidateCount: candidateCount };
  if (previous?.snapshot.authorizedCandidateCount && candidateCount < previous.snapshot.authorizedCandidateCount * 0.9) return { status: "partial" as const, reason: "population-decline", ...evidence, authorizedCandidateCount: candidateCount };
  return { status: "complete" as const, ...evidence, authorizedCandidateCount: candidateCount };
}

function sortCandidates(candidates: ProviderCandidate[]): ProviderCandidate[] {
  return [...candidates].sort((left, right) => left.externalId.localeCompare(right.externalId));
}

function createRun(id: string, lineageId: string, attempt: number, connectionId: string, trigger: GlobalSyncTrigger, startedAt: Date): GlobalSyncRun {
  return { id, lineageId, attempt, connectionId, trigger, status: "active", startedAt, total: 0, counts: { ...ZERO_COUNTS }, snapshot: { status: "partial", reason: "pending" } };
}

function withOutcomeCount(counts: GlobalSyncCounts, kind: "created" | "matched" | "reused" | "review"): GlobalSyncCounts {
  if (kind === "created") return { ...counts, processed: counts.processed + 1, created: counts.created + 1 };
  if (kind === "matched" || kind === "reused") return { ...counts, processed: counts.processed + 1, linked: counts.linked + 1 };
  return { ...counts, processed: counts.processed + 1, reviewed: counts.reviewed + 1 };
}

export function createSynchronizeGlobalConnectionApplication(ports: GlobalSyncPorts) {
  async function listDueConnections(): Promise<ProviderConnection[]> {
    const now = ports.clock.now();
    const enabled = await ports.connections.listEnabled();
    const due: ProviderConnection[] = [];
    for (const connection of enabled) {
      const lastSuccess = await ports.runs.findLastSuccess(connection.id);
      const freshness = connection.cadenceMinutes * 60 * 1000;
      if (!lastSuccess?.completedAt || now.getTime() - lastSuccess.completedAt.getTime() >= freshness) due.push(connection);
    }
    return due;
  }

  async function reconcileAbsence(connectionId: string, seen: Set<string>, counts: GlobalSyncCounts): Promise<GlobalSyncCounts> {
    let absent = 0;
    for (const contribution of await ports.contributions.listByConnectionId(connectionId)) {
      if (seen.has(contribution.externalId) || contribution.presence === "absent") continue;
      await ports.contributions.save({ ...contribution, presence: "absent" });
      absent += 1;
    }
    return { ...counts, absent };
  }

  async function synchronize({ connectionId, trigger, source, onProgress }: { connectionId: string; trigger: GlobalSyncTrigger; source: GlobalSyncSource; onProgress?: GlobalSyncProgressListener }): Promise<GlobalSyncOutcome> {
    const publish = (run: GlobalSyncRun, currentGroup?: string) => {
      if (!onProgress) return;
      void Promise.resolve(onProgress({ connectionId: run.connectionId, lineageId: run.lineageId, runId: run.id, total: run.total, ...(run.checkpoint ? { checkpoint: run.checkpoint } : {}), counts: run.counts, ...(currentGroup ? { currentGroup } : {}) })).catch(() => undefined);
    };
    const connection = await ports.connections.findById(connectionId);
    if (!connection) return { kind: "not-found" };
    const provider = await ports.providers.findById(connection.providerId);
    if (!provider) return { kind: "misconfigured" };
    const runId = ports.ids.create();
    const startedAt = ports.clock.now();
    const claim = await ports.leases.claim(connectionId, runId, startedAt, GLOBAL_SYNC_LEASE_DURATION_MS);
    if (claim.outcome === "held") return { kind: "already-running" };
    const lastSuccess = await ports.runs.findLastSuccess(connectionId);
    const previousRun = await ports.runs.findLatest(connectionId);
    if (trigger === "scheduler" || trigger === "internal") {
      const due = !lastSuccess?.completedAt || startedAt.getTime() - lastSuccess.completedAt.getTime() >= connection.cadenceMinutes * 60 * 1000;
      if (!due) {
        await ports.leases.release(connectionId, runId);
        return { kind: "skipped-fresh", lastSuccessAt: lastSuccess.completedAt as Date };
      }
    }
    const lineageId = previousRun?.lineageId ?? previousRun?.id ?? runId;
    const attempt = (previousRun?.attempt ?? 0) + 1;
    const initialBase = createRun(runId, lineageId, attempt, connectionId, trigger, startedAt);
    const initial = previousRun?.status === "failed"
      ? { ...initialBase, checkpoint: previousRun.checkpoint, total: previousRun.total, counts: previousRun.counts }
      : initialBase;
    if ((await ports.runs.claimActive(initial)) === "already-active") {
      await ports.leases.release(connectionId, runId);
      return { kind: "already-running" };
    }
    let snapshot: GlobalSnapshot;
    try { snapshot = await source.loadSnapshot(); } catch { snapshot = { kind: "failed", failure: { category: "internal" } }; }
    if (snapshot.kind === "failed") {
      const failed = { ...initial, status: "failed" as const, completedAt: ports.clock.now(), failure: snapshot.failure };
      await ports.runs.save(failed);
      await ports.leases.release(connectionId, runId);
      return { kind: "failed", run: failed, retryable: isRetryable(snapshot.failure), failure: snapshot.failure };
    }
    const priorConfirmed = await ports.runs.findLastConfirmed(connectionId);
    const sortedCandidates = sortCandidates(snapshot.candidates);
    const uniqueCandidates = sortedCandidates.filter((candidate, index) => index === 0 || candidate.externalId !== sortedCandidates[index - 1].externalId);
    const assessment = assessSnapshot(snapshot.evidence, uniqueCandidates.length, priorConfirmed, sortedCandidates.length - uniqueCandidates.length);
    let run = { ...initial, total: Math.max(initial.total, uniqueCandidates.length), snapshot: assessment };
    await ports.runs.save(run);
    publish(run);
    const candidates = uniqueCandidates.filter((candidate) => run.checkpoint === undefined || candidate.externalId > run.checkpoint);
    const seen = new Set(snapshot.candidates.map((candidate) => candidate.externalId));
    try {
      for (const candidate of candidates) {
        const lease = await ports.leases.renew(connectionId, runId, ports.clock.now(), GLOBAL_SYNC_LEASE_DURATION_MS);
        if (lease.outcome === "held") throw new Error("global synchronization lease was lost");
        const result = await ports.transactions.run((repositories) => matchAndApplyProviderCandidate({ ...repositories, ids: ports.ids, candidate, transactions: ports.transactions }));
        const counts = withOutcomeCount(run.counts, result.kind === "review" ? "review" : result.kind);
        run = { ...run, checkpoint: candidate.externalId, counts };
        await ports.runs.save(run);
        publish(run, candidate.groupEvidence?.label);
      }
      if (assessment.status === "complete" && priorConfirmed) run = { ...run, counts: await reconcileAbsence(connectionId, seen, run.counts) };
      const completed = { ...run, status: "succeeded" as const, completedAt: ports.clock.now() };
      await ports.runs.save(completed);
      publish(completed);
      await ports.leases.release(connectionId, runId);
      return { kind: "succeeded", run: completed };
    } catch {
      const failure: GlobalSyncFailure = { category: "internal" };
      const failed = { ...run, status: "failed" as const, completedAt: ports.clock.now(), failure };
      await ports.runs.save(failed);
      await ports.leases.release(connectionId, runId);
      return { kind: "failed", run: failed, retryable: true, failure };
    }
  }

  async function getStatus(connectionId: string): Promise<{ kind: "found"; status: GlobalSyncStatus } | { kind: "not-found" }> {
    if (!await ports.connections.findById(connectionId)) return { kind: "not-found" };
    const [latestRun, lastSuccess] = await Promise.all([ports.runs.findLatest(connectionId), ports.runs.findLastSuccess(connectionId)]);
    const now = ports.clock.now();
    return { kind: "found", status: { connectionId, latestRun, lastSuccessAt: lastSuccess?.completedAt, isDue: !lastSuccess?.completedAt || now.getTime() - lastSuccess.completedAt.getTime() >= (await ports.connections.findById(connectionId))!.cadenceMinutes * 60 * 1000 } };
  }

  return { synchronize, listDueConnections, getStatus };
}
