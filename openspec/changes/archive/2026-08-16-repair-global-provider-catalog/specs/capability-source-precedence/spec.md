# Delta for Capability Source Precedence

## MODIFIED Requirements

### Requirement: Capabilities resolve independently from configurable policy
Each capability MUST resolve from ordered eligible global contributions. Current defaults MUST prefer Cybermapa for GPS/operational alerts and Howen for video/video alerts, while SUPER ADMIN configuration MUST support direct GPS and future providers.
(Previously: Defaults were provider-named and policy cascaded through tenant-owned hierarchy.)

#### Scenario: Current defaults resolve
- GIVEN eligible Cybermapa and Howen contributions
- WHEN sources resolve
- THEN GPS uses Cybermapa and video uses Howen by default

#### Scenario: SUPER ADMIN changes GPS source
- GIVEN an eligible direct-GPS or future-provider contribution
- WHEN it is configured first for GPS
- THEN GPS resolves from it without changing vehicle identity or placement
