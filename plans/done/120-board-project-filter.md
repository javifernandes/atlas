# 120. Board Project Filter

Status: done

## Summary

Add a project filter to the global Board so a user can focus the Now, Next, and Later columns on
one project such as Ontahi without leaving the shared Atlas planning surface.

## Context

The Board previously mixed work from every federated project. That is useful for a portfolio view,
but it created noise when choosing what to continue inside one project.

## Scope

1. Derive the available filters from project Atlas Items already present in the snapshot.
2. Keep the default all-project portfolio view.
3. When a project is selected, retain its contained items, shaping plans, and their hierarchical
   descendants while excluding lateral context from other projects.
4. Keep history visibility independent from project scope.

## Non-Goals

1. Do not change Map filtering.
2. Do not add a new project declaration or duplicate federated project data.
3. Do not persist the selected filter in the URL in this slice.

## Execution Slices

- [x] Add project-scope derivation and an accessible Board control.
- [x] Cover project filtering and reset behavior with a viewer test.
- [x] Update the durable Planning Projection description.

## Verification

- [x] `pnpm verify`
- [x] `git diff --check`
- [x] Confirm the all-project and Ontahi-scoped states in the running application.

## Closure / Evolution

The Board now derives its project choices from declared project Atlas Items. Selecting a project
walks containment, candidate, and shaping hierarchy, so project-relevant plans remain visible even
when their source repository differs. Lateral `supports`, `related`, and `follow-up` relations do
not expand the scope. Global search restores the all-project view when it navigates to an item
outside the active project filter.

Map filtering and URL persistence remain possible follow-up slices rather than implicit additions
to this Board-focused change.
