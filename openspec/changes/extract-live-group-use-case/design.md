# Design: Extract Live Group Loading Use Case

Create an application service that receives `organizationId` and `groupId` plus injected catalog repositories and a provider-neutral snapshot loader. It resolves the authorized group vehicles, contributions, connections, providers, and policies, loads operational snapshots for only those contributions, and projects the existing `LiveState` contract. The route remains a delivery adapter responsible for authorization, parameter validation, dependency composition, and HTTP translation.

The application layer depends on repository and snapshot-loader contracts, not MongoDB or provider implementations. A missing group is returned as an explicit result so the route can preserve HTTP 404 behavior.
