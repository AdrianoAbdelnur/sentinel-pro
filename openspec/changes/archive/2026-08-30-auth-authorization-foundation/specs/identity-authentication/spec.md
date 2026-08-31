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
