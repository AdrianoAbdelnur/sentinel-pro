# Tasks: Driving Index workbook import and vehicle list

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | ~550-650 (new files across domain/application/integrations/components/app, one shared-file widening, one dependency, fixtures) |
| Chained PRs recommended | No |
| 400-line budget risk | Medium |
| Decision needed before apply | No |

This slice is additive and narrow in scope, but it spans five new folders plus one shared-file change, each carrying its own tests (per Strict TDD), plus a fixture workbook and doc update. That naturally lands above the single-PR 400-line comfort zone even though no single file is large. See the note at the end of this document for the honest call on this.

## Phase 0: Shared Plate Normalization Widening (isolated, first, regression-gated)

This phase touches `domain/catalog/plate.ts`, shared with the existing canonical catalog (`findByNormalizedPlate`). It must land and pass regression before any driving-index code depends on it.

- [x] 0.1 (RED) Extend `domain/catalog/catalog.test.ts` (or a new `domain/catalog/plate.test.ts`, whichever the existing suite convention favors) with failing cases for `normalizePlate`: strip `.`, `_`, `/` separators; strip NBSP (`U+00A0`) and zero-width characters (`U+200B`-`U+200D`, `U+FEFF`); confirm existing space/hyphen/case behavior is preserved.
  - Note: `domain/catalog/plate.ts` does not exist in this codebase. `normalizePlate` actually lives in `domain/catalog/matching.ts` and is re-exported via `domain/catalog/index.ts`. Extended the existing `describe("normalizePlate", ...)` block in `domain/catalog/matching.test.ts` instead of creating a new file, per the "whichever the existing suite convention favors" allowance. See deviation note at the end of this document.
- [x] 0.2 (GREEN) Widen `normalizePlate` in `domain/catalog/matching.ts` (see note on 0.1) to satisfy 0.1 without changing its exported signature or behavior for inputs it already normalized correctly.
- [x] 0.3 (REFACTOR) Clean up the widened implementation if needed (e.g. a single regex pass) with no behavior change; re-run 0.1's assertions.
- [x] 0.4 Regression gate: run the full existing catalog test suite (`domain/catalog/**`, `application/catalog/**` tests that exercise `findByNormalizedPlate` and plate matching, e.g. `match-and-apply-provider-candidate.test.ts`) and confirm no existing case regresses. Do not proceed to Phase 3+ until this passes.
  - Result: `npx vitest run domain/catalog application/catalog application/catalog-global integrations/howen integrations/cybermapa` → 41 files, 363 tests, all passed.

## Phase 1: Dependency Checkpoint — `read-excel-file`

- [x] 1.1 Add `read-excel-file` to `package.json` dependencies per the design's library decision.
- [x] 1.2 Checkpoint: write a minimal adapter smoke check that imports `read-excel-file`'s browser entry under the project's jsdom test environment and confirms it resolves an `ArrayBuffer` into a grid without a Node-only code path. If it does not work under jsdom, switch the import to `read-excel-file/node` for the test environment and record that decision inline in this task file (append a note under this task) before continuing to Phase 3. Do not silently swap without recording it.
  - Decision recorded: `read-excel-file/browser`'s `readSheet(input)` (v9.3.10 — the package has no bare `"."` export; `/browser` and `/node` are the two entry points) resolved a real `.xlsx` fixture's `ArrayBuffer` into a grid correctly under the project's jsdom test environment (Vitest, `environment: "jsdom"`), and rejected non-workbook bytes. No `read-excel-file/node` fallback needed. `read-workbook-grid.ts` (Phase 7) uses `read-excel-file/browser`'s `readSheet` via dynamic `import()`.

## Phase 2: Fixture Workbook

- [x] 2.1 Create a committed fixture workbook under `integrations/driving-index/fixtures/` (e.g. `sample-trip-workbook.xlsx`) encoding: a `Dominio` column (plus `Fecha`, `Viaje`, `Empresa`), at least one trip whose `Fecha`/`Viaje` are blank on continuation rows (forward-fill case), the same plate repeated across multiple trips in inconsistent casing/separators (`ab-123-cd`, `AB123CD`, ` AB123CD `), one row with a blank `Dominio`, and headers exercising case/accent-insensitive resolution (e.g. `dominio` or `DOMÍNIO`).
  - Note: the library trims surrounding whitespace off inline-string cell values on read, so the on-disk ` AB123CD ` cell is observed as `AB123CD` after parsing — inconsistent casing/separators are still covered by `ab-123-cd` vs `AB123CD`; `normalizePlate` also trims, so this does not weaken the scenario.
