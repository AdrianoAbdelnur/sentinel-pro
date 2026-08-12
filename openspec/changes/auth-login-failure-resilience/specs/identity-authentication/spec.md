# Specification: Identity Authentication Failure Resilience

## Requirement: Login delivery resilience

The login route MUST return a JSON error response for unexpected infrastructure failures and MUST NOT disclose error details.

### Scenario: Infrastructure failure
- GIVEN identity application composition or login throws
- WHEN a client posts to `/api/auth/login`
- THEN the route returns HTTP 500 with a generic JSON error body

## Requirement: Authentication form response resilience

The shared authentication form MUST remain usable if an authentication endpoint returns an empty or non-JSON response.

### Scenario: Empty error response
- GIVEN the endpoint returns a non-success response with no JSON body
- WHEN the form is submitted
- THEN it displays a generic error and does not throw

## Requirement: Spanish authentication UI

The authentication UI and its user-facing delivery errors MUST be in Spanish.

### Scenario: Login labels and infrastructure failure
- GIVEN a visitor opens the login page or the endpoint fails unexpectedly
- WHEN the login form is rendered or submitted
- THEN labels, action, and generic error are displayed in Spanish

## Requirement: Local HTTP session continuity

Protected Server Components MUST recognize the local HTTP session cookie emitted after a successful development login and MUST preserve the host-prefixed cookie as the production authorization source.

### Scenario: Successful login over local network HTTP
- GIVEN the application is running outside production over local HTTP
- AND login issued a valid `sentinel_session` cookie
- WHEN the browser navigates to the protected `/live` page
- THEN page authorization delegates the opaque token to the identity application

### Scenario: Production authorization
- GIVEN the application is running in production
- AND only a local HTTP cookie is present
- WHEN a protected page requests authorization
- THEN page authorization rejects the request before calling the identity application
