# Sentinel Pro Target Structure

## Goal

Give the new codebase a stable boundary model before the first real feature slice.

## Default layout

```text
app/              # Next.js delivery layer: routes, layouts, route handlers
application/      # use cases, ports, result contracts, view-model composition
domain/           # entities, value objects, domain rules
integrations/     # provider adapters, external gateways, transport mapping
docs/architecture # architecture decisions and implementation contracts
openspec/         # SDD artifacts and specs
```

## Dependency rule

- `app` may depend on `application`
- `application` may depend on `domain` and abstract ports
- `integrations` implements application ports
- `domain` depends on nothing framework-specific

## Live-specific rule

- operational live belongs to `application/live` + `domain/live`
- provider playback resolution belongs to `integrations/*`
- visual rendering belongs to `app/*` components and routes

## First implementation bias

When the first vertical slice begins, prefer creating:

- `domain/live/*`
- `application/live/*`
- `integrations/howen/*`
- `app/api/live/*` only as delivery adapters
