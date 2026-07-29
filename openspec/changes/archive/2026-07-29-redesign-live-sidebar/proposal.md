# Proposal: Redesign and Reconcile the Live Sidebar

## Intent

Deliver the plate-first live sidebar with operational status, filters, and fleet counts, then reconcile its SDD record with the implementation. Verification found documentation overclaims and missing evidence. The only corrective UI change is a compact single-line fleet label.

## Scope

### In Scope
- Preserve three-state status derivation with explicit provider status taking precedence.
- Resolve `SENTINEL_LIVE_STALE_AFTER_MS` at runtime, default to five minutes, and inject the required domain threshold.
- Preserve `w-72`, scalar status and optional provider filters, `online/total` counts, independent list scrolling, and search by fleet label, vehicle label, or plate.
- Keep unrestricted column keys: known keys use Spanish copy; unknown keys use the raw key.
- Keep playback notice codes but defer visible notices until the video monitor exists.
- Compact fleet labels on one truncated line and add regression evidence for retained behavior.
- Correct SDD artifacts before re-archiving.

### Out of Scope
- Sidebar widening or multi-line fleet labels.
- Exhaustive compile-time localization of column keys.
- Playback UI, reverse geocoding, provider adapters, CONVOYS, or hierarchical fleets.

## Capabilities

### New Capabilities
- `live-vehicle-status`: provider-agnostic status derivation with provider precedence and injected staleness inputs.

### Modified Capabilities
- `live-operator-panels`: plate-first nodes, scalar filters, `online/total` counts, bounded search, and coded empty states.
- `live-page-shell`: filters and delivery-owned copy, with raw-key fallback and playback notices deferred.
- `live-map-rendering`: code-based map notices and independently scrolling sidebar content.

## Approach

Retain implemented boundaries. Amend overclaims, change only fleet-label typography, and use strict RED-GREEN-REFACTOR for focused tests. Do not alter business behavior.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `openspec/changes/redesign-live-sidebar/*` | Modified | Reconcile SDD artifacts |
| `components/live/sidebar/live-fleet-node.tsx` | Modified | Compact single-line fleet label |
| Live sidebar, status, and application tests | Modified | Focused regression evidence |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Documentation overclaims return | Medium | Verify retained scenarios against runtime evidence |
| Styling test becomes brittle | Low | Assert required and forbidden classes only |
| Raw keys expose technical text | Medium | Document the accepted fallback explicitly |

## Rollback Plan

Revert the fleet-label change and focused tests. Revert corrective SDD edits together; no domain or application migration is required.

## Dependencies

- Verification #801 and decisions #806-#812
- Existing live specifications

## Success Criteria

- [ ] Documentation matches the accepted runtime contracts and deferred playback scope.
- [ ] Fleet labels remain single-line and readable within `w-72`.
- [ ] Focused tests prove scrolling, provider precedence, and search boundaries.
- [ ] Strict verification passes before the change is archived again.
