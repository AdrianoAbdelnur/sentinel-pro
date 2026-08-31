# Delta for Howen Catalog Import

## MODIFIED Requirements

### Requirement: Howen enriches or creates globally
Howen MUST expose validated normalized-plate evidence and independent fleet membership. An existing plate match MUST be reused and enriched with Howen video or video-alert capability. Howen MUST NOT replace Cybermapa-authoritative placement; only a vehicle without Cybermapa placement MAY receive fallback placement resolved from stable Howen `fleetid` evidence.
(Previously: Howen matches never changed placement and only Howen-created vehicles could receive Howen-derived initial placement.)

#### Scenario: Howen matches Cybermapa
- GIVEN one exact global plate match placed by Cybermapa
- WHEN Howen synchronizes from another fleet
- THEN Howen video is attached and placement is unchanged
- AND no duplicate vehicle is created

#### Scenario: Howen matches an unplaced vehicle
- GIVEN one exact global plate match without Cybermapa placement
- WHEN Howen synchronizes with stable fleet evidence
- THEN the same vehicle receives Howen-derived fallback placement
- AND its Howen membership is retained as metadata

#### Scenario: Vehicle exists only in Howen
- GIVEN valid Howen identity, plate, and `fleetid` with no global match
- WHEN Howen import proceeds
- THEN one global vehicle and one resolved canonical group placement are created
- AND re-import reuses both records
