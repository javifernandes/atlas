# 119. Atlas Authentication And Workspace Visibility V0

Status: current

Definition level: shaped

## Summary

Add the first human identity boundary to Atlas with GitHub OAuth, project the authenticated host
session into an Ontahí `Principal`, and gate the deployed Atlas viewer behind authentication by
default. An explicit `public` mode remains as a local-development bypass.

This is deliberately a pre-workspace slice. It proves authentication and request propagation
without prematurely persisting Atlas memberships, collaborators, or source configuration. Any
validated GitHub User may enter until `AtlasWorkspace` becomes a persisted authorization boundary.

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
7. Admit every successfully authenticated GitHub user in the pre-workspace private mode.
8. Reuse the Atlas GitHub App registration while keeping repository-installation credentials,
   webhook verification, and GitHub user OAuth configuration separate.
9. Present a lightweight login landing before any Atlas projection read.

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
  -> anonymous read allowed in local development only
  -> optional GitHub sign-in

private
  -> any valid GitHub user may sign in
  -> validated session required for viewer and Runtime Protocol
  -> anonymous requests see a login landing without loading the Atlas projection
```

Deployment visibility is not the future authorization model. The next durable shape is:

```text
User -> owns/is-member-of -> AtlasWorkspace -> contains -> Projects and Sources
```

`AtlasWorkspace.visibility` and membership will later replace the deployment visibility flag.

## Execution Slices

1. [x] Add configuration parsing for GitHub OAuth, auth readiness, and viewer visibility.
2. [x] Mount Better Auth's Next.js handler and add a small auth client/UI surface.
3. [x] Gate the viewer and Runtime Protocol consistently in private mode.
4. [x] Translate the host session into an Ontahí Principal and propagate it through operation
       dispatch.
5. [x] Add focused tests for configuration, access decisions, Principal mapping, private runtime
       rejection, and current-user UI states.
6. [x] Document local GitHub OAuth registration and environment configuration.
7. [x] Run `pnpm verify`, record the checkpoint, and identify the workspace-ownership follow-up.
8. [x] Make private/authenticated access the default, remove the temporary allowlist, and render
       its anonymous login wall before projection loading while retaining an explicit public local
       bypass.

## Verification

1. The application builds with auth unconfigured and fails closed unless local development opts
   explicitly into public visibility.
2. A configured GitHub OAuth login creates a visible authenticated session and can sign out.
3. Private mode fails closed when auth is incomplete and admits any valid GitHub session.
4. An anonymous private viewer receives only the login landing, and anonymous Runtime Protocol
   requests are rejected.
5. An authenticated Runtime Protocol request executes inside the matching Ontahí Principal context.
6. The GitHub App's repository/webhook behavior remains unchanged.
7. `pnpm verify` passes.
8. An anonymous private-mode page renders the login landing without calling
   `getAtlasPageData()`; the same URL renders Atlas after a valid session.

## Decisions

1. Use `better-auth` rather than another Supabase adapter or Passport host.
2. Start stateless and introduce a database with durable Workspace ownership, not just to make OAuth
   work.
3. Keep authentication, workspace visibility, and future authorization as separate concepts.
4. Reuse the Atlas GitHub App registration for human login, with explicit local and production
   redirect URIs and a dedicated OAuth client secret.
5. Keep private authenticated reading as the default; public anonymous reading requires an
   explicit local-development opt-out.
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

### 2026-09-19 — authenticated landing wall completed locally

The Neon transfer incident showed that deployment visibility is also an operational traffic
boundary: anonymous bots could trigger a dynamic projection read even when no collaboration was
intended. This checkpoint makes the deployment closed by default, admits any validated GitHub User,
and removes the temporary provider-ID allowlist. Anonymous requests receive a small login landing
at the stable root URL, and access is decided before projection data loads. `public` remains only as
an explicit local-development bypass. Repository source visibility remains unchanged; this boundary
protects only the deployed Atlas application. Workspace membership and project-scoped authorization
remain deferred.

The completed implementation rejects the explicit `public` bypass under `NODE_ENV=production`,
marks private pages `noindex, nofollow`, and reuses `/` for both the anonymous wall and the
authenticated workspace. Focused coverage proves that anonymous requests do not call
`getAtlasPageData()`. The full verification passes with 104 tests, 9 opt-in PostgreSQL integration
tests skipped, typechecking, the production build, and 82 source traces. A local private-mode browser
smoke confirmed the landing presentation and absence of workspace content before OAuth.
