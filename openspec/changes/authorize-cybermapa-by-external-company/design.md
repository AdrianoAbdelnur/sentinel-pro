# Design: Authorize Cybermapa by external company

`ProviderConnection.authorizedExternalCompanyLabels` stores normalized exact Cybermapa company labels. The provider-neutral guard identifies Cybermapa through `credentialRef`, checks the candidate's normalized `companyLabel`, then replaces any candidate company context with the connection's bound canonical Company. Howen keeps `fleetid` authorization.
