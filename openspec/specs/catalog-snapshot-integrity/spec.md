# Catalog Snapshot Integrity Specification

## Purpose

Define when a provider catalog snapshot is safe to reconcile source-identity absences while preserving valid data during uncertain provider responses.

## Requirements

### Requirement: Provider-neutral snapshot assessment

The system MUST receive a provider-neutral assessment containing retrieval completion, pagination completion, received-record count, parseable-record count, and a reason whenever completeness is not proven. Provider adapters MUST classify a snapshot as partial when retrieval or pagination is uncertain, a previously populated source unexpectedly returns zero records, or parse quality is below the configured safe threshold. Missing evidence MUST be treated as partial. Adapters MAY return valid parseable candidates from a partial snapshot.

#### Scenario: Complete normal snapshot

- GIVEN retrieval and pagination finish successfully
- AND received and parseable counts meet the safe parse-quality threshold
- WHEN the adapter returns the catalog snapshot
- THEN it SHALL be assessed as complete

#### Scenario: Pagination failure

- GIVEN a provider returns records but page traversal fails or cannot be proven complete
- WHEN the adapter returns the snapshot result
- THEN it MUST assess the snapshot as partial with a reason

#### Scenario: Unexpected empty response

- GIVEN the source has a prior confirmed populated snapshot
- WHEN successful retrieval yields zero received records
- THEN the snapshot MUST be partial with an unexpected-empty reason

#### Scenario: Parse-degraded response

- GIVEN many provider records are received but too few are parseable for the configured safe threshold
- WHEN the adapter returns valid parseable candidates
- THEN it MUST assess the snapshot as partial and report both counts

### Requirement: Conservative absence reconciliation

The system MUST default each synchronization run to absence reconciliation denied. It MUST import authorized valid candidates from either complete or partial snapshots. It MUST reconcile unseen source identities as absent only after successful processing of a complete assessment whose parse quality is safe and whose population does not decline more than the configured conservative threshold from the prior confirmed complete snapshot. A partial or unproven snapshot MUST be recorded as non-full with its reason and MUST NOT change unseen identities to absent.

#### Scenario: Partial snapshot preserves unseen identities

- GIVEN an existing source identity is not represented by a partial snapshot
- WHEN the valid candidates are synchronized
- THEN the valid candidates SHALL import
- AND the existing unseen identity MUST retain its current non-absent state

#### Scenario: Confirmed complete snapshot reconciles absence

- GIVEN an existing source identity is omitted by a confirmed complete snapshot
- WHEN synchronization succeeds
- THEN the run MUST record a full snapshot
- AND the omitted identity MUST be reconciled as absent

#### Scenario: Abrupt population decline

- GIVEN a prior confirmed complete snapshot has a larger population
- WHEN a later otherwise-complete snapshot drops beyond the conservative threshold
- THEN the later snapshot MUST be treated as partial
- AND absence reconciliation MUST remain denied

#### Scenario: Recovery after partial snapshot

- GIVEN a partial run retained an identity that was not received
- WHEN a later confirmed complete snapshot includes that identity
- THEN synchronization MUST restore its active observed state normally

#### Scenario: Idempotent retry

- GIVEN the same assessed snapshot is synchronized more than once
- WHEN each run completes
- THEN canonical identities and absence state MUST be equivalent to one execution
- AND no duplicate identity or association SHALL be created