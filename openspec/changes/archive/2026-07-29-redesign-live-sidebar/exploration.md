## Exploration: Corrective reconciliation for redesign-live-sidebar

### Current State
The implementation already resolves the offline threshold from `SENTINEL_LIVE_STALE_AFTER_MS`, falls back to five minutes at the composition boundary, and passes the required value into the pure domain status function. The sidebar is `w-72`, its list owns vertical scrolling, provider `online: true` already takes precedence over stale GPS, and search is limited to fleet label, vehicle label, and plate. Bottom-panel column keys remain open strings with raw-key fallback, while playback notice codes exist in application contracts but are not rendered because no playback monitor exists.

The failed post-archive audit found documentation overclaims and three runtime-evidence gaps rather than broad product defects. The only authorized UI behavior change is compacting fleet labels on one line by removing forced uppercase and wide tracking while retaining truncation.

### Affected Areas
- `openspec/changes/redesign-live-sidebar/specs/live-vehicle-status/spec.md` — correct the threshold requirement so runtime configuration owns the five-minute default and the domain input remains required.
- `openspec/changes/redesign-live-sidebar/specs/live-page-shell/spec.md` — document best-effort column copy with raw-key fallback and defer visible playback notices until the playback monitor exists.
- `openspec/changes/redesign-live-sidebar/design.md` — replace stale status-set, `w-80`, three-status-count, exhaustive-column-copy, and current playback-delivery claims.
- `openspec/changes/redesign-live-sidebar/tasks.md` — correct the false completed `w-80` claim and add focused corrective documentation, UI, and runtime-proof tasks.
- `components/live/sidebar/live-fleet-node.tsx` — keep one-line truncation but remove forced uppercase and wide letter spacing.
- `components/live/sidebar/live-fleet-node.test.tsx` — prove the compact single-line label contract.
- `components/live/sidebar/live-sidebar.test.tsx` — prove only the list region owns vertical scrolling while filters remain outside it.
- `domain/live/vehicle-status.test.ts` — prove explicit provider `online: true` wins over a stale timestamp.
- `application/live/build-live-sidebar-view-model.test.ts` — prove search matches fleet label, vehicle label, and plate but not `internalCode`, provider, device identifiers, or unrelated fields.

### Approaches
1. **Reconcile documentation to the accepted implementation and add focused regression proof** — preserve the current boundaries, change only fleet-label typography, correct overclaims, and add tests for retained scenarios.
   - Pros: matches explicit user decisions, preserves provider-agnostic architecture, minimizes product risk, and closes every finding from verification #801.
   - Cons: playback notices and exhaustive localization remain intentionally deferred; raw technical column keys may still appear.
   - Effort: Low

2. **Change implementation to satisfy the overclaimed documentation** — add a domain default, widen the sidebar, close the column-key union, and render playback notices now.
   - Pros: would make the existing prose true without weakening guarantees.
   - Cons: contradicts decisions #806-#809, introduces disconnected playback UI, reduces column extensibility, and changes a sidebar width the user wants to keep.
   - Effort: Medium

### Recommendation
Use approach 1. Treat staleness, column-copy, playback, filter shape, counts, and width as documentation corrections; treat scrolling, provider precedence, and search boundaries as missing test evidence; and use strict RED-GREEN-REFACTOR only for the focused tests and fleet-label styling change. Do not alter runtime business behavior beyond the authorized typography adjustment.

### Risks
- A styling assertion can become brittle if it checks an entire Tailwind class string; assert only the required compact/truncation classes and forbidden uppercase/tracking classes.
- Raw-key fallback can expose technical English until localization is prioritized; the specification must state that limitation explicitly.
- Playback codes may be mistaken for delivered UI behavior again unless the specs clearly separate application readiness from current screen rendering.

### Ready for Proposal
Yes — update the existing proposal/spec/design/tasks for this corrective reconciliation, then apply the focused TDD changes and re-run strict verification before archiving.
