# Atlas Authentication

Atlas uses [Better Auth](https://better-auth.com/) for human authentication and GitHub as the first
OAuth provider. When `DATABASE_URL` is present, Better Auth persists Users, provider Accounts,
Sessions, and Verification records in Atlas PostgreSQL. A first successful sign-in creates a User
and GitHub Account automatically; future sign-ins resolve that same User through the provider's
stable issuer and account ID.

Without `DATABASE_URL`, Atlas retains the original signed-and-encrypted cookie session as a
transitional local/preview fallback. That fallback can identify the current request but cannot
support durable ownership, linked providers, or per-session revocation.

Human login and repository integration reuse the same Atlas GitHub App registration, but remain
separate trust flows with separate credentials:

1. the App's OAuth client ID and client secret identify the human using Atlas;
2. the App's numeric ID and private key mint installation tokens for repository reads;
3. the App's webhook secret verifies webhook deliveries;
4. an authenticated human session never replaces the installation token used for source access.

## Local GitHub OAuth Setup

In the existing Atlas GitHub App, configure these exact redirect URIs:

1. `http://localhost:3000/api/auth/callback/github`
2. `https://atlas-ten-ebon.vercel.app/api/auth/callback/github`

Leave wildcard matching, device flow, and OAuth-during-installation disabled. Under Account
permissions, grant Email addresses read-only so GitHub can provide the identity Better Auth
requires. Generate a client secret from the App's settings. The App client ID shown beside it is
not the numeric GitHub App ID.

If Email addresses permission is added after a user already authorized the App, that user must
approve the new account permission. If GitHub does not prompt on the next sign-in, revoke Atlas
under Authorized GitHub Apps and sign in again. Without that approval, a private-email profile
reaches Better Auth without an email and is rejected with `email_not_found`.

Copy `.env.example` to `.env.local` and configure:

```dotenv
ATLAS_AUTH_GITHUB_CLIENT_ID=<github-app-client-id>
ATLAS_AUTH_GITHUB_CLIENT_SECRET=<github-app-client-secret>
BETTER_AUTH_SECRET=<at-least-32-high-entropy-characters>
BETTER_AUTH_URL=http://localhost:3000
```

Generate the Better Auth secret with a cryptographically secure generator, for example:

```sh
openssl rand -base64 32
```

Production reuses the same GitHub App and sets `BETTER_AUTH_URL` to the exact deployed origin. A
Vercel preview has a changing origin, so keep authentication variables production-scoped unless a
stable preview domain has also been registered as a redirect URI.

## Viewer Visibility

Atlas is private by default. A complete GitHub OAuth configuration admits any successfully
authenticated GitHub User:

```dotenv
ATLAS_VISIBILITY=private
```

Anonymous page requests render a lightweight login landing before Atlas loads its projection.
Private mode also gates `/runtime` and `/operations`, and fails closed when authentication is
incomplete. The root page and sign-in surface advertise `noindex, nofollow`; the authenticated
session remains the actual access boundary.

Local development may explicitly bypass authentication:

```dotenv
ATLAS_VISIBILITY=public
```

Public mode permits anonymous reads and may still configure GitHub login so the current Principal
is available to operations. Atlas rejects this bypass when `NODE_ENV=production`; deployed
environments are always gated.

Atlas also disables Better Auth's stateless account cookie. The session remains signed and
encrypted in fallback mode, but account data is never placed in that cookie.

## Persistent Users And Linked Accounts

The durable authentication schema is installed by
`migrations/006-persistent-users-and-linked-accounts.sql` through the existing `pnpm db:migrate`
workflow:

```text
atlas_auth_users
  |-- atlas_auth_accounts
  `-- atlas_auth_sessions

atlas_auth_verifications
```

All record IDs are UUIDs. `atlas_auth_accounts` uniquely identifies a provider login by
`(issuer, account_id)` and points to the stable internal User ID. Email is required profile/contact
data but is not the identity key and never silently links independently authenticated accounts.

Better Auth and Atlas share the same `pg.Pool`. Better Auth uses it directly for User, Account,
Session, and Verification writes. Ontahí maps the server-only `AtlasUser` and `AtlasAuthAccount`
Entities onto the same User and Account tables, so later Atlas Entities can relate to durable users
without a second identity store. The Ontahí Account shape excludes passwords and every provider
token; Session and Verification remain Better Auth infrastructure.

Atlas keeps Better Auth's `session_data` codec pinned to encrypted JWE in both persistence modes.
PostgreSQL mode disables cookie-cache authorization, but retaining the codec lets it safely read and
discard a cookie issued by the earlier stateless deployment. That browser is signed out because its
old session has no database record; it must not turn the first refresh after rollout into a server
error.

Atlas configures account linking with these invariants:

1. implicit same-email linking is disabled;
2. a signed-in User may explicitly link another provider after completing that provider's OAuth
   proof, including when it returns a different email;
3. the final provider Account cannot be unlinked;
4. a linked provider does not automatically overwrite the existing User profile;
5. GitHub access, refresh, and ID tokens are discarded before Account inserts or updates.

The token policy is intentional: Atlas source reads use GitHub App installation tokens. A human
OAuth token grants no source authority and need not become a durable secret.

Production migration is automatic. GitHub's post-merge workflow and the Vercel production build
both run the checksum migrator through `DATABASE_URL_UNPOOLED`; the Vercel build verifies the schema
before it can publish the new application. Vercel still uses the pooled `DATABASE_URL` for normal
Atlas and auth reads. Persistent previews need their own isolated database branch and migration;
they must never receive either production connection string.

## Ontahí Boundary

Atlas validates the Better Auth session at the Next.js host boundary and maps the user to:

```ts
{
  kind: 'user',
  issuer: 'atlas',
  subject: session.user.id,
}
```

The Runtime Protocol dispatch runs inside `withInvocationContext({ principal })`. Ontahí therefore
receives one provider-neutral Principal and does not depend on Better Auth, GitHub cookies, or OAuth
tokens.

## Next Ownership Slice

Authentication persistence intentionally stops before resource authorization. When
`AtlasWorkspace` lands, Atlas-owned Workspace and Membership records will reference the stable User
ID. At that point:

1. workspace visibility replaces the deployment environment flag;
2. owner/member relationships replace the coarse deployment-wide authenticated boundary;
3. Client Applications authenticate as service Principals with separate scoped grants.
