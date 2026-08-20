# Design: Driving Index workbook import and vehicle list

## Technical Approach

The workbook is an external payload, handled exactly like a provider feed. A port in `application/driving-index` declares `parse(bytes) -> rows`; one adapter pair in `integrations/driving-index` implements it. Plate identity is a domain rule reused from `domain/catalog/plate.ts`; deduplication and view-model composition live in an application builder; the screen owns input state only.

The adapter is split in two so the format quirks are testable without a spreadsheet library or a browser:

- `read-workbook-grid.ts` — the only module that imports the library. `ArrayBuffer -> WorkbookGrid` (`(string | number | null)[][]`). One fixture test.
- `spreadsheet-workbook-parser.ts` — pure `WorkbookGrid -> WorkbookParseResult`. Header resolution, forward-fill, row extraction, failure codes. Tested with inline grids.

## Architecture Decisions

| Decision | Rejected | Rationale |
|---|---|---|
| Parse client-side, no upload endpoint | Upload route + server parse | The customer's operational workbook never leaves the machine: no multipart handling, temp files, size limits, or new auth surface. A malformed or zip-bomb file costs the uploader's own tab, not a shared server. Matches the proposal's one-folder rollback. |
| `read-excel-file` (MIT, read-only) | `xlsx` (SheetJS): npm frozen at 0.18.5 with published prototype-pollution and ReDoS advisories, current builds only on the vendor CDN — a supply-chain smell under AGENTS.md library discipline. `exceljs`: heavy, and its writing/styling/streaming value is unused here. | Smallest surface that satisfies the requirement. No write path means less attack surface. Its output is already the raw cell grid the adapter needs. |
| Load it via dynamic `import()` inside `read-workbook-grid.ts` | Static top-level import | Next 16 code-splits dynamic `import()` into a lazy chunk (`docs/01-app/02-guides/lazy-loading.md`, "Loading External Libraries"). Cost is paid once, on first file selection, and never on initial load or any other route. Bundle size becomes deferred latency, not page weight. |
| Reuse and widen `domain/catalog/plate.ts` | New `normalizeDrivingIndexPlate` in `domain/driving-index` | Two normalizations would silently break Howen device matching later. One canonical plate identity across catalog and driving-index is the whole forward-compat story. Current impl does not strip dots, which the spec requires. |
| Dedupe in the application builder, identity rule in domain | Dedupe as a domain function (proposal wording) | Deduplication operates on `WorkbookRow[]`, an application contract; domain must not know workbook shapes. The *rule* (canonical plate) stays in domain. Explicit refinement of the proposal. |
| Port returns a `Promise` | Synchronous signature | Moving the parse behind a route handler later becomes a composition change, not a contract change. |

## Plate Normalization Contract

`normalizePlate(raw)`, in order: trim; strip Unicode whitespace including NBSP (`U+00A0`) and zero-width characters (`U+200B`–`U+200D`, `U+FEFF`), which Excel exports carry routinely; strip separators `-`, `.`, `_`, `/`; uppercase.

`classifyPlateFormat(canonical)`: `/^[A-Z]{3}\d{3}$/` → `legacy`; `/^[A-Z]{2}\d{3}[A-Z]{2}$/` → `mercosur`; else `unknown`.

Empty after normalization → row excluded. `unknown` is **never** dropped: the workbook is authoritative (proposal Q2), so silently discarding a vehicle would corrupt the report. `plateFormat` rides in the contract for later Howen matching; this slice renders no column for it.

## Data Flow

    File ─(arrayBuffer)→ read-workbook-grid ─grid→ spreadsheet-workbook-parser ─rows→
      buildDrivingIndexReportDraft(rows, period) ─draft→ screen ─props→ presentational components

Failure split: the parser owns `unreadable-file` and `missing-plate-column` (format judgements); the builder owns `no-usable-rows` (a normalization judgement).

## Layer Placement

| Concern | Path |
|---|---|
| Plate identity + format | `domain/catalog/plate.ts` (modified) |
| Report period value object | `domain/driving-index/report-period.ts` |
| Port, view model, failure codes | `application/driving-index/contracts.ts` |
| Dedupe + composition | `application/driving-index/build-driving-index-report-draft.ts` |
| Library boundary | `integrations/driving-index/read-workbook-grid.ts` |
| Format quirks | `integrations/driving-index/spreadsheet-workbook-parser.ts` |
| Composition root | `app/indice-manejo/create-workbook-parser.ts` (mirrors `app/live/create-catalog-source.ts`) |
| Route + screen | `app/indice-manejo/{page,driving-index-screen}.tsx` |
| Presentational | `components/driving-index/*` |

