# Architecture Bootstrap Spec

## Requirement: Greenfield implementation starts with explicit guardrails

The repository MUST define the architectural and workflow constraints required to build Sentinel Pro from scratch without inheriting the legacy project's structural debt.

### Scenario: Agent guidance exists for implementation work

- **Given** a contributor starts work in `sentinel-pro`
- **When** they read the repository instructions
- **Then** they can find explicit rules for provider-agnostic UI, application boundaries, SDD-first workflow, and TDD-by-default execution

## Requirement: SDD persistence is initialized in-repo

The repository MUST include OpenSpec bootstrap files so meaningful changes can start with proposal/spec/design/tasks artifacts instead of ad hoc implementation.

### Scenario: OpenSpec foundation is present

- **Given** a contributor wants to start an SDD change
- **When** they inspect the repository
- **Then** they find `openspec/config.yaml`, `openspec/specs/`, and `openspec/changes/archive/`

## Requirement: TDD tooling is available before the first feature slice

The repository MUST provide a working unit/component test foundation suitable for incremental vertical slices.

### Scenario: Test stack can validate a simple UI behavior

- **Given** the repository bootstrap is complete
- **When** the test suite runs
- **Then** at least one passing Vitest + Testing Library test proves the setup is operational
