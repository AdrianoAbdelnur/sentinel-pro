# User Management

## Requirements

### Requirement: Admin policy

Email MUST identify one global user. Admins MUST manage active-tenant memberships. New identities MUST get editable readable temporary passwords and forced first-login change; existing identities MUST keep credentials. Deactivation MUST preserve identity/other memberships and end tenant sessions. Last active admin MUST NOT be deactivated/demoted. Admins MAY reset global passwords only for users exclusive to their organization; multi-organization reset MUST fail. Reset MUST create a readable temporary password, force change, clear login blocking, and revoke all sessions.

#### Scenario: Generated
- GIVEN new email without password
- WHEN an admin adds it
- THEN generated readable credentials force first-login change

#### Scenario: Custom password
- GIVEN new email with password
- WHEN an admin adds it
- THEN those credentials force first-login change

#### Scenario: Existing identity
- GIVEN an existing email identity
- WHEN its membership is added/reactivated
- THEN credentials and password state stay unchanged

#### Scenario: Deactivation
- GIVEN multiple active memberships
- WHEN active-tenant membership is deactivated
- THEN its access/sessions end; others remain usable

#### Scenario: Last admin
- GIVEN one active admin remains
- WHEN deactivation/demotion is attempted
- THEN the operation is rejected

#### Scenario: Remaining admin
- GIVEN multiple active admins
- WHEN one is deactivated/demoted
- THEN it MAY succeed if another remains

#### Scenario: Exclusive reset
- GIVEN user exclusive to the admin's organization
- WHEN the admin resets password
- THEN readable temporary credentials force change, clear blocking, and revoke all sessions

#### Scenario: Multi-organization reset
- GIVEN multiple memberships
- WHEN an admin requests reset
- THEN reset fails without credential changes
