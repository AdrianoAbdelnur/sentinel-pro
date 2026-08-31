# Admin Import Streaming Specification

## Purpose

Define durable V2 admin-import execution and best-effort NDJSON delivery.

## Requirements

### Requirement: Admin imports use stable resumable V2 runs

An admin import MUST use V2 catalog persistence and a stable provider connection/run identity. It MUST persist checkpoints and cumulative progress so retry or reconnection resumes without recreating completed work.

#### Scenario: Import resumes after interruption
- GIVEN a persisted incomplete V2 run with a checkpoint
- WHEN the same import is resumed
- THEN processing continues after the checkpoint
- AND completed candidates are not duplicated

### Requirement: Progress is cumulative and monotonic

Each persisted progress snapshot MUST expose cumulative `total`, `processed`, `created`, `linked`, `reviewed`, and `rejected` counts. Counts MUST NOT decrease across groups or retries; a current group MAY be exposed only as contextual metadata.

#### Scenario: Processing advances to another group
- GIVEN an import has completed candidates in one group
- WHEN processing begins another group
- THEN every cumulative count retains or exceeds its prior value
- AND the displayed progress does not reset

### Requirement: NDJSON termination is idempotent

NDJSON delivery MUST emit at most one terminal event and MUST make send and finish operations safe after normal completion, import error, client cancellation, late callbacks, or repeated finish attempts.

#### Scenario: Import completes normally
- GIVEN an open client stream
- WHEN the import completes successfully
- THEN one success terminal event is emitted
- AND the stream finishes once

#### Scenario: Import fails
- GIVEN an open client stream
- WHEN application execution fails
- THEN one error terminal event is emitted
- AND the stream finishes once

#### Scenario: Client cancels before a late callback
- GIVEN the client has cancelled the stream
- WHEN progress arrives or finish is attempted later
- THEN no transport write or close error escapes
- AND execution may continue persisting the run

### Requirement: Transport failure is not import failure

A delivery cancellation or transport write failure MUST NOT change a valid application run to failed. Business-level cancellation MUST require an explicit application command.

#### Scenario: Delivery fails during processing
- GIVEN an import continues successfully after its client disconnects
- WHEN NDJSON delivery rejects a write
- THEN the persisted import status reflects application execution only
- AND no implicit business cancellation occurs
