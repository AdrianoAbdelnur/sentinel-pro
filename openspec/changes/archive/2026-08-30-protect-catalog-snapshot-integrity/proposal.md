# Proposal: Protect Catalog Snapshot Integrity

## Intent

Prevent a degraded provider catalog response from being treated as authoritative and mass-marking valid source identities absent. Sentinel must favor temporarily retaining prior identities whenever completeness is uncertain.

## Scope

### In Scope
- Add a provider-neutral snapshot assessment contract with retrieval, pagination, and parsing evidence.
- Permit valid candidates from an unsafe snapshot to import, while blocking absence reconciliation.
- Require explicit, conservative evidence before a run is recorded as full and can reconcile absence.
- Record why a snapshot is partial and document the operational policy.
- Add isolated regression coverage for normal, partial, empty, parse-degraded, recovery, reconciliation, and idempotent flows.

### Out of Scope
- Calling real provider APIs or reading local credentials.
- Changing canonical matching, authorization, UI, scheduling, or unrelated catalog behavior.
- Deleting retained identities automatically without a later confirmed complete snapshot.

## Capabilities

### New Capabilities
- `catalog-snapshot-integrity`: Assess provider catalog completeness conservatively and gate absence reconciliation.

### Modified Capabilities
- None.

## Approach

Extend the integration-to-application source result with explicit completeness evidence and received/parseable counts. Adapters keep provider pagination details internal and classify incomplete, unexpectedly empty, or materially unparseable responses as partial. The application imports valid candidates but starts with reconciliation denied; it enables absence reconciliation only when explicit provider completion, healthy parse quality, non-suspicious population versus the prior confirmed snapshot, and successful processing all hold. Persist the run as non-full with its reason otherwise. A later confirmed complete run resumes ordinary reconciliation.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `application/catalog/ports.ts` | Modified | Internal assessment contract |
| `application/catalog/*sync*.ts` | Modified | Conservative reconciliation gate |
| `domain/catalog/sync-run.ts` | Modified | Proven full-snapshot state |
| `integrations/{cybermapa,howen}/*` | Modified | Completion/mapping evidence |
| `docs/architecture/08-catalog-synchronization.md` | Modified | Safety policy |
| Catalog unit tests | Modified | Requested regressions |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| Legitimate deletion is delayed | Medium | Deny reconciliation on uncertainty; next proven-full run recovers it |
| Threshold permits a degraded response | Low | Conservative baseline and deny-by-default evidence |
| Provider pagination differs | Medium | Encapsulate proof in each adapter |

## Rollback Plan

Revert this change as one work unit; retained identities remain intact because the change does not destructively delete them.

## Dependencies

- Existing catalog synchronization and provider adapters; no external API calls.

## Success Criteria

- [ ] Partial, empty, pagination-uncertain, or parse-degraded snapshots never reconcile absence.
- [ ] Confirmed complete snapshots reconcile omitted identities.
- [ ] A later confirmed complete snapshot restores normal state and retries remain idempotent.
- [ ] The eight requested regression scenarios pass without real provider calls.
