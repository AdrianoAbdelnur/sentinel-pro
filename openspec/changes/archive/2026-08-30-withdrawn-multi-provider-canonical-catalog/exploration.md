## Exploration: Multi-provider canonical catalog

### Current State
Sentinel Pro has two distinct ownership concepts. Identity `Organization` is the authenticated tenant and membership/authorization boundary. The catalog still needs a business `Company`/`Customer` inside that tenant. `docs/architecture/03-live-core-domain.md` explicitly deferred customer and tenant ownership rather than equating them; the validated operational hierarchy is `Company -> Fleet -> Vehicle`.

The required hierarchy is therefore `Identity Organization (tenant) -> Catalog Company -> Fleet -> Vehicle`. One tenant may contain many business companies, and one tenant-scoped provider connection may expose many external companies. Importing provider companies MUST NOT create identity organizations, users, or memberships.

Operational live still uses provider snapshots: Howen produces transient `howen:*` identities, `LiveVehicleState` carries one optional device, and aggregation rejects identity collisions instead of linking sources to canonical vehicles.

Cybermapa is operational. A Sentinel Pro `GETVEHICULOS` call returned 5,542 vehicles across 800 observed `nombre_empresa` labels. Records exposed `alias`, `anio`, `color`, `consumo`, `descripcion`, `gps_id`, `gps_identificador`, `id`, `marca`, `modelo`, `nombre`, `nombre_empresa`, `nombre_modulo`, and `patente`. `gps_id` was unique in all 5,542 records. Normalized plates were not: 118 duplicate groups catalog-wide and 107 duplicate company-plus-plate groups. The payload exposes business companies and vehicles but no trustworthy fleet hierarchy.

Cybermapa is the preferred external catalog source when present, without excluding Howen/Ruptela/Rinho/other-provider-only or native vehicles. Multiple source identities link to one canonical vehicle. Catalog composition imports Cybermapa first; capability policy separately defaults to Cybermapa for GPS/operational alerts and Howen for video/video alerts, with Vehicle, Fleet, Company, tenant Organization, and system precedence plus ordered fallback.

A canonical Fleet is the union of vehicles contributed by safely linked provider fleets, not their intersection. Partial Howen coverage enriches only linked Vehicles with video; Cybermapa-only and other-provider-only Vehicles remain in the Fleet. Provider absence removes or marks unavailable only that source capability and never deletes canonical existence. A later source identity attaches to the existing Vehicle when matching is deterministic or reviewed.

Cybermapa and Howen require an initial full import, followed by automatic reconciliation every six hours and an authorized administrator `Sync now` action. Scheduled and manual triggers invoke the same provider-neutral synchronization use case. Each provider connection permits only one active run; repeated or concurrent triggers are idempotent. A scheduled trigger may skip a connection whose last successful sync completed within the preceding six hours, allowing a recent manual run to satisfy the cadence.

### Affected Areas
- `domain/identity/*` and `application/identity/*` — remain the tenant, session, membership, role, and authorization boundary; no catalog company is added here.
- New `domain/catalog/*` — tenant-owned companies, union fleets, vehicles, provider-agnostic fleet/vehicle bindings, source identities, review, and capability policy.
- New `application/catalog/*` — company administration, provider-neutral synchronization, Cybermapa-first composition, matching/review, idempotent imports, and fallback resolution.
- New `integrations/cybermapa/*` — authenticate, fetch, validate, and map only the observed Cybermapa contract.
- `integrations/howen/*` — contribute candidates/capabilities without owning catalog identity.
- `integrations/persistence/mongodb/*` — persist tenant-scoped connections, company candidates/bindings, canonical hierarchy, identities, reviews, and import progress.
- `domain/live/*`, `application/live/*`, and live composition — project canonical company/fleet/vehicle identities and per-capability sources without UI provider branches.
- `app/admin/*`, catalog delivery, and scheduler entrypoint — administer bindings, run `Sync now`, trigger six-hour reconciliation, and expose run state under the active tenant.

### Approaches
1. **Equate provider company with auth tenant** — create an identity organization per `nombre_empresa`.
   - Pros: Superficially simple hierarchy.
   - Cons: Corrupts authorization semantics, invents memberships, and cannot represent 800 companies under one tenant connection.
   - Effort: Medium, unacceptable model.

