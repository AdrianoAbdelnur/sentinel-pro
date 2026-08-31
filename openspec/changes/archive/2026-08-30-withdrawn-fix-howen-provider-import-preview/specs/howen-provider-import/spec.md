# Howen Provider Import

## Requirements

### Requirement: Resolve a transient Howen preview source

The provider import composition MUST provide a non-empty transient company scope when resolving the Howen source for the initial preview, without persisting that preview connection.

#### Scenario: Howen preview source resolution
- GIVEN valid Howen configuration
- WHEN the import runtime requests the Howen source for preview
- THEN a catalog import source is returned
- AND the source is scoped to the transient preview identifier

#### Scenario: Existing company source resolution
- GIVEN valid Howen configuration and an existing company identifier
- WHEN the import runtime requests the Howen source for that company
- THEN a catalog import source is returned scoped to that company
