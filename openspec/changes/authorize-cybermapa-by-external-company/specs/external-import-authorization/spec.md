# External Import Authorization Delta

## Modified Requirements

### Requirement: Cybermapa authorizes stable external companies
Cybermapa candidates MUST be authorized by an exact normalized `nombre_empresa` listed on the target Company connection. `nombre_empresa` is a confirmed stable, unique provider identifier. An unknown or absent label MUST create no canonical state.

#### Scenario: Shared master snapshot has two external companies
- GIVEN Company A authorizes `Empresa A` and Company B authorizes `Empresa B`
- WHEN the shared master response contains both companies
- THEN each synchronization imports only its authorized company vehicles.
