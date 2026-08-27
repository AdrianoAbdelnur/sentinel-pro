# Delta for Provider Fleet Binding

## MODIFIED Requirements

### Requirement: Provider fleet memberships are independent
Each current provider fleet membership MUST be stored with provider identity and MUST NOT prove vehicle identity or alter existing Sentinel placement. Fleet labels MUST NOT auto-merge fleets. Synchronization MUST replace that contribution's prior current membership and MUST retain direct fleet identity plus any distinct company-source fleet identity and resolution outcome.
(Previously: Memberships were independent but replacement and company-resolution provenance were undefined.)

#### Scenario: Providers disagree on fleets
- GIVEN one vehicle belongs to differently named provider fleets
- WHEN both contributions synchronize
- THEN one vehicle retains both current memberships and its Sentinel placement

#### Scenario: Provider moves a vehicle
- GIVEN a contribution has an existing fleet membership
- WHEN a complete sync reports a different fleet
- THEN the new membership replaces the old one for that contribution

