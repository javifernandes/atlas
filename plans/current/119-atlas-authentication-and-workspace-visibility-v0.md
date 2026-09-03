# 119. Atlas Authentication And Workspace Visibility V0

Status: current

Definition level: shaped

## Summary

Add the first human identity boundary to Atlas with GitHub OAuth, project the authenticated host
session into an Ontahí `Principal`, and let one deployed Atlas viewer be configured as `public` or
`private`.

This is deliberately a pre-workspace slice. It proves authentication and request propagation
without prematurely persisting Atlas users, memberships, collaborators, or source configuration.
A private deployment uses an explicit stable GitHub user-ID allowlist as a temporary bootstrap boundary;
durable ownership replaces that allowlist when `AtlasWorkspace` becomes a persisted product object.

## Context

Atlas can currently read private repositories through its GitHub App and accepts signed GitHub
webhooks, but neither mechanism identifies the human using the viewer. The Runtime Protocol route
also dispatches operations without an invocation Principal.

That was sufficient while Atlas was a read-only, deployment-scoped viewer. Client Applications,
event subscriptions, private workspaces, reviewed apply operations, and later collaboration all
need the application to distinguish:

1. the authenticated human or service Principal,
2. the workspace/resource being accessed,
3. the authorization decision for that Principal and resource.

