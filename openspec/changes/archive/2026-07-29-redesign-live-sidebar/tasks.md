# Tasks: Redesign and Reconcile the Live Sidebar

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 80-180 corrective lines |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR and one corrective work-unit commit |
| Delivery strategy | single-pr |
| Chain strategy | pending (not applicable below budget) |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

No size exception is required.

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|---|---|---|---|
| 1 | Reconcile tests, fleet-label typography, and SDD truth | PR 1 | Tests, minimal UI change, docs, verification, and archive stay together |

## Phase 1: Completed Historical Implementation

- [x] 1.1 Added provider-agnostic status derivation, optional `DeviceTelemetry.online`, and runtime injection of `SENTINEL_LIVE_STALE_AFTER_MS` with a `300000` ms fallback.
- [x] 1.2 Replaced application messages with delivery-owned copy codes while retaining arbitrary bottom-panel column keys and raw-key fallback.
- [x] 1.3 Rebuilt sidebar composition around scalar status/provider filters, full-roster `online/total` counts, bounded search, and selection independent of narrowing.
- [x] 1.4 Added normalized fixtures, focused filter/list components, independent list scrolling, plate-first rows, and provider-agnostic rendering.
- [x] 1.5 Completed the original tests and quality checks. That evidence is historical and does not close this corrective cycle.

Historical claims of `w-80`, multi-status sets, per-status counts, exhaustive column translation, and rendered playback notices are superseded by the corrected proposal, specs, and design.

## Phase 2: RED — Corrective Runtime Proof

- [x] 2.1 In `components/live/sidebar/live-fleet-node.test.tsx`, require one-line truncation with compact mixed-case typography and forbid forced uppercase/wide tracking. RED reproduced in a detached `HEAD` worktree with the corrective test copied in: `node <repo>/node_modules/vitest/vitest.mjs run components/live/sidebar/live-fleet-node.test.tsx -t "keeps a long mixed-case fleet label compact on one truncated line"` -> 1 failed because production still rendered `text-[11px] uppercase tracking-[0.14em]` instead of `text-xs` without forced casing/tracking.
- [x] 2.2 In `components/live/sidebar/live-sidebar.test.tsx`, prove only the fleet-list region owns `overflow-y-auto` while controls and the `w-72` shell remain fixed. The accepted behavior predated this corrective test, so no historical RED is claimed. Mutation RED was reproduced in the detached worktree by moving `overflow-y-auto` to the shell and removing it from the list region; the focused command with `-t "keeps controls fixed while only the fleet-list region owns vertical scrolling"` produced 1 failed test at the shell overflow assertion.
- [x] 2.3 In `domain/live/vehicle-status.test.ts`, prove explicit `online: true` beats a stale timestamp. The accepted behavior predated this corrective test, so no historical RED is claimed. Mutation RED was reproduced in the detached worktree by removing explicit-true precedence; the focused command with `-t "trusts explicit online true even when the report timestamp is stale"` produced 1 failed test (`offline` received instead of `en-route`).
- [x] 2.4 In `application/live/build-live-sidebar-view-model.test.ts`, prove search matches fleet label, vehicle label, and plate but ignores `internalCode`. Existing tests already cover positive fleet-label, vehicle-label, and plate matches. Mutation RED was reproduced in the detached worktree by adding `internalCode` to matching; the focused command with `-t "does not match a vehicle by its internal code"` produced 1 failed test because a fleet was returned instead of `[]`.

## Phase 3: GREEN / REFACTOR

- [x] 3.1 Minimally update `components/live/sidebar/live-fleet-node.tsx` to keep `truncate` on one line, preserve original casing, and remove wide tracking without changing sidebar width. GREEN: `npx vitest run components/live/sidebar/live-fleet-node.test.tsx` -> 1 file, 12 tests passed. The production diff is one class-string line.
- [x] 3.2 Refactor only if class intent can be clearer without changing behavior; rerun the four focused test files and record evidence. No additional refactor was needed after the minimal class removal. `npx vitest run components/live/sidebar/live-fleet-node.test.tsx components/live/sidebar/live-sidebar.test.tsx domain/live/vehicle-status.test.ts application/live/build-live-sidebar-view-model.test.ts` -> 4 files, 60 tests passed.

## Phase 3B: Runtime Evidence Closure

- [x] 3.3 Prove a valid `SENTINEL_LIVE_STALE_AFTER_MS` override flows through the live page composition into derived vehicle status. `app/live/page.test.tsx` renders the real page with `600000` and observes the resulting `2 de 2` online fleet count. Historical RED is unavailable because injection already worked; detached-worktree mutation RED hardcoded the default at the page boundary and the focused test failed 1/1 because that count disappeared. GREEN: focused four-file command passed 49/49.
- [x] 3.4 Extend the negative search-boundary proof to provider, device identifier, and unrelated fields in addition to `internalCode`. The builder test now parameterizes provider, device id, and customer id exclusions; existing tests retain positive fleet/vehicle/plate matches and the `internalCode` exclusion. Detached-worktree mutation RED added those three forbidden fields to matching and failed all 3 new cases. GREEN: builder suite contributes 29/29 to the focused pass.
- [x] 3.5 Render an arbitrary unknown bottom-panel column key and prove delivery displays the raw key. Added `components/live/live-bottom-panel.test.tsx` with `satelliteSignal`; detached-worktree mutation RED removed `?? column.key` and failed 1/1 because the accessible header became empty. GREEN: panel test passed 1/1.
- [x] 3.6 Supply a playback notice through the page view model and prove the current `LiveScreen` renders no playback-notice UI. The test first builds a page view model containing `vehicle-offline`, spies on the builder to prove `LiveScreen` receives that model, then asserts the notice copy is absent. Detached-worktree mutation RED rendered `PLAYBACK_NOTICE_COPY` from `page.playback.notice` and failed 1/1 because the notice appeared. GREEN: screen suite contributes 18/18 to the focused pass.

## Phase 4: Documentation and Closure

- [x] 4.1 Validate every corrected delta against `proposal.md`, `design.md`, implementation, and its canonical `openspec/specs/*` merge target; repair stale claims without editing archived history.
- [x] 4.2 Run `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`; record exact results in `verify-report.md`. Fresh verification passed 27 files / 215 tests, typecheck, final clean lint, build, 58/58 scenario compliance, and 98.52% line coverage; see `verify-report.md`.
- [x] 4.3 Re-archive only after all tasks pass and canonical specs match the verified implementation; confirm no active change remains and Git contains only the intended work unit.
