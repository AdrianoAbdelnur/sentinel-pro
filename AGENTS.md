## Project

Sentinel Pro is a new greenfield implementation of the Sentinel domain.
It must reuse the validated business behavior from `D:\CopiaD\backUp\Proyectos Web\Example-sentinel`, but it MUST NOT inherit that project's structural debt.

Primary architectural references live in:
- `D:\CopiaD\backUp\Proyectos Web\Example-sentinel\docs`
- `D:\CopiaD\backUp\Proyectos Web\Example-sentinel\PROJECT_TECHNICAL_DETAIL.md`

The old project is a behavioral reference and edge-case source.
It is NOT a structural template.

## Mission

Build this project from scratch with:
- Gentle AI workflow
- SDD first for meaningful changes
- TDD by default
- provider-agnostic architecture
- clean application boundaries
- maintainability over speed

## Non-Negotiable Working Model

Before writing code:
1. Read the relevant architecture docs from the reference project.
2. Identify the target contract and boundary to implement.
3. Create or update the SDD artifacts for the change.
4. Write the failing test first when the change is testable.
5. Only then implement the minimum code to pass.

Never jump straight from idea to implementation.

## Architecture Direction

This project must follow these principles.

### 1. Provider-agnostic UI

The UI must never depend on provider-specific behavior.
Do not put logic like:
- `if provider === "howen"`
- `if provider === "cv200"`
- direct provider-specific endpoint decisions inside visual components

The UI renders internal contracts only.
Provider differences belong in adapters/integrations.

### 2. Application owns the use cases

Application services/use cases must:
- operate on internal models
- compose data for the UI
- decide business behavior
- return view models or result contracts

UI components must not assemble business rules from raw provider data.

### 3. Integrations translate, never leak

Each provider integration must:
- authenticate with the provider
- call external APIs
- normalize raw payloads
- translate errors
- resolve playback/stream details

Integrations must not define UI structure or business navigation.

### 4. Operational live and playback live are different concerns

Respect the separation defined in the reference docs:
- operational live: customer/fleet/vehicle/device/telemetry/selection
- playback live: monitor/tile/render strategy/source/status

Do not collapse both concerns into one giant page-level state.

### 5. The new codebase must be boring to maintain

Prefer:
- small files
- explicit contracts
- isolated adapters
- testable use cases
- composition over giant pages

Reject:
- god components
- duplicated mapping logic
- provider-specific conditionals in UI
- hidden contracts between pages and routes

## Architectural Source of Truth

When implementing live-related features, the baseline architectural intent is the set of docs in:
- `docs/architecture/01-target-structure.md`
- `docs/architecture/02-provider-agnostic-live-principles.md`
- `docs/architecture/03-live-core-domain.md`
- `docs/architecture/04-live-playback-contract.md`
- `docs/architecture/05-live-application-responsibilities.md`

Interpretation rule:
- `01` defines the target folder and boundary structure for this repository
- `02-05` define the direction for the live module

The equivalent numbered docs under `Example-sentinel/docs` describe the OLD project. Use them as behavioral reference only, never as the structural source of truth for this repository.

If existing code conflicts with those docs, prefer the docs unless the user explicitly changes the architecture.

## Reference Project Usage Rules

Use `Example-sentinel` for:
- understanding real business flows
- extracting hidden edge cases
- validating provider behavior
- discovering existing endpoint semantics
- identifying contracts worth preserving

Do NOT use `Example-sentinel` as justification to:
- replicate page structure
- copy oversized components
- copy mixed UI/integration logic
- port accidental complexity into this repo

When borrowing behavior from the old project, first extract the underlying rule, then reimplement it cleanly.

## Target Design Bias

Default to a screaming/hexagonal style organization.
If the concrete structure evolves, preserve these boundary rules:

- `domain/*`
  - core entities, value objects, domain rules
- `application/*`
  - use cases, ports, orchestration, view-model composition
- `infrastructure/*` or `integrations/*`
  - provider adapters, gateways, persistence, external services
- `app/*` and/or `components/*`
  - delivery layer, route handlers, UI, composition root

The exact folder names may adapt to the real implementation, but the dependency rule must hold:
- UI depends on application contracts
- application depends on ports/contracts
- integrations implement those ports
- domain does not depend on framework details

## SDD Rules

Use SDD for any change that affects at least one of these:
- architecture
- feature behavior
- API contract
- provider integration
- data model
- operational workflow
- cross-file refactor with business impact

Expected SDD flow:
1. explore
2. propose
3. spec
4. design
5. tasks
6. apply
7. verify
8. archive

Do not start implementation of meaningful work without the corresponding SDD artifacts.

If the change is tiny and truly local, explicitly state why full SDD is unnecessary.

## TDD Rules

TDD is the default.

Apply the cycle:
1. RED — write a failing test
2. GREEN — write the minimum code to pass
3. REFACTOR — improve without changing behavior

