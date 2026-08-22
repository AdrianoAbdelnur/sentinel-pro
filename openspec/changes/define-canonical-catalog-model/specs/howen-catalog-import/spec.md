# Delta for Howen Catalog Import

## RENAMED Requirements

### Requirement: Howen enriches or creates globally → Howen emits video catalog evidence

(Reason: The adapter supplies evidence; application rules decide linking and creation.)

## MODIFIED Requirements

### Requirement: Howen emits video catalog evidence

The Howen adapter MUST emit a stable device external identity, a syntactically validated plate derived from `devicename`, video and video-alert capabilities, and `fleetid`/`fleetname` as provider fleet membership plus fallback group evidence. It MUST NOT decide vehicle identity or override authoritative placement.
(Previously: The provider contract directly described global creation behavior.)

#### Scenario: Howen matches authoritative vehicle
- GIVEN validated Howen plate evidence matches one authoritatively placed vehicle
- WHEN the candidate is processed
- THEN its video contribution and fleet membership attach to that vehicle
- AND placement remains unchanged

#### Scenario: Howen-only candidate is valid
- GIVEN valid identity, plate, and unambiguous stable fleet evidence have no vehicle match
- WHEN the candidate is processed
- THEN one vehicle is created with fallback group placement

#### Scenario: Device name is not a valid plate
- GIVEN `devicename` fails plate validation
- WHEN the candidate is processed
- THEN no automatic match or creation occurs
- AND typed vehicle-identity review is retained

#### Scenario: Stable fleet repeats with new label
- GIVEN `fleetid` is already bound to one group
- WHEN Howen reports another `fleetname`
- THEN the same group resolves and only evidence metadata changes
