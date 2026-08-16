# Delta for Provider Fleet Binding

## MODIFIED Requirements

### Requirement: Provider fleet memberships are independent
Each provider fleet membership MUST be stored with its provider identity and MUST NOT prove vehicle identity or alter existing Sentinel placement. Fleet labels MUST NOT auto-merge fleets.
(Previously: External fleets bound into tenant Company fleets and composed a union roster.)

#### Scenario: Providers disagree on fleets
- GIVEN one vehicle belongs to differently named provider fleets
- WHEN both contributions synchronize
- THEN one vehicle retains both memberships and its Sentinel placement
