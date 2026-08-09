# Howen Catalog Import Specification

## Purpose
Import verified Howen roster identity.

## Requirements

### Requirement: Verified fields form candidates
Import MUST map `fleetid` to external fleet identity, `fleetname` to its label, `deviceno` to external device identity, and `devicename` to vehicle headline. It MAY carry verified channels, GPS, and online state; it MUST NOT invent data.

#### Scenario: Record is valid
- GIVEN required verified identities
- WHEN import runs
- THEN canonical outcome and scoped Howen links result

#### Scenario: Identity is invalid
- GIVEN one record lacks required identity
- WHEN import runs
- THEN it is rejected while valid records continue

### Requirement: Import is safe
Repeated or concurrent imports MUST NOT duplicate records, links, or review items, nor overwrite canonical names or placement.

#### Scenario: Import repeats concurrently
- GIVEN an imported roster
- WHEN it imports again or concurrently
- THEN cardinality and links remain stable

#### Scenario: Howen fails
- GIVEN no valid roster is available
- WHEN import runs
- THEN existing catalog remains unchanged and failure is reported
