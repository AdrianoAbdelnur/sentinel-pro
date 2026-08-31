# Proposal: Driving Index workbook import and vehicle list

## Intent

Compliance reporting for the mine fleet starts from an operational Excel the customer already produces per trip, not from Sentinel data. Today an analyst rebuilds the evaluated vehicle list by hand every month, which is slow, unauditable, and the reason the Driving Index (Índice de Manejo) cannot be produced repeatably. This slice creates the screen and the first trustworthy step: turn that workbook plus a reporting period into a deduplicated vehicle list ready to be measured.

## Proposal question round

Answers may change scope; assumptions below are used until corrected.

1. Who owns this screen — administrators only, or any operator? Assumed: `operator` guard, matching `/live`.
2. Is the workbook the authoritative fleet for the period, or must the list later reconcile against the canonical Sentinel catalog? Assumed: workbook is authoritative.
3. If the typed KP is inconsistent with the typed KR values, should the screen warn, block, or accept silently? Assumed: accept silently.
4. A plate can appear under different `Empresa` values across trips. Is company part of the vehicle identity for the report? Assumed: no — plate alone identifies the vehicle.
5. Must the upload and the typed KR/KP survive a page reload? Assumed: no, in-memory only for this slice.

## Scope

### In Scope
- New `/indice-manejo` screen behind the existing page authorization guard.
- Month/year period selector as an explicit report input.
- Workbook upload parsed by a dedicated adapter that forward-fills trip-grouped rows (`Fecha`, `Viaje` blank on continuation rows).
- Domain plate normalization and deduplication to a unique vehicle list.
- Vehicle table with a KR field per row and one KP field for the period, held as report inputs.
- Readable failures for unreadable files, missing `Dominio` column, and zero usable rows.

### Out of Scope
- Any Howen call, device resolution, alarm query, or IM calculation.
- Persisting the workbook, the vehicle list, or the typed KR/KP.
- CERSAT events, NFH, out-of-hours windows, speed thresholds.
- Automatic KP derivation from the entered KR values.

## Capabilities

### New Capabilities
- `driving-index-workbook-import`: period selection, workbook parsing, plate deduplication, and the manual KR/KP input contract for a Driving Index report.

### Modified Capabilities
- None.

## Approach

Treat the workbook as an external payload, exactly like a provider feed. A parser port lives in `application/driving-index`; a single spreadsheet adapter in `integrations/driving-index` implements it and absorbs every format quirk — header resolution, merged/blank continuation cells, forward-fill. It returns plain rows only.

Plate normalization and deduplication are pure domain functions. An application builder turns `(rows, period)` into a serializable `DrivingIndexReportDraft` view model. The screen renders that view model and owns nothing but input state.

Parsing runs at the browser edge in this slice, so no upload endpoint or stored file is introduced. Because the draft is serializable and the parser is a pure function over bytes, the later Howen slice can post the plate list to a route handler, or move the adapter server-side, without changing a single contract.

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `app/indice-manejo/page.tsx` | New | Route with `requirePageAuthorization`. |
| `app/indice-manejo/driving-index-screen.tsx` | New | Client composition of period, upload, table. |
| `components/driving-index/*` | New | Small presentational pieces (period picker, vehicle table, empty/error states). |
| `domain/driving-index/*` | New | Plate value object, normalization, report period. |
| `application/driving-index/contracts.ts` | New | Parser port, draft view model, error results. |
| `application/driving-index/build-driving-index-report-draft.ts` | New | Dedupe and view-model composition. |
| `integrations/driving-index/*` | New | Spreadsheet adapter and fixture-driven tests. |
| `package.json` | Modified | Spreadsheet parsing dependency. |
| `docs/architecture/` | New | Document the driving-index module boundary. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| No real workbook in the repo; the described format may differ | High | Build fixtures from the described contract, resolve headers case/accent-insensitively, fail loudly on an unmapped `Dominio`. |
| New third-party dependency conflicts with the repo's library discipline | Medium | Confine it to one adapter file behind the port; the rest of the codebase never imports it. |
| Unknown plate formatting rules cause wrong deduplication | Medium | Normalization is a tested domain function; keep the raw plate alongside the canonical one for later Howen matching. |
| Manual KR/KP feels disposable without persistence | Medium | Explicit non-goal here; key inputs by canonical plate so they survive re-renders and re-sorting. |
| Screen grows into a page-level god component | Low | Split presentational pieces from the start; keep business logic out of `components/*`. |

## Rollback Plan

Delete the new `app/indice-manejo`, `components/driving-index`, `domain/driving-index`, `application/driving-index`, and `integrations/driving-index` folders and remove the spreadsheet dependency. No existing route, contract, schema, or persisted data is touched, so removal is a clean revert of one additive commit.

## Dependencies

- A spreadsheet parsing library (selection deferred to design).
- Existing `requirePageAuthorization` and the app shell.
- A representative real workbook to validate the parser against.

## Success Criteria

- [ ] An authorized user opens `/indice-manejo`, picks a month and year, and uploads the workbook.
- [ ] Trip-grouped rows with blank `Fecha`/`Viaje` are read correctly instead of being dropped.
- [ ] Each plate appears exactly once regardless of how many rows or trips contain it.
- [ ] KR can be entered per vehicle and KP once for the period, and both persist across re-render within the session.
- [ ] Unreadable files, a missing `Dominio` column, and empty results produce distinct readable messages instead of a blank table.
- [ ] No module outside `integrations/driving-index` imports the spreadsheet library.
