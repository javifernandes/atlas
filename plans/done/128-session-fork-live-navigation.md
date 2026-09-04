# 128. Session Fork Live Navigation

Status: done

Definition level: shaped

Parent plan: [Inline Session Fork Selection](../done/127-inline-session-fork-selection.md)

## Summary

Make a successfully forked Session appear and become selected immediately, without requiring a
manual Atlas refresh.

## Context

The fork Operation persists the new Session and returns its stable ID, but the client currently
writes that ID with the native History API and then asks the Next.js router to refresh. The address
bar changes while the App Router can retain the prior server payload, leaving the new Session absent
until a full browser refresh.

## Scope

- route successful forks through the Next.js App Router using the returned Session ID;
- preserve the existing fork Operation and Session URL shape;
- keep local Session switching lightweight;
- add a regression test for navigation and adoption of the refreshed Session projection;
- verify the live UI flow in a browser.

## Non-Goals

- optimistic reconstruction of a full Session projection in the client;
- changing Session persistence or the fork Operation result;
- changing navigation behavior for ordinary Session selection.

## Proposed Form

```text
fork Operation succeeds
  -> reset local fork UI
  -> App Router replaces the route with ?view=sessions&session=<new-id>
  -> server payload includes the durable Session
  -> existing selected ID adopts that projection
```

## Execution Slices

1. [x] Register the navigation repair and durable behavior.
2. [x] Route successful forks through an App Router navigation.
3. [x] Add regression coverage and verify the rendered handoff.
4. [x] Record closure evidence and move the Plan to `done/`.

## Verification

- [x] a successful fork replaces the App Router route with the returned Session ID;
- [x] the refreshed projection renders the new Session as selected;
- [x] the fork Operation request contract remains unchanged;
- [x] focused tests, `pnpm verify`, and `git diff --check` pass;
- [x] browser verification confirms no manual refresh is required and the console is clean.

## Decisions

1. Use a real App Router navigation instead of reconstructing server-owned Session state locally.
2. Keep native History API updates for ordinary in-memory Session selection.

## Open Questions

None for this repair.

## Closure / Evolution

Completed on 2026-09-04 from dogfood feedback in Atlas Session
`0d8c5646-6d1b-4fac-af0a-c953fc3121c2` after Plan 127 landed.

Successful forks now use `router.replace` with the returned Session ID instead of combining a
native History write with `router.refresh`. That navigation reloads the server-owned projection and
lets the existing selected ID adopt the durable Session without client-side reconstruction.

Evidence:

- all 12 focused `execution-stream-view` tests pass, including the exact fork request, App Router
  destination, and adoption of the refreshed Session projection;
- `pnpm verify` and `git diff --check` pass;
- local browser verification showed the new Session appear in the rail and become the active panel
  immediately after Create Session, without a refresh and with a clean console.
