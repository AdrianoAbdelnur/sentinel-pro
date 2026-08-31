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
| 1.6 | The focused authorization test returned `forbidden` for a valid `sentinel_session`. | Page authorization accepts the local cookie outside production; 16 focused authentication tests pass. | Production accepts only the host-prefixed cookie, and the host-prefixed cookie remains preferred. | `app/authorization.ts`, `app/authorization.test.ts`, `app/api/auth/delivery.ts` |

## Phase 2: Local HTTP Session Continuity
- [x] 2.1 **RED:** Reproduce protected-page authorization with the local HTTP session cookie and production rejection of that fallback.
- [x] 2.2 **GREEN:** Share the local cookie name and read it only outside production when the host-prefixed cookie is absent.
- [x] 2.3 **REFACTOR:** Align identity delivery documentation and run focused and project validation.

## Validation

- `npm test -- app/authorization.test.ts app/api/auth/delivery.test.ts app/api/auth/auth.test.ts proxy.test.ts`: 16 tests passed.
- `npm run lint`: passed with one pre-existing warning in `coverage/block-navigation.js`.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm test`: 887 tests passed and 6 unrelated catalog/Cybermapa tests failed outside the changed authentication surface.
- Real LAN HTTP login: returned `200` with `/live`, stored `sentinel_session`, and the authenticated `/live` request remained on `/live` with `200`.
