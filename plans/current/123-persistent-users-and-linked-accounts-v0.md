# 123. Persistent Users And Linked Accounts V0

Status: current

Definition level: shaped

## Summary

Give Atlas a durable, provider-neutral human identity. A successful first sign-in creates one
Atlas User and one provider Account; later sign-ins resolve the Account by the provider's stable
issuer and subject and return the same User. Sessions and verification records become revocable
PostgreSQL records instead of existing only inside encrypted cookies.

Email remains a contact and profile attribute, not the User's identifier and not sufficient proof
that two provider accounts belong to the same person. A signed-in User may explicitly link another
provider after proving control of it. Workspace ownership will reference the stable Atlas User ID
in a following plan.

## Context

[`Atlas Authentication And Workspace Visibility V0`](119-atlas-authentication-and-workspace-visibility-v0.md)
proved GitHub login, session projection into an Ontahí Principal, and a temporary deployment-level
private allowlist. Its database-less session ID is adequate for that proof but cannot support
durable ownership, multiple identity providers, account linking, or per-session revocation.

Atlas already owns a PostgreSQL migration runner and production composition through
[`Atlas Ontahí PostgreSQL Persistence`](116-atlas-ontahi-postgres-persistence.md). This slice should
reuse that operational boundary rather than introduce a second data service or duplicate Better
Auth's core user model in an Atlas-specific table.

The pressure is not merely to persist the GitHub profile. Atlas needs to separate:

1. the human, represented by an Atlas-owned stable User ID;
2. the external login credential, represented by a provider Account;
3. a revocable authenticated browser, represented by a Session;
4. mutable email and profile attributes, which do not establish identity by themselves.

## Research / Evidence

