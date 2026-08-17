# Proposal: Canonical Sentinel Groups and Resilient Import Streaming

## Intent

Make V2 the sole admin import path. Sentinel owns canonical groups; provider labels remain metadata. Progress becomes durable, cumulative, resumable, and independent of HTTP cancellation.

## Scope

### In Scope
- Add canonical groups with generated IDs, labels, placement provenance, and provider evidence.
- Give Cybermapa `nombre_empresa` authoritative placement precedence; match Howen by normalized plate and create Howen-derived placement only for Howen-only vehicles.
- Replace legacy import composition with stable V2 runs, persisted progress, checkpoint resume, and safe NDJSON delivery.
- Classify existing placements conservatively and surface ambiguous evidence instead of merging it.

### Out of Scope
- Manual canonical-group renaming or editing.
- Automatic renaming or deletion of empty groups.
- Tenant access or live playback changes.

## Capabilities

### New Capabilities
- `canonical-sentinel-groups`: Stable identity, evidence bindings, placement provenance, and Cybermapa precedence.
- `admin-import-streaming`: Monotonic progress, idempotent termination, and transport-independent execution.

### Modified Capabilities
- `canonical-vehicle-catalog`: Replace first-writer placement with auditable Cybermapa authority.
- `cybermapa-catalog-import`: Map `nombre_empresa` to canonical-group evidence without inventing provider fleet identity.
- `howen-catalog-import`: Reuse matches and create Howen-derived groups only without Cybermapa placement.
- `provider-fleet-binding`: Keep provider IDs and labels as metadata, separate from canonical identity.
- `catalog-synchronization`: Require stable V2 runs, cumulative counts, checkpoints, and resume.

## Approach

Match vehicles by existing global identity rules, primarily normalized plate. Cybermapa company evidence establishes authoritative placement; Howen `fleetid`/`fleetname` supplies metadata and fallback placement. Persist provenance so Cybermapa can move Howen-first vehicles safely. Deliver persisted run state through guarded, cancellation-aware stream operations without failing the run.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `domain/catalog-global`, `application/catalog-global` | Modified | Groups, precedence, ports, progress |
| `integrations/{cybermapa,howen,persistence}` | Modified | Evidence mapping and V2 persistence |
| `app/api/admin/import`, `app/admin/import` | Modified | V2 composition, safe stream, cumulative UI |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Label collisions or renames | Med | Normalize evidence; flag ambiguity; never auto-merge |
| Incorrect legacy provenance | Med | Conservative migration; do not guess authority |
| Disconnect/completion race | Med | Idempotent send/close with transport-independent execution |

## Rollback Plan

Restore the prior route composition and retain V2 group/provenance data for diagnosis. Do not delete legacy collections.

## Dependencies

- Existing V2 repositories, runs, checkpoints, and provider adapters.

## Success Criteria

- [ ] Admin import writes only V2 catalog data and resumes stable persisted runs.
- [ ] Cybermapa deterministically re-places Howen-first plate matches; Howen never overrides Cybermapa placement.
- [ ] Provider labels remain metadata and canonical IDs remain stable.
- [ ] Progress is monotonic across groups/retries; disconnects cause no double close or import failure.
