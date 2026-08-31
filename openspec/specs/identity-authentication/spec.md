# Authentication

## Requirements

### Requirement: Authentication policy

The system MUST enforce: hashed secrets; indistinguishable login failures; Secure, HttpOnly opaque sessions; composition-free permanent passwords of 8+ characters; temporary-password change; 15-minute blocking after 3 failures, reset on success; 12-hour inactivity expiry without absolute lifetime; revocation/status overrides; and idempotent server-only bootstrap without credential logs.

#### Scenario: Login
- GIVEN valid credentials
- WHEN submitted
- THEN session starts; failures reset

#### Scenario: Privacy
- GIVEN any email
- WHEN login is invalid
- THEN same failure; no session

#### Scenario: Block
- GIVEN two failures
- WHEN the third fails
- THEN login blocks for 15 minutes

#### Scenario: Temporary
- GIVEN a temporary password
- WHEN accepted
- THEN change-only access; reset revokes sessions

#### Scenario: Password
- GIVEN a password candidate
- WHEN validated
- THEN under-8 fails; 8+ needs no composition

#### Scenario: Activity
- GIVEN activity
- WHEN gaps stay under 12 hours
- THEN the session continues

- GIVEN 12-hour inactivity
- WHEN used
- THEN access is denied

#### Scenario: Override
- GIVEN revoked session or inactive user
- WHEN used
- THEN access is denied despite activity

#### Scenario: Bootstrap
- GIVEN a seeded system
- WHEN reseeded
- THEN no duplicates are created

### Requirement: Login delivery resilience

The login route MUST return a JSON error response for unexpected infrastructure failures and MUST NOT disclose error details.

#### Scenario: Infrastructure failure
- GIVEN identity application composition or login throws
- WHEN a client posts to `/api/auth/login`
- THEN the route returns HTTP 500 with a generic JSON error body

### Requirement: Authentication form response resilience

The shared authentication form MUST remain usable if an authentication endpoint returns an empty or non-JSON response.

#### Scenario: Empty error response
- GIVEN the endpoint returns a non-success response with no JSON body
- WHEN the form is submitted
- THEN it displays a generic error and does not throw

### Requirement: Spanish authentication UI

The authentication UI and its user-facing delivery errors MUST be in Spanish.

#### Scenario: Login labels and infrastructure failure
- GIVEN a visitor opens the login page or the endpoint fails unexpectedly
- WHEN the login form is rendered or submitted
- THEN labels, action, and generic error are displayed in Spanish

### Requirement: Local HTTP session continuity

Protected Server Components MUST recognize the local HTTP session cookie emitted after a successful development login and MUST preserve the host-prefixed cookie as the production authorization source.

#### Scenario: Successful login over local network HTTP
- GIVEN the application is running outside production over local HTTP
- AND login issued a valid `sentinel_session` cookie
- WHEN the browser navigates to the protected `/live` page
- THEN page authorization delegates the opaque token to the identity application

#### Scenario: Production authorization
- GIVEN the application is running in production
- AND only a local HTTP cookie is present
- WHEN a protected page requests authorization
- THEN page authorization rejects the request before calling the identity application

### Requirement: Explicit Live logout

The Live header MUST provide a Spanish logout action.

#### Scenario: Successful logout
- GIVEN an authenticated Live user
- WHEN they select "Cerrar sesión"
- THEN the client POSTs to `/api/auth/logout` and navigates to `/login` after success

#### Scenario: Failed logout
- GIVEN the endpoint fails
- WHEN the user selects logout
- THEN the user remains on Live and sees a Spanish error
