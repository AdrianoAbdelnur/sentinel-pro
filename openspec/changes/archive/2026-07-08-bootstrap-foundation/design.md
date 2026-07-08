# Design: bootstrap-foundation

## Decision Summary

Bootstrap the repository with hybrid SDD persistence (`openspec` in repo + Engram memory), strict TDD enabled, and a lightweight React/Vitest testing stack.

## Key Decisions

### 1. Use OpenSpec in-repo

- keeps the architectural and change artifacts visible to the whole team
- avoids depending only on chat/session state

### 2. Use Vitest + React Testing Library

- fits a TypeScript/React codebase with low setup overhead
- is sufficient for unit and component-level TDD before introducing heavier end-to-end tooling

### 3. Keep the first test as a smoke test

- proves the toolchain works
- avoids pretending we already have domain behavior to test

### 4. Replace the default starter page

- removes misleading boilerplate
- turns the home route into a visible foundation checkpoint for the project

## Files

- `openspec/config.yaml`
- `openspec/specs/architecture-bootstrap/spec.md`
- `openspec/changes/bootstrap-foundation/*`
- `vitest.config.ts`
- `vitest.setup.ts`
- `package.json`
- `tsconfig.json`
- `app/layout.tsx`
- `app/page.tsx`
- `app/page.test.tsx`
