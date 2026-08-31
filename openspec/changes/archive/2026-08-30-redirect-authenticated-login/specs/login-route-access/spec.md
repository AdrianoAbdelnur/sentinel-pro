# Login Route Access

## Requirements

### Requirement: Redirect authenticated users from login

The login page MUST redirect a session authorized for the operator application to `/` instead of rendering the login form.

#### Scenario: Authenticated visitor opens login
- GIVEN the existing page authorization contract returns an authorized context
- WHEN the visitor requests `/login`
- THEN the page redirects to `/`
- AND the login form is not rendered

### Requirement: Preserve login for unauthenticated visitors

The login page MUST render the existing login form when page authorization does not return an authorized context.

#### Scenario: Unauthenticated visitor opens login
- GIVEN the existing page authorization contract returns a forbidden result
- WHEN the visitor requests `/login`
- THEN the login form is rendered
