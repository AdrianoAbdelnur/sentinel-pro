# Live Group Loading

## Requirement: Application owns group loading orchestration
The application layer MUST load one authorized group and project it using the existing Live contract.

### Scenario: Load an authorized group lazily
- **WHEN** the use case receives an organization ID and group ID
- **THEN** it loads only that group's authorized vehicles, their contributions, referenced connections and providers, policies, and operational snapshots
- **AND** it returns the existing `LiveState` contract

### Scenario: Group does not exist
- **WHEN** the requested group cannot be found
- **THEN** the use case returns a not-found result without loading provider data

### Scenario: Provider snapshots
- **WHEN** referenced connections and providers are loaded
- **THEN** the snapshot port receives only the current group's contributions and vehicle plates
- **AND** Cybermapa and Howen behavior remains inside the existing integration adapter
