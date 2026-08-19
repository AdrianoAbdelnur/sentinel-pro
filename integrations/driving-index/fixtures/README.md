# Driving index sample trip workbook

`sample-trip-workbook.xlsx` is a reconstructed contract, not a real customer export. It has not been validated against an actual operational workbook and must be re-validated once one is available (see the design's Open Questions).

## Shape

Sheet `Viajes`, headers on row 1: `Fecha`, `Viaje`, `DOMÍNIO`, `Empresa`. The `Dominio` header is spelled `DOMÍNIO` on purpose to exercise case- and accent-insensitive header resolution.

| Row | Fecha | Viaje | DOMÍNIO | Empresa | Purpose |
|---|---|---|---|---|---|
| 2 | 2024-05-01 | T1 | `ab-123-cd` | Acme | First row of a trip, hyphenated plate |
| 3 | (blank) | (blank) | `AB123CD` | Acme | Continuation row — forward-fills `Fecha`/`Viaje` from row 2, same plate without separators |
| 4 | (blank) | (blank) | `AB123CD` | Beta | Continuation row — same plate again under a different `Empresa`, proving company does not affect identity |
| 5 | 2024-05-02 | T2 | (blank) | Acme | Blank `Dominio` — must be excluded without aborting the rest |
| 6 | 2024-05-03 | T3 | `XY456ZT` | Acme | A second, distinct vehicle |

Expected parse: rows 2-4 deduplicate to one vehicle (`AB123CD`), row 5 is excluded, row 6 produces a second vehicle. Two vehicles total.

Regenerated with Python's standard-library `zipfile` (a minimal hand-built OOXML package, cell values as `inlineStr`) rather than a JS spreadsheet-writing dependency, so the fixture ships with no new build-time library. See `driving-index-excel-import`'s apply-progress for the generation script.
