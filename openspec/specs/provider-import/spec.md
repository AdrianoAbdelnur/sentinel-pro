# Provider Import Session Handling Specification

## Requirements

### Requirement: Expired Sentinel sessions redirect to login

When the provider import endpoint rejects the current Sentinel administrator session with an authentication status, the import screen MUST stop processing the stream and redirect the browser to `/login`.

#### Scenario: Session expires before import

- GIVEN an administrator is viewing the import screen
- WHEN the import endpoint returns HTTP 403
- THEN the screen redirects to `/login`
- AND it does not show a provider import failure as the final state

### Requirement: Provider failures remain retryable

When the endpoint returns an authenticated provider failure, the screen MUST remain available and show a retryable failure state without redirecting to login.

#### Scenario: Howen authentication fails

- GIVEN the Sentinel administrator session is valid
- WHEN Howen authentication fails and the endpoint returns a failure result
- THEN the screen remains on the import page
- AND it shows the provider failure state