- [x] 2.2 Document the fixture's shape in a short comment-free note in `integrations/driving-index/fixtures/README.md` or equivalent, marking it as a reconstructed contract pending validation against a real customer workbook (per design's Open Questions).

## Phase 3: Domain — Report Period and Plate Format (uses widened plate.ts)

- [x] 3.1 (RED) Write failing tests for `domain/driving-index/report-period.ts`: valid month/year construction, rejection or type-level enforcement of the "no default from current date" rule as specified.
- [x] 3.2 (GREEN) Implement `domain/driving-index/report-period.ts` (`ReportPeriod` value object) to pass 3.1.
- [x] 3.3 (RED) Write failing tests for `classifyPlateFormat` (`domain/catalog/matching.ts`, see Phase 0 deviation note): `legacy` (`/^[A-Z]{3}\d{3}$/`), `mercosur` (`/^[A-Z]{2}\d{3}[A-Z]{2}$/`), `unknown` for everything else, including the widened normalization inputs from Phase 0.
- [x] 3.4 (GREEN) Implement `classifyPlateFormat` in `domain/catalog/matching.ts` (re-exported via `domain/catalog/index.ts`) to pass 3.3.

## Phase 4: Application Contracts and Port

- [x] 4.1 Define `application/driving-index/contracts.ts`: `PlateFormat` (import from domain), `WorkbookRow`, `WorkbookParseFailureCode`, `WorkbookParseResult`, `DrivingIndexWorkbookParser`, `DrivingIndexVehicleRow`, `DrivingIndexReportDraft`, per the design's contract block. Pure types — no test required beyond typecheck. `tsc --noEmit` passes.

## Phase 5: Application — Dedupe and Draft Builder

- [x] 5.1 (RED) Write failing tests for `application/driving-index/build-driving-index-report-draft.ts` over hand-built `WorkbookRow[]`: dedupe across rows/trips/companies to one entry per canonical plate, alphabetical sort by `canonicalPlate`, `no-usable-rows` failure when input rows are empty or all excluded, retention of `displayPlate` and `plateFormat` per vehicle.
  - Deviation: added `DrivingIndexReportDraftFailureCode` / `DrivingIndexReportDraftResult` to `contracts.ts` — the design's contract block did not define a wrapper type for the builder's `no-usable-rows` outcome, only mentioned it in the Data Flow prose. Kept minimal and consistent with `WorkbookParseResult`'s `{ kind, ... }` shape.
- [x] 5.2 (GREEN) Implement `buildDrivingIndexReportDraft(rows, period)` to pass 5.1, using `normalizePlate` and `classifyPlateFormat` from `domain/catalog` (see Phase 0 deviation note — not `domain/catalog/plate.ts`).

## Phase 6: Adapter — Pure Format Parser (no library, no browser)

- [x] 6.1 (RED) Write failing tests for `integrations/driving-index/spreadsheet-workbook-parser.ts` over inline `WorkbookGrid` arrays: header resolution case/accent-insensitive for `Dominio`, forward-fill of blank `Fecha`/`Viaje` continuation rows, exclusion of a row with blank `Dominio` after forward-fill without aborting the rest, `missing-plate-column` failure when no header resolves to `Dominio`.
- [x] 6.2 (GREEN) Implement `spreadsheet-workbook-parser.ts` (`WorkbookGrid -> WorkbookParseResult`) to pass 6.1. Headers-only grid (zero data rows) returns `{ kind: "parsed", rows: [] }`, not a failure — per design's failure split, `no-usable-rows` is the builder's judgement, not the parser's.

## Phase 7: Adapter — Library Boundary (browser grid reader)