1. [Better Auth Users and Accounts](https://better-auth.com/docs/concepts/users-accounts)
   models one User with multiple provider Accounts. Atlas's installed Better Auth 1.7.2 resolves
   provider identity by issuer and provider account ID and declares that pair as a unique schema
   index.
2. Better Auth supports disabling implicit same-email linking while retaining explicit
   `linkSocial` flows for an already authenticated user. It can allow an explicitly linked account
   to use a different email and can prevent unlinking the final login method.
3. [Better Auth's PostgreSQL adapter](https://better-auth.com/docs/adapters/postgresql) accepts a
   `pg` Pool directly. Atlas can therefore share its existing pooled application connection and
   keep migrations in the repository-owned SQL sequence.
4. [OpenID Connect Core](https://openid.net/specs/openid-connect-core-1_0.html) explicitly warns
   that email is not guaranteed to be unique and must not be used as the primary user identifier.
5. Atlas source reads already use GitHub App installation tokens. Human provider access and refresh
   tokens add no source authority and should not be retained.

## Scope

1. Add durable Better Auth User, Account, Session, and Verification tables through the existing
   Atlas migration runner.
2. Configure Better Auth to use Atlas PostgreSQL whenever `DATABASE_URL` is present, while retaining
   the stateless mode as a transitional local/preview fallback.
3. Use a generated internal User ID as the stable identity and project it as an `atlas` user
   Principal.
4. Make provider identity resolution issuer-plus-provider-account-ID based and enforce the pair
   through a unique database index.
5. Disable implicit same-email account linking and permit explicit linking after an authenticated
   user proves control of another provider, including providers that return another email.
6. Prevent unlinking the last Account and prevent a newly linked provider from overwriting the
   existing User profile automatically.
7. Discard human OAuth access, refresh, and ID tokens before durable Account writes.
8. Add migration, configuration, policy, and integration coverage plus deployment documentation.
9. Apply and verify production migrations automatically after changes enter `main`, and gate Vercel
   production builds on the same idempotent migration contract.

## Non-Goals

1. Do not configure a second OAuth provider or add account-management UI in this slice.
2. Do not persist AtlasWorkspace, ownership, membership, invitation, or collaborator records yet.
3. Do not infer or merge Users solely because provider emails match.
4. Do not implement account recovery, destructive account merge, or user deletion workflows yet.
5. Do not use human provider tokens for GitHub repository access.
6. Do not remove the temporary deployment visibility/allowlist boundary until workspace
   authorization replaces it.

## Proposed Form

```text
Atlas User { internal UUID, primary profile/email }
  |-- Auth Account { providerId, issuer, provider accountId }
  |-- Auth Account { another provider identity }
  `-- Session { revocable token, expiry, client metadata }

(issuer, accountId) -> Auth Account -> Atlas User -> Ontahí Principal
                                                { kind: "user",
                                                  issuer: "atlas",
                                                  subject: user.id }
```

Sign-in and linking rules:

```text
unknown provider identity
  + no authenticated Atlas User -> create User and Account
  + authenticated Atlas User    -> explicit link to that User

known provider identity         -> load its existing User
same email alone                -> never silently merge Users
unlink last Account             -> reject
```

Better Auth's four core records are the persistence model for authentication. Atlas should not add
a redundant `atlas_users` domain table merely to mirror them. Future workspace ownership will
reference the durable Better Auth User ID; Atlas-owned profile or policy concepts can be introduced
only when they carry domain information beyond authentication.

## Execution Slices

1. [x] Shape the durable User/Account identity contract and account-linking invariants.
2. [x] Add the PostgreSQL schema and prove it through repeatable isolated migrations.
3. [x] Share Atlas's application Pool with Better Auth and retain a no-database fallback.
4. [x] Configure provider-ID identity, explicit linking, last-account protection, stable Atlas
       Principals, and provider-token redaction.
5. [x] Document local and Vercel rollout and verify the complete application.
6. [x] Automate serialized production migration and schema verification on merge, with the Vercel
       production build using the same gate before publication.
7. [ ] Run a real persisted GitHub sign-in/session/sign-out smoke after the production migration.

## Verification

1. Applying all migrations to an empty PostgreSQL schema creates the Better Auth tables and can be
   repeated without schema drift.
2. With `DATABASE_URL`, a first GitHub login creates exactly one User, Account, and Session; another
   login through that Account reuses the User.
3. Without `DATABASE_URL`, the existing public/stateless authentication proof continues to work.
4. The configured account-linking policy disables implicit same-email linking, permits explicit
   different-email linking, and refuses removal of the final Account.
5. Durable Account rows do not retain provider access, refresh, or ID tokens.
6. Authenticated Runtime Protocol operations observe an `atlas` Principal whose subject is the
   internal User ID.
7. `pnpm verify`, the opt-in PostgreSQL suite, and `git diff --check` pass.
8. GitHub Actions syntax validation passes, Pull Requests cannot access the production database,
   and a non-production Vercel build skips migrations.

## Decisions

1. User identity is an internal generated ID. Email is mutable profile/contact data and may be used
   for display or verified communication, never as the primary key or silent merge key.
2. Better Auth owns the authentication User/Account/Session/Verification records; Atlas migrations
   own their physical PostgreSQL schema and rollout.
3. Provider identity uses `provider-id`, whose stable lookup is `(issuer, accountId)`.
4. Implicit account linking is disabled. Linking is explicit from an authenticated session and may
   join a provider account with a different email because control of both sessions is the proof.
5. The final Account cannot be unlinked. Newly linked providers do not silently replace the User's
   profile.
6. Human OAuth tokens are discarded because source access remains the GitHub App installation
   flow's responsibility.
7. Database presence selects persistent auth during this transition. Requiring durable auth in
   production can become a fail-closed rollout step after the persisted OAuth smoke.
8. Production migrations run on every push to `main`, not only when a path filter notices a new SQL
   file. Idempotent retries repair a previously failed run and verify accumulated schema state.
9. The GitHub `Production` environment owns the direct `DATABASE_URL_UNPOOLED` secret. Migration
   jobs have read-only repository permissions and never run for Pull Request events.
10. Vercel production builds apply and verify migrations before compiling. The database runner's
    advisory lock and checksums make overlap with GitHub Actions safe.

## Open Questions

1. Which verified address should become the User's primary email after explicit linking, and should
   changing it require a separate confirmation workflow?
2. What recovery proof is acceptable when a User loses access to every linked provider?
3. When should production remove the stateless fallback and fail closed without `DATABASE_URL`?
4. Should account-management UI land with the second provider or with workspace settings?

## Closure / Evolution

### 2026-09-03 — implementation start

The plan is current and its first durable model slice is shaped. Implementation starts as a PR
stacked on the GitHub-authentication PR so persistence and multi-provider identity remain a
reviewable boundary. Workspace ownership and visibility remain the next product slice after the
persisted identity smoke succeeds.

### 2026-09-03 — first implementation checkpoint

Migration 006 now installs Atlas-named Better Auth User, Account, Session, and Verification tables
with UUID identifiers and a unique `(issuer, account_id)` provider binding. When `DATABASE_URL` is
present, Better Auth and the Atlas application composition share one PostgreSQL Pool; without it,
the prior stateless session remains available. Account hooks discard access, refresh, and ID tokens
on create and update. The Runtime Protocol Principal now uses issuer `atlas` and the durable User ID
as its subject.

A disposable local PostgreSQL 18 instance applied all six migrations and passed `db:verify` against
both the Ontahí entity model and Better Auth's expected schema. Six opt-in PostgreSQL integration
tests passed, including UUID User/Account/Session creation, stable provider-account lookup, and
token-redaction assertions. The normal suite has 65 passing tests with the six opt-in database tests
skipped; typechecking, the production build, source-trace verification across 75 Markdown files,
and `git diff --check` pass.

The PR boundary is ready, but the plan remains current. A real GitHub callback/session/sign-out
smoke after the automated production migration must confirm that the existing OAuth registration
now returns the same persisted Atlas User.

### 2026-09-03 — production migration automation

Production schema rollout is no longer a remembered operator step. Every push to `main` runs a
serialized GitHub Actions job in the `Production` environment using only its direct database secret;
the job applies checksum migrations and verifies both Ontahí and Better Auth schema compatibility.
It can also be dispatched manually as a recovery path and never receives production credentials on
Pull Request events.

Vercel's automatic production build runs the same migration and verification before compilation,
closing the race between deployment and the post-merge workflow. Preview builds skip this gate.
Both invocations can overlap safely because the database migration runner already serializes with
an advisory lock and records immutable checksums. Future schema changes must remain expand-first so
the migration is compatible with the previously deployed application.

The repository `Production` environment now contains the direct `DATABASE_URL_UNPOOLED` secret;
its value was transferred directly from the Neon CLI without printing or storing it locally.
Workflow syntax validation passes. A preview-mode Vercel build skipped migrations and completed,
while a production-mode build against disposable PostgreSQL 18 applied all six migrations,
verified both schemas, and compiled successfully. The final `pnpm verify` run has 65 passing tests,
six opt-in database tests skipped, successful typechecking and build, and verified 76 Atlas-owned
Markdown files; `git diff --check` also passes.
