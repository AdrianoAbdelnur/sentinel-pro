# Proposal: Handle Expired Admin Sessions in Provider Import

## Intent

Prevent the provider import screen from leaving an administrator on a failed page when the Sentinel session is no longer valid.

## Scope

### In Scope
- Redirect to `/login` when the import API returns an authentication failure.
- Preserve the screen for provider failures so the administrator can retry.
- Add regression coverage.

### Out of Scope
- Changes to Howen authentication or provider credentials.
- Changes to catalog import behavior.

## Capabilities

### Modified Capabilities
- `provider-import`: expired Sentinel sessions are redirected to login instead of being rendered as provider failures.
