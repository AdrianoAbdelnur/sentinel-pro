# Tasks: Redirect Authenticated Users Away from Login

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 35–55 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single focused change |
| Delivery strategy | exception-ok |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

## Phase 1: RED

- [x] 1.1 Add `app/login/page.test.tsx` covering redirect for authorized sessions and form rendering for forbidden sessions.

## Phase 2: GREEN

- [x] 2.1 Update `app/login/page.tsx` to call `getPageAuthorization("operator")` and redirect authorized users to `/`.

## Phase 3: Verification

- [x] 3.1 Run the focused login page test, full tests, lint, typecheck, and build.