Ontahí already defines the provider-neutral `Principal` and invocation-context boundary in
[`Ontahí Authentication Principal And Invocation Context`](ontahi://plans/130-ontahi-authentication-principal-and-invocation-context).
Atlas should exercise that boundary with a host authentication library other than the Supabase and
Passport integrations already proven by BookOps and the Ontahí Todo application.

## Research / Evidence

1. [Better Auth GitHub authentication](https://better-auth.com/docs/authentication/github) provides
   a built-in GitHub OAuth provider and a standard Next.js route handler.
2. [Better Auth stateless sessions](https://better-auth.com/docs/concepts/session-management#stateless-session-management)
   can establish signed and encrypted cookie sessions without a database. This fits the
   pre-workspace slice, although durable users and revocable sessions should move to database-backed
   storage when ownership lands.
3. [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) exposes the
   validated server session from request headers, which can be mapped at the host boundary into an
   Ontahí invocation context.
4. [Auth.js](https://authjs.dev/) also offers a compact GitHub/Next.js integration. Better Auth is
   preferred for this slice because it provides the stateless bridge now and credible organization
   and API-key extension paths later, while still keeping Atlas authorization in the Atlas domain.
5. Atlas already uses a GitHub App for repository installation access and webhook verification.
   Human login reuses that registration's OAuth client while preserving separate credentials and
   trust flows for the user session, installation access, and webhook verification.

## Scope

1. Add Better Auth with GitHub as the only sign-in provider.
2. Run Better Auth without a database for the first slice.
3. Add sign-in, sign-out, loading, and authenticated-user presentation surfaces.
4. Map a validated Better Auth session to an Ontahí `Principal` at the Runtime Protocol boundary.
5. Configure the deployment viewer as `public` or `private`.
6. Require authentication for the page and Runtime Protocol when visibility is private.
7. Require an explicit stable GitHub user-ID allowlist for the temporary private mode.
8. Reuse the Atlas GitHub App registration while keeping repository-installation credentials,
   webhook verification, and GitHub user OAuth configuration separate.

## Non-Goals

1. Do not persist Atlas users, workspaces, memberships, or invitations yet.
2. Do not add collaborators, organizations, teams, or granular roles.
3. Do not treat Better Auth plugins or roles as Atlas authorization policy.
4. Do not use the human OAuth token to read federated repositories; repository access remains owned
   by the Atlas GitHub App.
5. Do not protect individual Projects or Atlas Items independently in this slice.
6. Do not add write/apply authority to existing proposal operations.

## Proposed Form

```text
GitHub OAuth
  -> Better Auth validated stateless session
      -> Atlas host session projection
          -> Ontahí Principal { kind: "user", issuer: "atlas:better-auth", subject }
              -> Runtime Protocol invocation context
```

Viewer access is deployment-scoped for this slice:

```text
public
  -> anonymous read allowed
  -> optional GitHub sign-in

private
  -> configured GitHub user ID may sign in
  -> validated session required for viewer and Runtime Protocol
```

The temporary allowlist is not the future authorization model. The next durable shape is:

```text
User -> owns/is-member-of -> AtlasWorkspace -> contains -> Projects and Sources
```

`AtlasWorkspace.visibility` will later replace the deployment visibility flag, and membership will
replace the GitHub allowlist.

## Execution Slices

1. [x] Add configuration parsing for GitHub OAuth, auth readiness, viewer visibility, and private
       user-ID allowlisting.
2. [x] Mount Better Auth's Next.js handler and add a small auth client/UI surface.
3. [x] Gate the viewer and Runtime Protocol consistently in private mode.
4. [x] Translate the host session into an Ontahí Principal and propagate it through operation
       dispatch.
5. [x] Add focused tests for configuration, access decisions, Principal mapping, private runtime
       rejection, and current-user UI states.
6. [x] Document local GitHub OAuth registration and environment configuration.
7. [x] Run `pnpm verify`, record the checkpoint, and identify the workspace-ownership follow-up.

## Verification

1. The application builds with auth unconfigured and defaults to a public anonymous viewer.
2. A configured GitHub OAuth login creates a visible authenticated session and can sign out.
3. Private mode fails closed when auth or its GitHub user-ID allowlist is incomplete.
4. Anonymous private viewer and Runtime Protocol requests are rejected.
5. An authenticated Runtime Protocol request executes inside the matching Ontahí Principal context.
6. The GitHub App's repository/webhook behavior remains unchanged.
7. `pnpm verify` passes.

## Decisions

1. Use `better-auth` rather than another Supabase adapter or Passport host.
2. Start stateless and introduce a database with durable Workspace ownership, not just to make OAuth
   work.
3. Keep authentication, workspace visibility, and future authorization as separate concepts.
4. Reuse the Atlas GitHub App registration for human login, with explicit local and production
   redirect URIs and a dedicated OAuth client secret.
5. Keep public anonymous reading as the default until a deployment explicitly opts into private
   mode.
6. Do not retain the human GitHub OAuth token in a stateless account cookie; the repository GitHub
   App remains the only source-access credential.

## Open Questions

1. Should the first persisted `AtlasWorkspace` be created automatically for the first authenticated
   user or through an explicit onboarding operation?
2. Should the durable store use Better Auth's built-in PostgreSQL adapter or share an Atlas-owned
   Drizzle/Kysely data layer with workspace records?
3. Does public/private initially apply only to a Workspace, or should Project visibility become a
   separate later policy?

## Closure / Evolution

### 2026-09-03 — implementation checkpoint

The host boundary now uses Better Auth `1.7.2` with GitHub OAuth and database-less encrypted
sessions. Atlas remains public and anonymous when auth is absent. A private deployment requires
complete OAuth configuration plus stable GitHub numeric user IDs and rejects anonymous viewer and
Runtime Protocol requests. The host maps a validated session to an `atlas:better-auth` user
Principal before Ontahí operation dispatch. Human OAuth tokens are not retained in the stateless
account cookie because repository reads continue through the Atlas GitHub App.

The full suite passes with 56 tests, typechecking, the production build, and Atlas source-trace
verification. Browser smoke coverage confirmed the unconfigured public view, configured public
sign-in affordance, private redirect, and anonymous private Runtime Protocol `401`.

The plan remains current until a real GitHub OAuth registration completes the callback/session and
sign-out smoke. The next product slice after that proof is durable User-to-Workspace ownership with
workspace-level public/private visibility. Sharing and collaborator membership stay deferred until
that single-owner model is exercised.

The existing GitHub App registration will also serve human OAuth. GitHub App installation tokens,
webhook signatures, and Better Auth user sessions remain distinct credential and Principal paths;
sharing the registration does not grant the human session repository authority.

### 2026-09-03 — real OAuth smoke and PR boundary

The existing Atlas GitHub App now has exact local and production user redirect URIs. The first real
callback reached Better Auth but exposed an integration prerequisite: the GitHub profile keeps its
primary email private, so the App's user access token also needs Account permission `Email
addresses: read-only`. After adding that permission and reauthorizing the App, real GitHub sign-in
returned to Atlas with the expected user session.

A controlled local browser smoke then confirmed sign-in, callback, authenticated user presentation,
the compact top-right identity control, and sign-out back to the public anonymous viewer. After
rebasing the slice onto the current persistence-enabled `main`, automated coverage is 61 passing
tests with 5 opt-in PostgreSQL integration tests skipped, plus typechecking, production build,
source-trace verification, and a clean diff check.

This is the intended PR boundary for the pre-workspace authentication slice. The plan remains
`current` through merge and production environment smoke. Durable `AtlasWorkspace` ownership,
workspace-level visibility, memberships, and collaborators remain a separate follow-up rather than
expanding this PR.

### 2026-09-03 — persistent identity follow-up started

[`Persistent Users And Linked Accounts V0`](123-persistent-users-and-linked-accounts-v0.md) now owns
the next boundary: database-backed Better Auth records, provider account linking, and the stable
Atlas User subject. That follow-up changes the durable Principal issuer from the host-specific
`atlas:better-auth` label to `atlas`; this plan retains the pre-persistence implementation history
and remains scoped to the base GitHub login PR.