- [x] 7.1 (RED) Write a failing test for `integrations/driving-index/read-workbook-grid.ts` using the Phase 2 fixture: `.xlsx` bytes parse into the expected grid shape; non-workbook bytes (e.g. plain text or PDF bytes) produce an `unreadable-file` outcome.
- [x] 7.2 (GREEN) Implement `read-workbook-grid.ts` as the sole module importing `read-excel-file` (or `read-excel-file/node`, per the Phase 1.2 checkpoint decision), loaded via dynamic `import()` inside the module, to pass 7.1. Uses `read-excel-file/browser`'s `readSheet`.
- [x] 7.3 Record the measured lazy-chunk bundle size for `read-excel-file` here (append the observed size from the Phase 7.2/Phase 12 build output) — do not assume a number ahead of the measurement, per design's Open Questions. Measured from `npm run build` (Next 16 / Turbopack, production): `.next/static/chunks/2vmdv6q7gfc3e.js` — 79,214 bytes raw (~77.4 KiB), 24,173 bytes gzip (~23.6 KiB). Confirmed lazy (contains the library's Web Worker Blob-URL bootstrap; not referenced by the RSC client-reference-manifest for `/indice-manejo`, meaning it is not part of that route's required-on-load chunk set — it loads only when `read-workbook-grid.ts`'s dynamic `import()` actually runs, i.e. on first file selection).

## Phase 8: Composition Root

- [x] 8.1 Wire `app/indice-manejo/create-workbook-parser.ts` composing `read-workbook-grid` + `spreadsheet-workbook-parser` into a `DrivingIndexWorkbookParser`, mirroring `app/live/create-operational-sources.ts`'s composition pattern (the design's literal reference, `app/live/create-catalog-source.ts`, does not exist in this codebase — no file of that name anywhere in `app/live`). Composition has one branch (`unreadable-file` short-circuit), so added a thin integration test using the fixture, per the task's own escape hatch.

## Phase 9: Presentational Components

- [x] 9.1 (RED) Write failing component tests (React Testing Library) for `components/driving-index/report-period-picker.tsx`: month/year selection, no default period on mount.
- [x] 9.2 (GREEN) Implement `report-period-picker.tsx` to pass 9.1.
- [x] 9.3 (RED) Write failing component tests for `components/driving-index/workbook-upload-field.tsx`: file selection triggers the provided callback with the selected file's bytes/handle; no parsing logic inside the component itself.
- [x] 9.4 (GREEN) Implement `workbook-upload-field.tsx` to pass 9.3.
  - Gotcha: jsdom's `File` in this project's Vitest environment does not implement `.arrayBuffer()`/`.text()` (both `undefined`), so `file.arrayBuffer()` throws at test time. Used `FileReader.readAsArrayBuffer`, which jsdom does implement correctly and which also works in real browsers — safer and more portable than the Blob method here.
- [x] 9.5 (RED) Write failing component tests for `components/driving-index/vehicle-measurement-table.tsx`: renders one row per vehicle, KR input per row, KP input once for the period, values reflect props, re-sort/re-render preserves displayed values (props-driven, no internal state duplication).
- [x] 9.6 (GREEN) Implement `vehicle-measurement-table.tsx` to pass 9.5.
- [x] 9.7 (RED) Write failing component tests for `components/driving-index/workbook-notice.tsx`: distinct readable Spanish copy for `unreadable-file`, `missing-plate-column`, and `no-usable-rows`, rendered with `aria-live="polite"`.
- [x] 9.8 (GREEN) Implement `workbook-notice.tsx` to pass 9.7.

## Phase 10: Screen Composition and State

