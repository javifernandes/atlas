# Atlas Authentication

Atlas uses [Better Auth](https://better-auth.com/) for human authentication and GitHub as the first
OAuth provider. The first slice is stateless: the validated session lives in signed and encrypted
cookies, so login does not require a database before Atlas has durable User and Workspace entities.

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

The default remains an anonymous public viewer:

```dotenv
ATLAS_VISIBILITY=public
```

Public deployments may still configure GitHub login so the current Principal is available to
future operations.

The temporary private mode requires both complete authentication configuration and a comma-separated
allowlist of stable numeric GitHub user IDs:

```dotenv
ATLAS_VISIBILITY=private
ATLAS_PRIVATE_GITHUB_USER_IDS=12345678,87654321
```

The current account ID is available with `gh api user --jq .id`. Atlas deliberately checks the
provider-owned numeric ID rather than a mutable GitHub login.

Private mode gates both the viewer page and `/runtime`. It fails closed when authentication or the
allowlist is incomplete. The allowlist is a bootstrap mechanism for the deployment-scoped viewer,
not the durable authorization model.

Atlas also disables Better Auth's stateless account cookie. The session remains signed and
encrypted, but the GitHub OAuth access token is not retained because repository access belongs to
the same registration's installation-token flow.

## Ontahí Boundary

Atlas validates the Better Auth session at the Next.js host boundary and maps the user to:

```ts
{
  kind: 'user',
  issuer: 'atlas:better-auth',
  subject: session.user.id,
}
```

The Runtime Protocol dispatch runs inside `withInvocationContext({ principal })`. Ontahí therefore
receives one provider-neutral Principal and does not depend on Better Auth, GitHub cookies, or OAuth
tokens.

## Next Persistence Slice

Stateless auth intentionally cannot provide durable workspace ownership, membership, invitation, or
per-session revocation. When `AtlasWorkspace` lands, Atlas should add database-backed Better Auth
users and sessions alongside Atlas-owned Workspace and Membership records. At that point:

1. workspace visibility replaces the deployment environment flag;
2. owner/member relationships replace the GitHub allowlist;
3. Client Applications authenticate as service Principals with separate scoped grants.
