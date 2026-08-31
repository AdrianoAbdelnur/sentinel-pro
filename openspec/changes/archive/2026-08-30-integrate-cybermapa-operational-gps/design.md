# Design: Cybermapa Operational GPS

`integrations/cybermapa/client.ts` will add `DATOSACTUALES` using `tipoID: "patente"` for the vehicles loaded from Mongo. The response parser will accept the documented standard and uppercase field forms.

`integrations/catalog/live-snapshot-adapters.ts` will map Cybermapa records to `CatalogCapabilitySnapshot` telemetry and keep snapshots keyed by provider connection and contribution external ID.

The lazy group route will load catalog vehicles, their contributions, enabled connections, providers, policies, and provider snapshots. The application projector will combine those inputs into the existing Live contract.

The catalog model and Howen integration remain unchanged.
