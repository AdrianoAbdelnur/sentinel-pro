# Design: Live Header Logout

A small client delivery component owns the interaction in the Live header. It calls the existing route handler, which revokes the opaque session and expires its cookie. The component uses `router.replace` after a successful response so browser history does not restore the protected page.
