# Proposal: Redirect Authenticated Users Away from Login

## Intent

Prevent an already authenticated user from seeing the login form when navigating directly to `/login`.

## Scope

### In Scope
- Check the existing page authorization contract from the login page.
- Redirect authorized users to `/`.
- Preserve the login form for unauthenticated users.
- Add focused page tests and update the authentication specification.

### Out of Scope
- Changes to session creation, cookie delivery, or login API behavior.
- Changes to password-change or organization-selection flows.

## Capabilities

### New Capabilities
- `login-route-access`: The login page distinguishes authenticated and unauthenticated visitors.

### Modified Capabilities
- None.

## Approach

Make `/login` a server-side gate that calls the existing `getPageAuthorization("operator")`. Authorized sessions redirect to `/`; missing or invalid sessions render the existing client form.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `app/login/page.tsx` | Modified | Add server-side authorization gate. |
| `app/login/page.test.tsx` | New | Cover redirect and form rendering. |
| `openspec/changes/redirect-authenticated-login/specs/login-route-access/spec.md` | New | Define route behavior. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Valid session cannot authorize during login rendering | Low | Reuse the established page authorization contract and test both branches. |

## Rollback Plan

Revert the login page gate and its focused test/spec files.

## Success Criteria

- [ ] Authorized users navigating to `/login` are redirected to `/`.
- [ ] Unauthenticated users still receive the login form.
- [ ] Existing authentication and quality checks remain green.
