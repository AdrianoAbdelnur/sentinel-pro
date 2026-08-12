# Proposal: Enforce external tenant isolation

## Intent

Prevent a shared Cybermapa or Howen master account from importing an external record into a Company without an explicit authorization chain.

## Scope

### In Scope
- Persist Company-bound external authorization scopes on each provider connection.
- Filter complete snapshots before catalog import.
- Use Howen `fleetid`; use Cybermapa `gps_id` because its observed response has no fleet identity.

### Out of Scope
- Per-Company provider credentials, provider API calls, and unrelated catalog changes.

## Capabilities

### New Capabilities
- `external-import-authorization`: Explicit external scope authorization gates canonical catalog import.

### Modified Capabilities
- `catalog-synchronization`: Synchronization rejects records lacking authorization before import.
- `howen-catalog-import`: Howen records require an authorized `fleetid`.
- `cybermapa-catalog-import`: Cybermapa records require an authorized `gps_id`.

## Approach

Keep master credential references shared. A connection identifies its target Company and an allowlist. Candidate records are admitted only by an authorized external fleet, or by a stable external vehicle identifier when the provider cannot supply a fleet.

## Success Criteria

- [ ] Shared credentials cannot cross Company boundaries.
- [ ] Unknown or unauthorized scopes create no catalog state.
- [ ] Repeated authorized synchronization remains idempotent.
