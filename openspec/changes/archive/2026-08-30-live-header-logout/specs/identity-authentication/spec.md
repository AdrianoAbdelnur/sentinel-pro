# Specification: Live Header Logout

## Requirement: Explicit Live logout

The Live header MUST provide a Spanish logout action.

### Scenario: Successful logout
- GIVEN an authenticated Live user
- WHEN they select "Cerrar sesión"
- THEN the client POSTs to `/api/auth/logout` and navigates to `/login` after success

### Scenario: Failed logout
- GIVEN the endpoint fails
- WHEN the user selects logout
- THEN the user remains on Live and sees a Spanish error
