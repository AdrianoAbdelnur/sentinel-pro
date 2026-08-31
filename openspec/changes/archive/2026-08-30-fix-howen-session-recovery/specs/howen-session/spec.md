# Howen session recovery

## Requirements

### Requirement: reuse a valid persisted session

The Howen session manager MUST load a persisted token, pid, cookie, and expiry before authenticating, and MUST use it when the expiry is still valid.

#### Scenario: Sentinel restarts during a valid session

- Given a valid persisted Howen session exists
- When the import source requests a session
- Then Sentinel MUST reuse the persisted session
- And Sentinel MUST NOT call the Howen login endpoint

### Requirement: discard expired persisted sessions

The session manager MUST ignore invalid or expired persisted data and authenticate normally.

#### Scenario: persisted session is expired

- Given persisted session data is expired
- When the import source requests a session
- Then Sentinel MUST authenticate normally

### Requirement: clear expired sessions

When a session is invalidated after an expired-provider response, the persisted session MUST be removed.
