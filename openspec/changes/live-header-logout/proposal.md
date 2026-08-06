# Proposal: Live Header Logout

## Intent

Let an authenticated Live user end their session from the persistent page header.

## Scope

- Add a Spanish logout control in the Live header.
- Call the existing same-origin logout delivery endpoint.
- Redirect to `/login` only after the endpoint succeeds.
