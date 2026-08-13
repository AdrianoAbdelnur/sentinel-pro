# Recover Howen sessions across Sentinel restarts

## Intent

Prevent imports from creating unnecessary Howen logins when a valid session already exists, and preserve the working behavior of the operational integration.

## Scope

- Persist the Howen token, pid, cookie, and bounded expiry locally.
- Hydrate a still-valid session before calling `apiLogin.action`.
- Remove persisted credentials when the provider reports an expired session.

## Out of scope

- Changing Howen endpoints or roster mapping.
- Exposing provider credentials or raw provider responses to the browser.
