# Tasks: Handle Expired Admin Sessions in Provider Import

## Phase 1: RED

- [x] 1.1 Add a test proving HTTP 403 redirects the import screen to `/login`.
- [x] 1.2 Add a test proving an authenticated provider failure remains on the import screen.

## Phase 2: GREEN

- [x] 2.1 Add router navigation and inspect the import response status before reading NDJSON.
- [x] 2.2 Preserve existing streamed success and provider-failure behavior.

## Phase 3: Verify

- [x] 3.1 Run focused tests, lint, and typecheck.
- [x] 3.2 Review the diff against the specification.
