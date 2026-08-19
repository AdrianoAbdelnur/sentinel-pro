# Driving Index Workbook Import

## Goal

Turn an operational trip workbook plus a reporting period into a deduplicated vehicle list with manual KR/KP inputs. This is the first slice of the Driving Index (Índice de Manejo) feature — Howen device resolution, alarms, IM calculation, and persistence are explicitly out of scope here.

## Boundary

The workbook is treated as an external payload, exactly like a provider feed — not as Sentinel's own data.

```
File (browser) ─(ArrayBuffer)→ read-workbook-grid ─grid→ spreadsheet-workbook-parser ─rows→
  buildDrivingIndexReportDraft(rows, period) ─draft→ driving-index-screen ─props→ presentational components
```

| Layer | Path | Responsibility |
|---|---|---|
| Domain | `domain/driving-index/report-period.ts` | `ReportPeriod` value object — explicit month/year, no current-date default |
| Domain (shared) | `domain/catalog/matching.ts` | `normalizePlate` (widened) and `classifyPlateFormat` — see "Plate identity is shared" below |
| Application | `application/driving-index/contracts.ts` | Port (`DrivingIndexWorkbookParser`), row/draft/failure types |
| Application | `application/driving-index/build-driving-index-report-draft.ts` | Deduplication by canonical plate, alphabetical sort, `no-usable-rows` judgement |
| Integration | `integrations/driving-index/read-workbook-grid.ts` | The only module that imports the `read-excel-file` library, dynamically |
| Integration | `integrations/driving-index/spreadsheet-workbook-parser.ts` | Pure format quirks: header resolution, forward-fill, row extraction |
| Composition | `app/indice-manejo/create-workbook-parser.ts` | Wires the two integration modules into the `DrivingIndexWorkbookParser` port |
| Delivery | `app/indice-manejo/page.tsx`, `driving-index-screen.tsx` | Route guard + client state composition |
| Presentational | `components/driving-index/*` | Period picker, upload field, vehicle table, failure notice |

## Adapter split

`integrations/driving-index` is split in two so format quirks are testable without a spreadsheet library or a browser:

- `read-workbook-grid.ts` — `ArrayBuffer -> WorkbookGrid` (`(string | number | null)[][]`). The sole importer of `read-excel-file`, loaded via dynamic `import()` so it lands in its own lazy chunk (Next 16 code-splitting), paid once on first file selection.
- `spreadsheet-workbook-parser.ts` — pure `WorkbookGrid -> WorkbookParseResult`. Header resolution is case- and accent-insensitive; blank `Fecha`/`Viaje` cells forward-fill from the nearest preceding row; a blank `Dominio` excludes that row without aborting the rest.

Failure ownership is split by judgement kind: the parser owns `unreadable-file` and `missing-plate-column` (format judgements); the application builder owns `no-usable-rows` (a normalization judgement — every row's plate normalized to blank).

## Plate identity is shared, not duplicated

`normalizePlate` already existed in `domain/catalog/matching.ts` (re-exported via `domain/catalog/index.ts`) as the canonical plate identity for the provider catalog, including `findByNormalizedPlate` lookups in the global catalog repositories. This slice widened that same function — rather than introducing a second `normalizeDrivingIndexPlate` — to also strip `.`, `_`, `/` separators and zero-width/BOM characters that Excel exports carry. `classifyPlateFormat` (`legacy` / `mercosur` / `unknown`) was added alongside it in the same file.

One canonical plate identity across the catalog and the driving-index import is the whole forward-compatibility story: `DrivingIndexVehicleRow.canonicalPlate` already equals `CatalogVehicle.normalizedPlate`, so a later Howen-matching slice is a lookup, not a re-parse.

Note: the design that shaped this slice referred to this file as `domain/catalog/plate.ts`. No such file exists in this codebase — `normalizePlate` lives in `domain/catalog/matching.ts`. This document reflects the actual location.

## Client-side parsing

Parsing runs at the browser edge in this slice. There is no upload endpoint and no stored file: the operational workbook never leaves the user's machine. `DrivingIndexWorkbookParser.parse(bytes: ArrayBuffer): Promise<WorkbookParseResult>` is already async and returns serializable data, so moving the adapter behind a route handler later is a composition change in `app/indice-manejo/create-workbook-parser.ts`, not a contract change.

## Out of scope for this slice

- Howen call, device resolution, alarm query, IM calculation.
- Persisting the workbook, the vehicle list, or the typed KR/KP (in-memory only, per session).
- CERSAT events, NFH, out-of-hours windows, speed thresholds.
