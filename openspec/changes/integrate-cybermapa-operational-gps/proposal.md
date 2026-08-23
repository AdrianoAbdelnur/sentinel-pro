# Proposal: Integrate Cybermapa Operational GPS

Connect the lazy Live group load to Cybermapa's `DATOSACTUALES` operation so vehicles receive current telemetry without loading the full catalog.

## Scope

- Add the Cybermapa current-data client contract and parser.
- Load telemetry only for vehicles in the opened group.
- Preserve the existing Howen adapter and catalog model.

## Out of Scope

- Catalog schema changes.
- Development fixtures.
- Full-fleet GPS polling.
- Howen refactoring.
