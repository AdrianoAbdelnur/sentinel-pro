# Provider-Agnostic Live Principles

## Goal

Define the non-negotiable architecture rules for Sentinel Pro live features before implementation begins.

## Core rule

The UI MUST NOT depend on provider-specific behavior.

The operator should interact with one Sentinel system, not with disguised provider consoles.

## Required separation

- **UI / delivery**
  - renders internal contracts
  - handles user interaction
  - never branches on provider identity
- **Application**
  - owns use cases
  - composes view models
  - decides operational behavior
- **Integrations**
  - authenticate with providers
  - fetch provider data
  - normalize payloads
  - resolve playback details

## Forbidden UI behavior

The UI MUST NOT:

- call provider-specific endpoints directly from visual components
- branch on `provider === "howen"` or similar checks
- infer business meaning from raw provider payloads
- assemble playback URLs or sessions
- decide which channels are playable

## Live split

Live has two different concerns and they MUST stay separate:

1. **Operational live**
   - customer
   - fleet
   - vehicle
   - device
   - telemetry
   - selection
2. **Playback live**
   - monitor
   - tile
   - renderer
   - source
   - playback status

## Design consequence

If adding a new provider requires editing multiple UI screens, the architecture is leaking.

The expected change surface for a new provider is mostly:

- `integrations/<provider>/`
- mapping/adapter code
- playback strategy resolution

## Sentinel Pro decision

Sentinel Pro will preserve provider differences at the integration layer, but expose unified contracts upward.
