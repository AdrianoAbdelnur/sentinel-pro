# Proposal: Prevent Cross-Provider Vehicle Duplicates

## Intent

Prevent an unknown provider identity from silently creating a second canonical Vehicle when a reasonable cross-provider candidate exists, without unsafe name, fleet, or fuzzy auto-matching.

## Scope

### In Scope
- Preserve connection-scoped identity reuse and unique, Company-scoped explicit registered-plate auto-linking.
- Add typed strong/weak evidence and an idempotent vehicle-match review for exact Howen display-name-to-canonical-registered-plate equality.
- Bind a review-approved identity atomically to the selected Vehicle; add P1 matching and retry TDD coverage.

### Out of Scope
- Fuzzy, partial, label-to-label, fleet/company-name, or cross-company matching.
- Inferring a Howen plate from `devicename`, provider API calls, `.env.local` access, Vehicle merging, or unrelated catalog risks.

## Capabilities

### New Capabilities
- `catalog-cross-provider-identity-matching`: evidence-tiered canonical Vehicle matching, review staging, and safe identity binding during catalog import.

### Modified Capabilities
- None.

## Approach

Reuse exact `(organizationId, connectionId, externalId)` first. Auto-link only one active Vehicle in the bound Company with provider-supplied registered-plate evidence and no same-connection conflict. Otherwise stage one pending review when Howen's normalized display name exactly equals a canonical registered plate. Persist typed evidence and candidate IDs. Create a Vehicle only without strong or weak candidates. Review resolution uses the existing transactional binding path, making retries deterministic.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `domain/catalog/matching.ts` | Modified | Separate strong matching from weak candidate detection. |
| `domain/catalog/review.ts` | Modified | Model typed vehicle-match evidence. |
| `application/catalog/ports.ts`, `import-catalog.ts` | Modified | Carry evidence and stage reviews before creation. |
| `integrations/cybermapa`, `integrations/howen` | Modified | Declare Cybermapa plate evidence; retain Howen label-only semantics. |
| `integrations/persistence/mongodb/catalog-*.ts` | Modified | Persist, validate, and migrate review evidence. |
| Catalog matching/import/mapper/persistence tests | Modified | Add P1 regression and idempotency coverage. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| False canonical merge | Low | Auto-link only a unique explicit registered plate in Company scope. |
| Repeated imports create reviews | Medium | Find-or-create review by connection, identity, and subject. |
| Ambiguous stored plates | Medium | Route candidates to review. |

## Rollback Plan

Revert matching/evidence migration as one work unit; existing deterministic bindings remain valid. Pending reviews remain for resolution or deletion through the catalog review workflow.

## Dependencies

- Existing transactional `ensureBoundToVehicle` and review-resolution workflow.

## Success Criteria

- [ ] Distinct Cybermapa/Howen IDs with weak exact evidence create one review, not a duplicate Vehicle.
- [ ] Only a unique explicit registered plate auto-links; ambiguity reviews; no evidence creates one new Vehicle.
- [ ] Similar data never merges; retries and already-bound identities are idempotent.
- [ ] No provider API or `.env.local` access is introduced.

