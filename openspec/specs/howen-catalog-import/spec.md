# Delta for Howen Catalog Import

## MODIFIED Requirements

### Requirement: Howen enriches or creates globally
Howen MUST expose validated plate evidence and independent fleet membership. A match MUST add Howen video/video-alert capability without changing Sentinel placement; only a Howen-created vehicle MAY receive initial placement derived from its Howen fleet.
(Previously: Howen imported inside a tenant-bound Company.)

#### Scenario: Howen matches Cybermapa
- GIVEN one exact global plate match placed by Cybermapa
- WHEN Howen synchronizes from another fleet
- THEN Howen video is attached and placement is unchanged

#### Scenario: Vehicle exists only in Howen
- GIVEN valid Howen identity, plate, and fleet with no global match
- WHEN Howen import proceeds
- THEN a global vehicle is created with Howen-derived initial placement
