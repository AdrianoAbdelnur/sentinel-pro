## Exploration: Multi-provider canonical catalog

### Current State
Sentinel Pro has two distinct ownership concepts. Identity `Organization` is the authenticated tenant and membership/authorization boundary. The catalog still needs a business `Company`/`Customer` inside that tenant. `docs/architecture/03-live-core-domain.md` explicitly deferred customer and tenant ownership rather than equating them; the validated operational hierarchy is `Company -> Fleet -> Vehicle`.

The required hierarchy is therefore `Identity Organization (tenant) -> Catalog Company -> Fleet -> Vehicle`. One tenant may contain many business companies, and one tenant-scoped provider connection may expose many external companies. Importing provider companies MUST NOT create identity organizations, users, or memberships.

Operational live still uses provider snapshots: Howen produces transient `howen:*` identities, `LiveVehicleState` carries one optional device, and aggregation rejects identity collisions instead of linking sources to canonical vehicles.

Cybermapa is operational. A Sentinel Pro `GETVEHICULOS` call returned 5,542 vehicles across 800 observed `nombre_empresa` labels. Records exposed `alias`, `anio`, `color`, `consumo`, `descripcion`, `gps_id`, `gps_identificador`, `id`, `marca`, `modelo`, `nombre`, `nombre_empresa`, `nombre_modulo`, and `patente`. `gps_id` was unique in all 5,542 records. Normalized plates were not: 118 duplicate groups catalog-wide and 107 duplicate company-plus-plate groups. The payload exposes business companies and vehicles but no trustworthy fleet hierarchy.

Cybermapa is the preferred external catalog source when present, without excluding Howen/Ruptela/Rinho/other-provider-only or native vehicles. Multiple source identities link to one canonical vehicle. Catalog composition imports Cybermapa first; capability policy separately defaults to Cybermapa for GPS/operational alerts and Howen for video/video alerts, with tenant Organization, Fleet, or Vehicle overrides plus ordered fallback.

### Affected Areas
- `domain/identity/*` and `application/identity/*` — remain the tenant, session, membership, role, and authorization boundary; no catalog company is added here.
- New `domain/catalog/*` — tenant-owned companies, fleets, vehicles, provider-agnostic bindings, source identities, review, and capability policy.
- New `application/catalog/*` — company administration, Cybermapa-first composition, native creation, matching/review, idempotent imports, and fallback resolution.
- New `integrations/cybermapa/*` — authenticate, fetch, validate, and map only the observed Cybermapa contract.
- `integrations/howen/*` — contribute candidates/capabilities without owning catalog identity.
- `integrations/persistence/mongodb/*` — persist tenant-scoped connections, company candidates/bindings, canonical hierarchy, identities, reviews, and import progress.
- `domain/live/*`, `application/live/*`, and live composition — project canonical company/fleet/vehicle identities and per-capability sources without UI provider branches.
- `app/admin/*` and catalog delivery — administer companies, bind external candidates, assign fleets, run imports, and resolve reviews under the active tenant.

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

Catalog-company context must be available to capability resolution while authorization continues to derive solely from the active tenant Organization. The UI receives canonical company/fleet/vehicle contracts and never selects behavior by provider.

### Risks
- Confusing tenant Organization with business Company would leak catalog imports into authentication and authorization.
- `nombre_empresa` is a mutable observed label, so binding history must prevent duplicate company candidates.
- Plate matching requires exact-one-active-match and no-conflict guards; duplicates exist within company scope.
- `gps_id` uniqueness is verified for one full snapshot, not yet across time.
- Cybermapa scale requires batched, retry-safe persistence and import observability.
- Existing transient Howen identities require a controlled canonical migration seam.
- Downstream proposal/spec/design/tasks artifacts still conflate tenant and company and must be regenerated.

### Ready for Proposal
Yes — tenant ownership, canonical business-company hierarchy, connection/company binding, per-company `Unassigned` placement, guarded vehicle matching, import ordering, and capability precedence are explicit. Regenerate proposal, specs, design, and tasks from this corrected boundary.
