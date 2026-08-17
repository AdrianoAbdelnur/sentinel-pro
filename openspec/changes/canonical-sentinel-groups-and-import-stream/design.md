# Design: Canonical Sentinel Groups and Resilient Import Streaming

## Technical Approach

Complete the existing global-catalog V2 vertical slice rather than patching `application/catalog`. Provider adapters emit normalized placement evidence with authority semantics; application policy resolves groups and placement; MongoDB persists canonical identity, evidence, provenance, run lineage, checkpoints, and cumulative progress. `/api/admin/import` becomes a V2 delivery adapter whose NDJSON subscription can disappear without cancelling execution.

## Architecture Decisions

| Decision | Choice | Alternative / tradeoff | Rationale |
|---|---|---|---|
| Canonical group identity | Add `SentinelGroup` plus separate `GroupEvidenceBinding`; generated IDs never derive from provider values. | Opaque adapter-generated fleet IDs are smaller but preserve accidental identity. | Labels can change while identity and provenance remain stable. |
| Provider-independent precedence | `ProviderCandidate` emits evidence `{kind, externalKey, label, authority}` where authority is `authoritative` or `fallback`; an application `PlacementPolicy` compares authority. | Branching on `cybermapa`/`howen` is direct but leaks providers upward. | Cybermapa maps company evidence to authoritative; Howen maps fleet evidence to fallback, while policy remains generic. |
| Ambiguity handling | Exact binding lookup wins; normalized-label lookup is allowed only when unique. Multiple matches create a group-placement review and never merge groups. | First-match resolution is simpler but corrupts ownership. | Preserves evidence without guessing. |
| Resume model | Keep stable V2 connections; each retry creates an attempt with a stable `lineageId`, inheriting the latest failed attempt's checkpoint and cumulative counts. | Reusing one run ID loses attempt history. | Logical work resumes while audit history remains immutable. |
| Streaming lifecycle | Execution owns persistence and accepts no request abort signal. A guarded NDJSON publisher subscribes to progress and detaches on `request.signal`; `send` and `finish` are idempotent. | Coupling execution to `ReadableStream` makes disconnects business failures. | Transport becomes best effort and process interruption remains recoverable through checkpoints. |

## Data Flow

```text
Provider API -> adapter -> ProviderCandidate(groupEvidence)
  -> matcher -> group resolver -> placement policy -> V2 repositories
  -> persisted run/checkpoint/counts -> progress subscriber -> NDJSON -> UI
                                            ^ disconnect detaches only
```

The route resolves exactly one enabled connection for the requested adapter key; missing or duplicate configuration fails before a run starts. Synchronization sorts candidates, resumes after the durable checkpoint, persists `total` and cumulative counts after every candidate, then publishes the persisted snapshot. Group resolution and vehicle/contribution updates execute in the existing Mongo transaction boundary.

## File Changes

| File | Action | Description |
|---|---|---|
| `domain/catalog-global/sentinel-group.ts` | Create | Group, evidence binding, placement provenance, and authority values. |
| `domain/catalog-global/global-vehicle.ts` | Modify | Replace opaque placement semantics with auditable group placement. |
| `application/catalog-global/{ports,match-and-apply-provider-candidate,synchronize-global-connection}.ts` | Modify | Add group/review ports, authority policy, lineage, total, and persisted progress callback. |
| `integrations/{cybermapa,howen}/seed-*-catalog.ts` | Modify | Emit authoritative company evidence or fallback fleet evidence. |
| `integrations/catalog/global-sync-source-adapters.ts` | Modify | Remove placement environment IDs and pass adapter evidence. |
| `integrations/persistence/mongodb/catalog-global-{documents,validators,migrations,repositories,sync-repositories}.ts` | Modify | Persist groups, bindings, provenance, lineage, and indexes. |
| `app/api/admin/import/{composition,route}.ts` | Modify | Compose V2 connection lookup/sync and guarded NDJSON delivery. |
| `app/admin/import/provider-import-screen.tsx` | Modify | Render monotonic persisted totals and counts. |
| Corresponding `*.test.ts(x)` files | Modify/Create | TDD coverage for each contract and race. |

## Interfaces / Contracts

```ts
type GroupEvidence = Readonly<{
  connectionId: string;
  kind: "company-label" | "fleet-membership";
  externalKey: string;
  label: string;
  authority: "authoritative" | "fallback";
}>;

type VehiclePlacement = Readonly<{
  groupId: string;
  authority: "authoritative" | "fallback" | "legacy-unverified";
  evidenceBindingId?: string;
  assignedAt: Date;
}>;

type GlobalSyncProgress = Readonly<{
  connectionId: string; lineageId: string; runId: string;
  total: number; checkpoint?: string; counts: GlobalSyncCounts;
  currentGroup?: string;
}>;
```

## Testing Strategy

| Layer | Coverage |
|---|---|
| Domain/unit | Stable IDs, unique/ambiguous evidence, authority ordering, idempotent re-import, label changes, and no automatic rename/delete. |
| Application | Howen-first then authoritative move; reverse order unchanged; stable lineage resume; monotonic persisted snapshots; duplicate enabled connection rejection. |
| MongoDB | Validators, unique binding indexes, transactional placement, migration/backfill, run lineage and checkpoint persistence. |
| Route/UI | Authorization, cancel/late-progress/double-finish races, transport failure isolation, terminal event cardinality, and non-decreasing display. |

## Migration / Rollout

Deploy additive validators/indexes first. Backfill existing V2 placements only when `placementFleetId` maps unambiguously to `sentinel_fleets_v2`, recording `legacy-unverified`; otherwise retain the legacy field and create a pending review. Authoritative evidence may replace `legacy-unverified`; fallback evidence may not. Keep legacy collections untouched, switch only `/api/admin/import` to V2, observe run/group reviews, then remove compatibility reads in a later change.

Rollback restores the prior route composition. New V2 group, binding, provenance, and lineage data remains intact for diagnosis; no destructive down-migration runs.

## Open Questions

None.