2. **Tenant-owned canonical business catalog** — keep auth organization separate; bind connection-scoped external company candidates to canonical catalog companies.
   - Pros: Correct authorization boundary, stable business hierarchy, safe imports, provider-only/native support, and reviewed links.
   - Cons: Requires company administration, binding, `Unassigned` fleets, and review workflows.
   - Effort: High.

3. **Infer company/vehicle identity during reads** — retain provider snapshots and reconstruct the hierarchy repeatedly.
   - Pros: Less persistence initially.
   - Cons: Duplicate plates, mutable labels, no durable corrections, and inconsistent tenant scoping.
   - Effort: Medium initially, High operationally.

### Recommendation
Use approach 2. Every provider connection belongs to one identity Organization tenant. Each Cybermapa `nombre_empresa` becomes a staged company candidate keyed by `(tenant, provider connection, normalized label)`. An authorized administrator of that tenant explicitly creates or selects a canonical catalog Company and binds the candidate. No identity organization, user, membership, or permission is inferred.

After company binding, use `(tenant, provider connection, vehicle, gps_id)` as the Cybermapa scoped external identity. An exact normalized plate may auto-link only when exactly one active canonical vehicle matches inside the bound catalog Company and no deterministic identity conflicts. Zero matches create a canonical vehicle in that Company's system-managed `Unassigned` fleet. Multiple matches or any conflict create pending review. Names, aliases, module names, and descriptions never auto-link.

Each canonical Company has at most one internal, administratively visible `Unassigned` fleet. An administrator may move a vehicle to a real fleet; provider synchronization MUST NOT move it back. Imports must be resumable/idempotent, preserve committed canonical state on failure, and process Cybermapa before Howen without removing Howen-only or native vehicles.

Model external fleet identities independently from the canonical Fleet. Multiple verified external fleet identities MAY bind to one canonical Fleet, producing the union of their safely linked Vehicles. Fleet names alone MUST NOT auto-merge; linking requires deterministic external identity or explicit administrator review/binding. Removing one provider association affects only that provider identity and its capabilities, not the canonical Fleet or Vehicles.

The verified Cybermapa `GETVEHICULOS` contract has no trustworthy external fleet identity, so the importer MUST NOT invent Cybermapa fleets. Current Cybermapa Vehicles enter the Company's canonical `Unassigned` Fleet unless an administrator places them elsewhere. The generic external-fleet linking rule applies only when a provider exposes a verified fleet identity, as Howen does.

Use one provider-neutral `SynchronizeCatalogConnection` use case for initial, scheduled, and manual runs. It claims a single active run per connection, fetches and validates one complete snapshot, applies bounded idempotent batches, and records success or retryable failure. Only successful complete snapshots reconcile missing external records; omissions mark source presence/capabilities unavailable without deleting or moving canonical Vehicles. A provider failure affects only that connection and does not prevent other connections from synchronizing.

Catalog-company context must be available to capability resolution while authorization continues to derive solely from the active tenant Organization. The UI receives canonical company/fleet/vehicle contracts and never selects behavior by provider.

### Risks
- Confusing tenant Organization with business Company would leak catalog imports into authentication and authorization.
- `nombre_empresa` is a mutable observed label, so binding history must prevent duplicate company candidates.
- Plate matching requires exact-one-active-match and no-conflict guards; duplicates exist within company scope.
- `gps_id` uniqueness is verified for one full snapshot, not yet across time.
- Cybermapa scale requires batched, retry-safe persistence and import observability.
- Existing transient Howen identities require a controlled canonical migration seam.
- Treating fleet membership as a provider intersection would hide valid Cybermapa-only and other-provider-only Vehicles.
- Similar fleet names can collide or drift, so they cannot establish canonical fleet identity.
- Overlapping scheduler/manual triggers require an atomic per-connection run claim and idempotent completion.
- Reconciling absence from a failed or partial snapshot would incorrectly disable source capabilities.
- Downstream proposal/spec/design/tasks artifacts must be regenerated to include synchronization lifecycle and cadence.

### Ready for Proposal
Yes — ownership, union composition, bindings, `Unassigned`, matching, precedence, initial import, six-hour scheduling, `Sync now`, concurrency, absence reconciliation, and provider-failure isolation are explicit. Regenerate proposal, specs, design, and tasks from this boundary.
