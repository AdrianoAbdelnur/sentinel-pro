# Proposal: Restore Howen Fleet Catalog Import

## Intent

Import Howen vehicles into the canonical `Company -> Fleet -> Vehicle` hierarchy instead of placing valid vehicles in the unassigned fleet.

## Scope

### In Scope
- Create or reuse canonical fleets from verified Howen fleet identity.
- Place imported vehicles in their corresponding canonical fleet.
- Preserve idempotency and existing administrator-reviewed fleet bindings.
- Add regression coverage for first import, repeat import, and multiple fleets.

### Out of Scope
- Changes to Howen authentication or roster retrieval.
- Changes to operational Live provider behavior.
- Changes to Cybermapa fleet behavior.
- UI changes.

## Capabilities

### New Capabilities
- `howen-fleet-catalog-import`: Howen fleet data becomes canonical fleet structure during catalog import.

### Modified Capabilities
- None.

## Success Criteria

- A valid Howen roster with N external fleets creates or reuses N canonical standard fleets under the Company.
- Vehicles are placed in their corresponding fleet, not `unassigned`.
- Repeated imports do not duplicate fleets or vehicles.
- Existing reviewed fleet bindings remain authoritative.