Minimum expectation:
- new business rules get tests
- bug fixes reproduce the bug with a test when feasible
- mappers/parsers/adapters with non-trivial behavior get tests
- route handlers with validation or contract logic get tests

Do not hide lack of tests behind speed.
If something is hard to test, that is often a design smell.

## Next.js Rule

This project uses Next.js 16.
Before changing framework-sensitive code, read the relevant guide in:
- `node_modules/next/dist/docs/`

Do not rely on memory for Next.js behavior when framework docs can be checked locally.

## Implementation Discipline

- Prefer TypeScript everywhere.
- Keep artifacts in English unless the project explicitly adopts another language.
- Make small, reviewable changes.
- Do not refactor unrelated code opportunistically.
- Do not add libraries without a clear architectural reason.
- Do not invent contracts when the reference docs or code can verify them.
- Verify technical assumptions against code or docs before stating them.

## Contracts Before Code

Before implementing a feature, identify:
- the domain concept
- the application use case
- the input contract
- the output contract
- the provider/persistence ports involved
- the test surface

If those are not clear, stop and define them first.

## Live Module Rules

For live features, preserve these invariants:
- operational selection happens before playback
- map and selection do not depend on video playback
- one live tile equals one reproducible video
- the playback grid is global
- providers may contribute different render strategies
- the UI decides rendering by renderer/status, not by provider
- duplicate live tiles for the same already-open source must be prevented by application logic

## Route Handler Rules

Route Handlers are delivery adapters.
They may:
- parse input
- validate input
- call application use cases
- translate result to HTTP

They must not:
- contain provider business logic
- normalize complex provider payloads inline
- become the real use-case layer

## State Management Rules

Do not centralize unrelated concerns into giant page state.
Split by responsibility:
- selection state
- view state
- data fetching state
- playback session state
- filters/search state

If a page file starts becoming a system, the architecture is already failing.

## Component Size and Organization Rules

This project MUST keep components small, focused, and easy to maintain.

Prefer:
- one clear responsibility per component
- composition through small child components
- extracting hooks, presenters, and mappers before a component grows uncontrolled
- moving business logic out of UI files into `application/*` or dedicated adapters

Reject:
- giant components
- page files that accumulate rendering, fetching, mapping, and business decisions together
- components approaching hundreds of lines without a very strong reason

If a component starts growing too much, stop and split it before continuing.
Size is not just style here; it is an architectural constraint for maintainability.

### File size

Around 700 lines is the point where a file is already too big. This is a guideline, not a hard gate: 730 lines is not worth arguing about, 1200 is not acceptable. Treat the number as a signal to split, not as a budget to spend.

### Comments

Do NOT write comments in source files. None. Not rationale, not design references, not descriptions of what the code does.

If something needs explaining, it goes in `docs/`. Code that needs a comment to be understood should be rewritten with clearer names instead.

The only exception is a machine-readable directive a tool requires, such as `eslint-disable-next-line`. Those are configuration, not prose.

### Styling

Use Tailwind utility classes. Do NOT use inline styles.

The one legitimate exception is a third-party API that accepts only an HTML string or a raw style value and cannot render a React component — Leaflet's `divIcon` is the known case. Even then, keep the inline surface minimal: express what you can as classes, and pass only the genuinely dynamic value (for example a rotation angle) through a CSS custom property.

## Documentation Rules

Keep documentation aligned with reality.
When architecture, contracts, or workflows change, update the relevant docs in the same work unit.

Important: the docs are not garnish. They are part of the implementation contract.

## Validation Before Completion

Before considering work done, run the relevant checks available in the project.
At minimum, prefer this order when applicable:
- lint
- typecheck
- tests
- build

If a required check cannot run yet because the project is still being bootstrapped, say so explicitly.

## Branch and Commit Discipline

- Never add `Co-Authored-By` or AI attribution.
- Use conventional commits only.
- Do not mix unrelated topics in the same commit.
- Keep each commit aligned to one coherent work unit.

## Decision Heuristic

When in doubt, choose the option that:
1. leaks fewer provider details upward
2. reduces coupling
3. makes testing easier
4. keeps contracts explicit
5. avoids recreating the old project's maintenance pain

## First Steps For This Repository

Until replaced by more specific project docs, assume the bootstrap order is:
1. establish AGENTS guidance
2. initialize SDD context for this repo
3. define the initial target architecture and folder strategy
4. choose testing stack and strict TDD workflow
5. model the first internal contracts
6. implement the first vertical slice through SDD + TDD





## Branch Discipline

- Never commit or push directly to `main`.
- Start every new feature, bugfix, chore, or documentation topic on a dedicated branch whose name describes that topic.
- Before switching branches, check that the current branch has no uncommitted or unpushed work. If it does, stop and ask the user how to proceed.
- Only stage, commit, or push work from its corresponding topic branch.
- Integrate into `main` only through the repository's approved review and merge workflow.
