# Proposal: Authorize Cybermapa by external company

## Intent

Use Cybermapa's confirmed stable `nombre_empresa` as the explicit Company authorization boundary instead of per-vehicle `gps_id` allowlists.

## Scope

- Persist authorized normalized Cybermapa company labels on provider connections.
- Admit Cybermapa candidates only when their exact normalized external company is authorized.

## Out of Scope

- Changing Howen fleet authorization or provider credentials.

## Success Criteria

- [ ] A Company imports only vehicles whose `nombre_empresa` is explicitly authorized.
- [ ] Unknown external company labels remain denied before catalog import.
