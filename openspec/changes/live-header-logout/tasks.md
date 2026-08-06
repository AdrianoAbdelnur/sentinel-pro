# Tasks: Live Header Logout

## Review Workload Forecast
| Field | Value |
|---|---|
| Estimated changed lines | Under 100 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Delivery strategy | single-pr |

- [x] 1.1 **RED:** Add Live logout interaction tests.
- [x] 1.2 **GREEN:** Add a Spanish header logout control using the existing delivery endpoint.
- [x] 1.3 **REFACTOR:** Validate the focused behavior and preserve header composition.

## TDD Evidence

- RED: the logout interaction test initially failed because the header control did not exist.
- GREEN: the component posts to the existing logout endpoint and uses outer.replace('/login') after its 204 response.
- REFACTOR: the Live page composes the dedicated client control; focused tests pass 7/7 and typecheck passes.
