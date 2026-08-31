# Delta for Capability Source Precedence

## MODIFIED Requirements

### Requirement: Capabilities resolve independently from configurable policy

`CapabilityPolicy` MUST persist in `capability_policies` as the existing platform-owned ordered source policy for one capability. GPS, operational alerts, video, and video alerts MUST resolve independently from present, eligible contributions. Current provider defaults MAY remain configuration data, but domain and UI behavior MUST branch on capability and eligibility rather than provider identity.
(Previously: Policy used rollout collection names and provider defaults were described as product behavior.)

#### Scenario: Mixed contributions serve one vehicle
- GIVEN eligible contributions offer different capabilities
- WHEN source policy resolves them
- THEN each capability selects its first eligible contribution independently

#### Scenario: Preferred source is unavailable
- GIVEN the first ordered source is unavailable or unsupported
- WHEN one capability resolves
- THEN the next eligible source is selected without affecting other capabilities

#### Scenario: No source can serve
- GIVEN no eligible contribution supports a capability
- WHEN it resolves
- THEN only that capability is unavailable

#### Scenario: Policy changes
- GIVEN a platform-authorized actor reorders an eligible capability policy
- WHEN Live is projected
- THEN source selection changes while identity, placement, access, and UI shape remain unchanged
