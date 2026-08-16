# Global Catalog Migration Specification

## Purpose
Migrate existing records without destructive guesses.

## Requirements

### Requirement: Migration is approval-gated
Migration MUST first produce a read-only dry run, preserve original records, and isolate malformed, ambiguous, or conflicting plates. It MUST NOT write until a SUPER ADMIN explicitly approves that dry run.

#### Scenario: Dry run completes
- GIVEN existing provider-scoped records
- WHEN migration is simulated
- THEN proposed merges, preserved placements, isolated conflicts, and tenant assignments are reported without writes

#### Scenario: Approval is absent
- GIVEN a dry run exists without explicit approval
- WHEN apply is requested
- THEN original and target data remain unchanged
