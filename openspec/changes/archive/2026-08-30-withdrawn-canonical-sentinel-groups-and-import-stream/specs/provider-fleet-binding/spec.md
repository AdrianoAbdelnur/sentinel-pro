# Delta for Provider Fleet Binding

## MODIFIED Requirements

### Requirement: Provider fleet memberships are independent
Each provider fleet membership MUST be stored with provider identity, external ID, and reported label as metadata. Such membership MUST NOT prove vehicle identity, become a canonical-group ID, or override Cybermapa-authoritative placement. Labels MUST NOT auto-merge or automatically rename canonical groups.
(Previously: Provider memberships could not alter any existing Sentinel placement.)

#### Scenario: Providers disagree on fleets
- GIVEN one vehicle belongs to differently named provider groupings
- WHEN both contributions synchronize
- THEN one vehicle retains both provider evidence records
- AND canonical placement follows its recorded provenance

#### Scenario: Provider label changes
- GIVEN provider evidence is bound to a canonical group by stable external ID
- WHEN its reported label changes
- THEN the evidence label is updated as metadata
- AND the canonical group ID and label remain unchanged
