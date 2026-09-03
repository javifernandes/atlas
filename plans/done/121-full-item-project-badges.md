# 121. Full Item Project Badges

Status: done

## Summary

Show project membership in the full-item header when Atlas contains more than one declared project.

## Scope

1. Derive membership from the same containment and shaping hierarchy used by Board project scope.
2. Show every matching project when an item participates in more than one.
3. Avoid repeating project identity on project items or in a single-project Atlas.
4. Keep the badge compact beside item kind and status.

## Execution Slices

- [x] Project memberships are derived once from the snapshot hierarchy.
- [x] Full-item headers render accessible project badges.
- [x] Tests cover multi-project Atlas and multi-project membership.
- [x] Map Navigation UX records the durable header behavior.

## Verification

- [x] `pnpm verify`
- [x] `git diff --check`
- [x] Inspect the full-item header in the running application in light and dark themes.

## Closure / Evolution

Full-detail headers now show one compact badge per matching project whenever the federated Atlas
contains multiple declared projects. Membership uses the same containment, candidate, and shaping
hierarchy as Board project scope, including legitimate cross-repository plans. Project items do not
repeat their own identity, and single-project workspaces keep the simpler header.
