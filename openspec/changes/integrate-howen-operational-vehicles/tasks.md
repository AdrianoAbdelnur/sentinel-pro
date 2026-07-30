# Tasks: Aggregate Howen Operational Vehicles

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 1,500–2,100 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Delivery strategy | ask-on-risk |
| Chain strategy | stacked-to-main |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Verification |
|---|---|---|---|
| 1 | Correct live-core contracts | PR 1 → main | Focused tests |
| 2 | Aggregate operational sources | PR 2 → main | Merge tests |
| 3 | Normalize verified Howen roster | PR 3 → main | Mapper tests |
| 4 | Authenticate and fetch Howen | PR 4 → main | Client tests |
| 5 | Compose and render sources | PR 5 → main | UI/build |

Each PR targets `main` after its predecessor merges; split before review if its diff exceeds 400 lines.

## Phase 1: Live-Core Prerequisite

- [x] 1.1 **RED:** Update `domain/live/entities.test.ts` to assert no `Customer`/`customerId` on `Fleet`/`Vehicle` and an optional label.
- [x] 1.2 **GREEN:** Remove those contracts from `domain/live/entities.ts`; make the label optional and update affected consumers/fixtures.
- [x] 1.3 **REFACTOR:** Update affected docs (`docs/architecture/03-live-core-domain.md`); verify no tenant model exists; run focused tests.

## Phase 2: Source Contracts and Aggregation

- [x] 2.1 **RED:** Create `application/live/aggregate-operational-sources.test.ts` for merging, ID collisions, mixed/all failure, warnings, and no fixture fallback.
- [x] 2.2 **GREEN:** Add async source/identity/result/warning contracts in `application/live/contracts.ts`; create `aggregate-operational-sources.ts`; export through `index.ts`.
- [x] 2.3 **REFACTOR:** Make `integrations/live/in-memory/in-memory-live-data-source.ts` explicit development/test-only and separate bottom-panel fixtures; run application/in-memory tests.

## Phase 3: Verified Howen Normalization

- [ ] 3.1 **RED:** Create `integrations/howen/responses.test.ts`, `parse-howen-timestamp.test.ts`, and `map-howen-roster.test.ts` covering 621 devices/119 fleets, invalid `deviceno`, verified fields, stable IDs, absent label, safe numerics, and Buenos Aires conversion.
- [ ] 3.2 **GREEN:** Create `responses.ts`, `parse-howen-timestamp.ts`, and `map-howen-roster.ts` implementing only verified mappings.
- [ ] 3.3 **REFACTOR:** Isolate invalid records without truncating valid ones; run all mapper tests.

## Phase 4: Howen Transport and Source

- [ ] 4.1 **RED:** Create `session.test.ts`, `client.test.ts`, and `howen-operational-source.test.ts` for MD5 login, token/pid/cookie retention, single-flight reuse, `-1/-1` request, one `10004`/`10023` retry, timeout, and translated failures.
- [ ] 4.2 **GREEN:** Create server-only `config.ts`, `session.ts`, `client.ts`, and `howen-operational-source.ts`.
- [ ] 4.3 **REFACTOR:** Ensure errors/logs expose no credentials, sessions, raw statuses, or payloads; run `integrations/howen` tests.

## Phase 5: Composition, Warning UI, and Rollout

- [ ] 5.1 Read relevant Next.js 16 local docs; **RED:** test `live-runtime-config.ts`, `create-operational-sources.ts`, `page.tsx`, `live-screen.tsx`, and new `live-source-warnings.tsx` for explicit sources, partial/total warnings, retained roster, hidden technical IDs, and production no-fallback.
- [ ] 5.2 **GREEN:** Wire one aggregation in `app/live`; render generic warnings; update `live-copy.ts` and presenters without provider branching.
- [ ] 5.3 **REFACTOR/CONFIG:** Copy the authorized account from Example-sentinel into gitignored `.env.local` without printing secrets; document names only in `.env.example` and update architecture docs `05`/`06`.
- [ ] 5.4 Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:coverage`, and `npm run build`; verify 621/119 against Howen. Polling remains deferred.
