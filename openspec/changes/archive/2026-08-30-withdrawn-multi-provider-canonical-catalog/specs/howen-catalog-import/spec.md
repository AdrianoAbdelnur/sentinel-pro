# Howen Catalog Import Specification

## Purpose
Import verified Howen identity into a tenant-owned catalog Company.

## Requirements

### Requirement: Verified fields form Company-scoped candidates
Howen import MUST operate under a tenant connection assigned to a canonical Company. It MUST map `fleetid` to external fleet identity, `fleetname` to label, `deviceno` to external device identity, and `devicename` to vehicle headline. It MAY carry verified channels, GPS, and online state and MUST NOT invent data.

#### Scenario: Record is valid
- GIVEN required identities and a target Company
- WHEN import runs
- THEN a Company-scoped candidate is produced

#### Scenario: Company is unavailable
- GIVEN no authorized Company assignment
- WHEN import runs
- THEN no canonical Fleet or Vehicle is created

#### Scenario: Required identity is invalid
- GIVEN one record lacks required identity
- WHEN import runs
- THEN it is rejected while valid records continue

### Requirement: Import preserves canonical state
Initial and reconciliation runs MUST follow catalog synchronization behavior. Repeated or concurrent Howen imports MUST be idempotent and MUST NOT overwrite canonical Company, administrator Fleet assignment, or reviewed links.

#### Scenario: Import repeats concurrently
- GIVEN a roster was imported
- WHEN it imports again or concurrently
- THEN cardinality and established links remain stable

#### Scenario: Howen fails
- GIVEN no valid roster
- WHEN import runs
- THEN canonical state remains unchanged and failure is reported

#### Scenario: Howen covers part of a canonical Fleet
- GIVEN a bound Howen fleet overlaps some canonical Vehicles
- WHEN its roster imports
- THEN overlapping Vehicles gain Howen identity and video while other Vehicles remain

#### Scenario: Howen-only Vehicle exists
- GIVEN a valid Howen Vehicle has no other provider identity
- WHEN its bound fleet imports
- THEN it remains a canonical Vehicle in the union Fleet

#### Scenario: Howen omits a previously linked Vehicle
- GIVEN Howen previously linked a canonical Vehicle
- WHEN a later roster omits it
- THEN the Vehicle stays placed and only Howen capabilities become unavailable
