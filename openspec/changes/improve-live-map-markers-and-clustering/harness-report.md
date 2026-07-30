# Live Map Clustering Harness Report

## Gate Result

**PASS**

The isolated 621-point harness passed the mandatory visible-browser gate in
Google Chrome at:

`http://localhost:3000/dev/live-map-clustering-harness?autorun=1`

Evidence was captured from the rendered harness after its browser-only autorun
completed every interaction.

## Performance Evidence

| Measurement | Required | Observed | Result |
|---|---:|---:|---|
| Points | 621 | 621 | PASS |
| Index build | `<50 ms` | `15.30 ms` | PASS |
| Query p95 | `<16 ms` | `0.40 ms` | PASS |
| Clustering long tasks | `0` at `>=50 ms` | `0` | PASS |

## Interaction Evidence

| Check | Observed | Result |
|---|---|---|
| Heartbeat | `1264` | PASS |
| Click count | `1` | PASS |
| Click feedback | `next frame` | PASS |
| Resize count | `1` | PASS |
| Exercised checks | `5/5` | PASS |
| Final mode | `collapsed` | PASS |
| Automatic gate | `PASS` | PASS |

## Scope

This report closes only the isolated browser gate. The harness exercised
benchmarking, heartbeat, click feedback, cluster expansion, maximum-zoom fan,
collapse, and resize without modifying the operational `/live` page.

Phase 3 may now begin from the stable direct-marker implementation. Operational
fleet, checkbox, filter, and real-cardinality verification remains part of
Phase 4.
