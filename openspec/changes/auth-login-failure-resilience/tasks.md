# Tasks: Login Failure Resilience

## Review Workload Forecast
| Field | Value |
|---|---|
| Estimated changed lines | Under 100 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |

## Phase 1: Resilient Login Delivery
- [x] 1.1 **RED:** Add route and form tests for unexpected/empty login responses.
- [x] 1.2 **GREEN:** Return a generic JSON 500 response and defensively parse client responses.
- [x] 1.3 **REFACTOR:** Configure Node scripts to use the system CA store; run focused and project validation.
- [x] 1.4 **RED/GREEN:** Add and satisfy Spanish authentication UI and error-contract tests.

## TDD Evidence

| Task | RED | GREEN | REFACTOR | Evidence |
|---|---|---|---|---|
| 1.1 | The focused test run failed because an identity composition failure escaped the Route Handler and an empty 500 body caused `response.json()` to throw in the client. | Not applicable. | Not applicable. | `app/api/auth/auth.test.ts`, `app/login/login-form.test.tsx` |
| 1.2 | Not applicable. | Focused tests passed after the Route Handler returned a generic JSON 500 and the form parsed JSON defensively. | Kept response-contract checks local to the shared form. | `app/api/auth/login/route.ts`, `app/auth-form.tsx` |
| 1.3 | Not applicable. | Node runtime scripts now enable the system certificate store before connecting to Atlas. | Focused tests and typecheck passed. | `package.json` |

| 1.4 | Spanish UI tests failed against English labels and errors. | Authentication, home, and administration controls now render Spanish copy; focused tests pass. | The application HTML language is Spanish. | pp/auth-form.tsx, pp/admin/users/admin-user-form.tsx, pp/layout.tsx |
| 1.5 | The strict session mapper test failed because it serialized ctiveOrganizationId: undefined. | Omit undefined optional session properties before MongoDB persistence; a real local login now returns 200 with /live. | The mapper defensively omits optional undefined fields. | integrations/persistence/mongodb/documents.ts, documents.test.ts |
