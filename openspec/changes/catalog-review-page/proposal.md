# Proposal: Catalog review resolution page

## Intent
Give administrators a dedicated, understandable page for resolving catalog records that could not be linked automatically during provider imports.

## Scope
- Add `/admin/revisiones` as the entry point for pending catalog reviews.
- Load pending reviews when the page is opened.
- Explain why a record is pending and expose only valid resolution actions.
- Reuse the existing review API and application rules.
- Keep provider and persistence details behind the existing delivery/application boundaries.

## Out of scope
- Changing matching rules.
- Automatically resolving ambiguous records.
- Deleting imported records.

## Success criteria
An administrator can open the page, understand each pending case, resolve it to an existing entity or a new vehicle where allowed, and see the item removed from the pending list.