- [x] 10.1 (RED) Write failing tests for `app/indice-manejo/driving-index-screen.tsx` using a stub parser: period selection updates state without affecting workbook state; a successful parse populates the vehicle table; a failed parse renders the matching `workbook-notice` variant and no table; entering KR/KP persists across a forced re-render/re-sort; uploading a second workbook clears prior KR/KP and replaces the vehicle list (per spec's re-upload requirement).
- [x] 10.2 (GREEN) Implement `driving-index-screen.tsx` ("use client") with the three independent `useState` shapes from the design (Period, Workbook, Measurements) to pass 10.1. 95 lines — under the 120-line target, no split needed. A `no-usable-rows` failure from `buildDrivingIndexReportDraft` (e.g. every row's plate normalizes blank) routes through the same `workbook: { kind: "failed" }` state as a parser failure, reusing `WorkbookNotice`.

## Phase 11: Route and Guard

- [x] 11.1 (RED) Write a failing test for `app/indice-manejo/page.tsx` following the `app/live/page.test.tsx` pattern: mocks `requirePageAuthorization` with an `"operator"` role expectation, asserts the guard is called, asserts `<DrivingIndexScreen />` renders.
- [x] 11.2 (GREEN) Implement `app/indice-manejo/page.tsx` as a Server Component calling `await requirePageAuthorization("operator")` to pass 11.1.

## Phase 12: Documentation

- [x] 12.1 Add or update `docs/architecture/` documentation describing the `driving-index` module boundary (port, adapter split, domain plate reuse, out-of-scope Howen/IM concerns), per the proposal's Affected Areas. Added `docs/architecture/10-driving-index-workbook-import.md`, explicitly noting the `plate.ts` vs `matching.ts` deviation.

## Phase 13: Validation Gates

- [x] 13.1 Run `npm run lint` and resolve any findings introduced by this change. Result: 0 errors, 1 pre-existing warning in generated `coverage/block-navigation.js` (unrelated to this change).
- [x] 13.2 Run `npm run typecheck` and resolve any findings introduced by this change. Result: clean, no output.
- [x] 13.3 Run `npm test` (full suite, including the Phase 0.4 regression gate re-run) and confirm all pass. Result: 132 test files, 1056 tests, all passed (default + system + mongodb configs).
- [x] 13.4 Run `npm run build` and record the observed `read-excel-file` lazy-chunk size in the Phase 7.3 note if not already captured from a dev build. Result: build succeeded (`✓ Compiled successfully`, TypeScript pass, 22/22 static pages generated); `/indice-manejo` present as a dynamic route (`ƒ`). See Phase 7.3 for the chunk size. Note: the first build surfaced a real bug — see "Bug found and fixed via the build gate" below — fixed, then rebuilt clean.

### Bug found and fixed via the build gate

The first `npm run build` succeeded structurally but `app/indice-manejo/page.tsx` (a Server Component) was calling `createWorkbookParser()` and passing the resulting object — which contains an async `.parse` function — as the `parser` prop into `<DrivingIndexScreen>` (a `"use client"` component). Per Next's own docs (`node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`: "Props passed to Client Components need to be serializable by React"), functions cannot cross the Server→Client boundary this way; this would fail at runtime the first time the route is actually requested (the build's static-generation pass does not exercise this path for a `ƒ` dynamic route, so the build itself did not catch it — only reasoning about the RSC boundary did). Fixed by making `parser` an optional prop on `DrivingIndexScreen`, defaulting to `createWorkbookParser()` created client-side via a lazy `useState` initializer when not explicitly injected (tests still inject a stub parser directly); `page.tsx` no longer imports or calls `create-workbook-parser.ts` at all. Re-ran the full `app/indice-manejo` test subset (9/9 green), typecheck, lint, and rebuild (clean) after the fix.

## Deviations from design (summary)

1. **`domain/catalog/plate.ts` does not exist.** `normalizePlate` lives in `domain/catalog/matching.ts` (re-exported via `domain/catalog/index.ts`); `classifyPlateFormat` was added there too. Every caller already imports from the `@/domain/catalog` barrel, so this is invisible to consumers — only the concrete file path differs from the design's assumption. Documented in `docs/architecture/10-driving-index-workbook-import.md`.
2. **`app/live/create-catalog-source.ts` does not exist.** No file of that name exists anywhere in `app/live`; the closest real precedent is `app/live/create-operational-sources.ts`, which `app/indice-manejo/create-workbook-parser.ts` mirrors instead.
3. **`DrivingIndexReportDraftResult` added to `contracts.ts`.** The design's contract block did not define a wrapper type for the builder's `no-usable-rows` outcome (only mentioned in Data Flow prose) — added a minimal `{ kind: "built" | "failed" }` type consistent with `WorkbookParseResult`'s shape.
4. **`file.arrayBuffer()` unavailable under this project's jsdom.** `workbook-upload-field.tsx` uses `FileReader.readAsArrayBuffer` instead — works under jsdom and in real browsers.

None of these change the module boundary, the port contract, or any spec scenario's observable behavior.

## Notes to carry into apply

- Phase 0 is a hard prerequisite for Phase 3 (`classifyPlateFormat` lives in the same file being widened) and everything downstream. Do not start Phase 3+ before Phase 0.4's regression gate is green.
- Phase 1.2's jsdom checkpoint is a hard prerequisite for Phase 7. If it forces the `read-excel-file/node` fallback, that changes what Phase 7.2 imports — do not treat it as a detail to discover mid-Phase-7.
- Phases 3-7 (domain, application, adapter) have no cross-dependency on Phases 9-11 (components, screen, route) except through the contracts defined in Phase 4, so those two groups could in principle proceed in parallel across two contributors; within each group, tasks are sequential (RED before GREEN, lower-numbered phases before higher).
