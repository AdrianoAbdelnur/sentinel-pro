# Design: Login Failure Resilience

Keep infrastructure behavior at the delivery boundary. The login Route Handler catches unexpected composition or use-case failures and returns a generic JSON HTTP 500 response. It does not translate business result unions differently or expose the thrown error.

The shared client form parses JSON defensively through a small local response helper. It accepts only an object with a string `error` or `next` field; otherwise it falls back to a generic user-facing error. This keeps endpoint protocol resilience in the delivery layer and avoids route-specific UI logic.

Node starts Next.js and the seed script with `--use-system-ca`, which is cross-platform when expressed as a Node invocation in package scripts and applies before Next.js loads `.env.local`.

Authentication copy remains in the delivery layer. The shared form owns Spanish labels and its generic failure message, while Route Handlers return Spanish public errors without changing internal result unions.
