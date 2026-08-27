# Vehicle Device Catalog Specification

## Purpose

Define provider-neutral vehicle and device identities and their lifecycle.

## Requirements

### Requirement: Vehicles own devices

Each physical vehicle MUST have one internal `vehicleId` and MAY own many devices. Each device MUST have an internal identity and MUST be uniquely recognized by `(connectionId, deviceId)`; `deviceId` MUST NOT be treated as `vehicleId` or as globally unique.

#### Scenario: Two providers equip one vehicle
- GIVEN two uniquely matched provider records for one vehicle
- WHEN their devices are imported
- THEN one vehicle retains both distinct devices

#### Scenario: Device identity repeats
- GIVEN an existing `(connectionId, deviceId)`
- WHEN it is synchronized again
- THEN the same device and vehicle link are reused

### Requirement: Device facts and states remain distinct

A device MUST retain provider origin, kind, optional make/model, operational status, capabilities, and snapshot presence. Device status, device presence, and vehicle active state MUST remain distinct. Provider-observed company MUST NOT be the device's primary company property.

#### Scenario: Device is omitted
- GIVEN a device with an operational status
- WHEN a complete snapshot omits it
- THEN it becomes absent without rewriting its status or deleting its vehicle

