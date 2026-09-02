# Atlas GitHub App

Atlas uses a private GitHub App to read federated source repositories and receive merged pull
request events. GitHub remains authoritative for PR records; the webhook invalidates Atlas's cached
source/evidence projection and returns without mirroring the event into Markdown.

## Registration

Create a GitHub App without a Marketplace listing and configure:

1. Repository permissions:
   - Contents: read-only
   - Pull requests: read-only
   - Metadata: read-only (implicit)
2. Subscribe to events:
   - Pull request
3. Webhook URL:
   - Production: `https://<atlas-host>/api/ingress/github/webhook`
   - Local: the forwarding URL described below
4. Webhook secret: a generated secret shared only with Atlas.

Install the App only on repositories present in the Atlas source registry, including the Atlas
repository itself. Atlas resolves the App installation for each configured repository and mints
short-lived installation tokens; no user installation flow or installation database is required.

## Environment

Copy `.env.example` to `.env.local` and provide:

- `ATLAS_GITHUB_APP_ID`: numeric GitHub App id.
- `ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64`: the App private key PEM encoded as one base64 string.
- `ATLAS_GITHUB_APP_WEBHOOK_SECRET`: the webhook signing secret.
- `ATLAS_GITHUB_REPOSITORY`: intrinsic Atlas repository as `owner/repository`. Vercel repository
  metadata and `package.json` are fallbacks.

`ATLAS_GITHUB_TOKEN` remains an optional local read fallback. Hosted environments should use the
GitHub App.

## Pull Request Convention

Follow the canonical
[`Atlas Evidence Binding Guidelines`](./atlas-evidence-binding-guidelines.md). Explicit author
assertions use `Atlas-Implements` and `Atlas-Shapes` in the merged PR body. Commit trailers may
repeat them for traceability but are not currently ingested. A merge records evidence and does not
mutate the target Plan or Item status.

## Local Webhook Test

1. Run `pnpm dev` and keep Atlas available on port 3000.
2. Forward a public webhook URL to
   `http://localhost:3000/api/ingress/github/webhook` with `smee.io`, ngrok, or an equivalent tool.
3. Temporarily configure the GitHub App webhook URL with the forwarding URL.
4. Deliver `ping` and verify a successful response.
5. Merge a PR containing an Atlas directive and reload the linked Item or Plan's Evolution view.

The six-hour refresh workflow remains a recovery path until production deliveries are verified.