## Contracts

```ts
export type PlateFormat = "legacy" | "mercosur" | "unknown";
export type ReportPeriod = { month: number; year: number };
export type WorkbookRow = { date?: string; trip?: string; plate: string; company?: string };
export type WorkbookParseFailureCode = "unreadable-file" | "missing-plate-column" | "no-usable-rows";
export type WorkbookParseResult =
  | { kind: "parsed"; rows: WorkbookRow[] }
  | { kind: "failed"; code: WorkbookParseFailureCode };
export type DrivingIndexWorkbookParser = { parse(bytes: ArrayBuffer): Promise<WorkbookParseResult> };
export type DrivingIndexVehicleRow = { canonicalPlate: string; displayPlate: string; plateFormat: PlateFormat };
export type DrivingIndexReportDraft = { period: ReportPeriod; vehicles: DrivingIndexVehicleRow[] };
```

Vehicles sort alphabetically by `canonicalPlate` so the same rows in any workbook order produce the same report.

## Route and Screen Composition

`/indice-manejo`. `page.tsx` is a Server Component (`await requirePageAuthorization("operator")`, heading, `<DrivingIndexScreen />`) — server because the guard is async and redirects. `driving-index-screen.tsx` is `"use client"` because it needs the `File` API and `useState`; it holds state and composes, target under 120 lines. Children are dumb props-in/JSX-out: `report-period-picker`, `workbook-upload-field`, `vehicle-measurement-table`, `workbook-notice` (the single home for Spanish failure copy).

The repo has no shadcn/Radix, so this is plain semantic HTML plus Tailwind utilities on the existing dark palette. The notice region uses `aria-live="polite"`, matching `app/admin/import`.

## State Shape

Three independent `useState` calls, no reducer, no store:

| State | Shape | Note |
|---|---|---|
| Period | `{ month: number \| null; year: number \| null }` | Starts unselected. The spec forbids deriving it from the current date, which also avoids a hydration mismatch. |
| Workbook | `{ kind: "idle" } \| { kind: "parsing" } \| { kind: "ready"; vehicles } \| { kind: "failed"; code }` | One union, not four booleans. |
| Measurements | `{ realKilometersByPlate: Record<string, string>; plannedKilometers: string }` | Keyed by canonical plate so re-render and re-sort preserve values. Held as strings and parsed on read, so typing a decimal point is not eaten. |

A successful new parse resets Measurements to empty, per the spec's re-upload requirement. Period is untouched by parsing; parsing is untouched by period.

## Forward Compatibility

| Type | Fate | Why |
|---|---|---|
| `DrivingIndexVehicleRow` | Extended with optional `deviceId`, `alarms`, `drivingIndex` | `canonicalPlate` already equals `CatalogVehicle.normalizedPlate` (same function), so device resolution is a lookup, not a re-parse. |
| `DrivingIndexReportDraft` | Extended with optional `measurements` when persistence arrives | Already serializable. |
| `DrivingIndexWorkbookParser` | Unchanged | `ArrayBuffer` in, serializable rows out, already async — the adapter runs verbatim in Node behind a route handler. |
| Everything in `domain/` | Unchanged | Pure rules. |

Only the composition root moves if the file must reach the server.

## Testing Strategy

| Layer | What | How |
|---|---|---|
| Domain | Normalization (case, whitespace, NBSP, `-`/`.`/`_`), format classification, period validity | Vitest, table-driven, no I/O |
| Application | Dedupe across rows/trips/companies, sort order, `no-usable-rows` | Vitest over hand-built `WorkbookRow[]` |
| Adapter (pure) | Header resolution case/accent-insensitive, forward-fill, blank `Dominio` skipped, `missing-plate-column` | Vitest over inline grids — no library, no browser |
| Adapter (library) | Real `.xlsx` → grid; non-workbook bytes → `unreadable-file` | One committed fixture under `integrations/driving-index/fixtures/` |
| Component | Period selection, parse states, KR/KP persistence across re-sort, distinct failure copy | React Testing Library with a stub parser |
| Route | `operator` guard redirects | Existing page-authorization test pattern |

## Rollout

No migration, no flag, no persisted data. Additive folders plus one dependency.

## Open Questions

- [ ] Exact installed bundle size of `read-excel-file` — record the measured lazy-chunk size during apply rather than assuming it.
- [ ] No real workbook exists in the repo; the committed fixture encodes the described contract and must be re-validated against a customer file.
