+## Exploration: protect-catalog-snapshot-integrity

### Current State
Provider sources expose only `complete` or `failed`. Cybermapa and Howen treat any successfully fetched array as complete (except when every non-empty record is unparseable). Synchronization starts every run with `fullSnapshot: true`; after a successful import it therefore reconciles every identity not seen in that run as `absent`. Empty responses, materially degraded mapping, and provider-side truncation can consequently be accepted as a complete catalog. Neither provider client exposes pagination/completeness evidence, and no prior-success baseline is evaluated.

### Affected Areas
- `application/catalog/ports.ts` — snapshot contract must carry completeness evidence/partial state without leaking provider payloads.
- `application/catalog/synchronize-catalog-connection.ts` — must decide whether absence reconciliation is safe and preserve valid imports from an unsafe snapshot.
- `application/catalog/import-catalog.ts` — needs the confirmed snapshot state propagated to the run/result boundary.
- `domain/catalog/sync-run.ts` — `fullSnapshot` must represent proven completeness rather than an optimistic default.
- `integrations/cybermapa/source.ts` and `integrations/howen/source.ts` — must report source/mapping completeness conservatively; clients need to surface pagination completion where supported.
- `integrations/cybermapa/client.ts` and `integrations/howen/client.ts` — source-facing fetch contracts may need metadata proving page traversal/completion.
- `application/catalog/synchronize-catalog-connection.test.ts`, `integrations/cybermapa/source.test.ts`, and `integrations/howen/source.test.ts` — regression coverage for partial, empty, low-parse, recovery, and idempotent behavior.
- `docs/architecture/08-catalog-synchronization.md` — operational contract must document conservative reconciliation gating.

### Approaches
1. **Provider-declared snapshot completeness plus application guard** — extend the internal source result with received/parseable counts and an explicit `complete`/`partial` state; adapters declare partial on pagination failure, unexpected empty response, or unacceptable parse loss; the application imports valid candidates but only reconciles absence when the source explicitly proves completeness and the run passes a conservative prior-success comparison.
   - Pros: provider-agnostic UI/application boundary; preserves valid incremental imports; makes safety auditable and testable; supports provider-specific pagination behind adapters.
   - Cons: requires a small internal contract and a defined conservative degradation threshold/baseline rule.
   - Effort: Medium

2. **Fail every suspicious snapshot** — make any empty/degraded response a failed run and import nothing.
   - Pros: smallest reconciliation change; strongest protection against destructive absence.
   - Cons: discards valid records from partial responses, contradicting the requested ability to import valid records; does not model why a snapshot was unsafe.
   - Effort: Low

3. **Require a fixed provider count/page total before every reconciliation** — reconcile only when an external total exactly matches fetched candidates.
   - Pros: strong when providers reliably expose totals.
   - Cons: neither current source contract exposes totals, and exact totals are not portable; unsuitable for providers without pagination metadata or legitimate changes.
   - Effort: High

### Recommendation
Choose approach 1. Make completeness an explicit integration-to-application contract, default reconciliation to deny, and persist the run as non-full whenever evidence is missing or degraded. The application may import candidates from a partial snapshot, but it MUST not reconcile stale identities. A complete snapshot should require successful provider retrieval with no pagination uncertainty, no unexpected empty result after prior observed population, a safe received-to-parseable ratio, and no abrupt candidate-count drop beyond a deliberately conservative baseline policy. The next confirmed complete run resumes normal reconciliation.

### Risks
- A threshold that is too permissive can still authorize a mass absence; start conservative and treat unavailable evidence as partial.
- A threshold that is too strict delays legitimate deletions; this is acceptable under the stated data-preservation priority and should be observable in sync status/failure metadata.
- The current `fullSnapshot: true` run initialization must not remain the implicit source of truth, or the new contract can be bypassed.
- Pagination proof differs by provider and must remain inside adapters, not route/UI code.

### Ready for Proposal
Yes — propose a provider-agnostic snapshot-assessment contract, conservative reconciliation policy, adapter evidence propagation, persistence/run status behavior, and the eight requested regression scenarios.
