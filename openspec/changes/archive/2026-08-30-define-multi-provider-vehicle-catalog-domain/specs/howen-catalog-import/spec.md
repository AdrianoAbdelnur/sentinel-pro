# Delta for Howen Catalog Import

## MODIFIED Requirements

### Requirement: Howen enriches or creates globally
Howen MUST map `deviceno` to connection-scoped `deviceId`, `plateno` to optional plate, `devicename` to name only, and `deviceModel`/`devicetype` to device facts while preserving available GPS, telemetry, status, and video capabilities. A unique plate match MUST enrich without moving placement; otherwise a valid device MUST create a vehicle even without plate. Only a Howen-created vehicle MAY receive initial Howen-fleet-derived placement.
(Previously: Howen required validated plate and fleet for creation and did not define these field mappings.)

#### Scenario: Howen matches Cybermapa
- GIVEN one exact normalized `plateno` match placed by Cybermapa
- WHEN Howen synchronizes
- THEN its device and observations attach without changing placement

#### Scenario: Plate is absent
- GIVEN valid `deviceno` and no `plateno`
- WHEN Howen imports
- THEN a separate normal vehicle and device are created

## ADDED Requirements

### Requirement: Howen resolves company through Fleet ancestry
Every complete Howen import MUST fetch `POST /vss/fleet/findAll.action` before vehicles, build a request-scoped `guid` index, and interpret trimmed non-empty `contacts` as company only in this adapter. Resolution MUST use direct `fleetid` first, then the nearest ancestor through `parentid`; it MUST terminate safely on missing parents or cycles. The transient tree MUST NOT require standalone persistence, while direct Fleet, company-source Fleet, and resolved company MUST be retained.

#### Scenario: SubFleet inherits company
- GIVEN a direct subFleet has empty `contacts` and its parent has non-empty `contacts`
- WHEN the vehicle is mapped
- THEN the parent company and both Fleet provenance references are retained

#### Scenario: Ancestry is unsafe
- GIVEN a missing parent or cycle and no resolved `contacts`
- WHEN traversal runs
- THEN it terminates without inventing company and retains the unresolved outcome
