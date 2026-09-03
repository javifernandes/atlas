import type {
  GraphHttpIngressOutcome,
  GraphHttpIngressProvider,
} from '@ontahi/core/runtime/server/ingress';

import { verifyAtlasGitHubWebhookSignature } from './webhook-signature';

type AtlasGitHubWebhookIngressProviderInput = {
  getSecret: () => string | null;
};

type JsonRecord = Record<string, unknown>;

const provider = 'github';
const providerKey = 'github-webhook';

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) => (typeof value === 'string' ? value : null);

const accepted = (
  event: string | null,
  deliveryId: string | null,
  details?: Record<string, unknown>,
): GraphHttpIngressOutcome => ({
  kind: 'accepted',
  provider,
  providerKey,
  event,
  deliveryId,
  details,
});

const parseMergedPullRequest = (payload: unknown, deliveryId: string | null) => {
  if (!isRecord(payload) || payload.action !== 'closed') {
    return null;
  }

  const pullRequest = payload.pull_request;
  const repository = payload.repository;
  const installation = payload.installation;

  if (
    !isRecord(pullRequest) ||
    pullRequest.merged !== true ||
    !isRecord(repository) ||
    typeof repository.full_name !== 'string' ||
    !isRecord(installation) ||
    (typeof installation.id !== 'number' && typeof installation.id !== 'string') ||
    typeof pullRequest.number !== 'number' ||
    typeof pullRequest.title !== 'string' ||
    typeof pullRequest.html_url !== 'string' ||
    typeof pullRequest.merged_at !== 'string'
  ) {
    return null;
  }

  const user = isRecord(pullRequest.user) ? pullRequest.user : null;

  return {
    authorProviderAccountId:
      user && (typeof user.id === 'number' || typeof user.id === 'string')
        ? String(user.id)
        : null,
    authorLogin: user ? optionalString(user.login) : null,
    body: optionalString(pullRequest.body),
    deliveryId,
    installationId: String(installation.id),
    mergeCommitSha: optionalString(pullRequest.merge_commit_sha),
    mergedAt: pullRequest.merged_at,
    number: pullRequest.number,
    repositoryFullName: repository.full_name,
    title: pullRequest.title,
    url: pullRequest.html_url,
  };
};

const parseRepositoryPush = (payload: unknown, deliveryId: string | null) => {
  if (!isRecord(payload)) {
    return null;
  }

  const repository = payload.repository;
  const installation = payload.installation;
  if (
    !isRecord(repository) ||
    typeof repository.full_name !== 'string' ||
    !isRecord(installation) ||
    (typeof installation.id !== 'number' && typeof installation.id !== 'string') ||
    typeof payload.ref !== 'string' ||
    typeof payload.before !== 'string' ||
    typeof payload.after !== 'string'
  ) {
    return null;
  }

  return {
    after: payload.after,
    before: payload.before,
    deliveryId,
    installationId: String(installation.id),
    ref: payload.ref,
    repositoryFullName: repository.full_name,
  };
};

export const createAtlasGitHubWebhookIngressProvider = (
  input: AtlasGitHubWebhookIngressProviderInput,
): GraphHttpIngressProvider => ({
  receive: async request => {
    const webhookSecret = input.getSecret();

    if (!webhookSecret) {
      return {
        kind: 'rejected',
        status: 503,
        error: 'Atlas GitHub webhook is not configured',
      };
    }

    const event = request.headers.get('x-github-event');
    const deliveryId = request.headers.get('x-github-delivery');
    const signatureHeader = request.headers.get('x-hub-signature-256');
    const body = await request.text();

    if (
      !verifyAtlasGitHubWebhookSignature({
        payload: body,
        secret: webhookSecret,
        signatureHeader,
      })
    ) {
      return {
        kind: 'rejected',
        status: 401,
        error: 'Invalid GitHub webhook signature',
      };
    }

    if (event === 'ping') {
      return accepted(event, deliveryId, { ignored: false });
    }

    if (event !== 'pull_request' && event !== 'push') {
      return {
        kind: 'ignored',
        provider,
        providerKey,
        event,
        deliveryId,
      };
    }

    if (!deliveryId) {
      return {
        kind: 'rejected',
        status: 400,
        error: 'GitHub webhook delivery id is required',
      };
    }

    let payload: unknown;

    try {
      payload = JSON.parse(body) as unknown;
    } catch {
      return {
        kind: 'rejected',
        status: 400,
        error: 'GitHub webhook payload is invalid',
      };
    }

    if (event === 'push') {
      const repositoryPush = parseRepositoryPush(payload, deliveryId);

      if (!repositoryPush) {
        return {
          kind: 'rejected',
          status: 400,
          error: 'GitHub push payload is invalid',
        };
      }

      return {
        kind: 'accepted',
        provider,
        providerKey,
        channel: 'source-control.repository.pushed',
        event,
        deliveryId,
        payload: repositoryPush,
        status: 202,
        details: {
          accepted: true,
          ref: repositoryPush.ref,
          repositoryFullName: repositoryPush.repositoryFullName,
        },
      };
    }

    const mergedPullRequest = parseMergedPullRequest(payload, deliveryId);

    if (!mergedPullRequest) {
      return {
        kind: 'ignored',
        provider,
        providerKey,
        event,
        deliveryId,
      };
    }

    return {
      kind: 'accepted',
      provider,
      providerKey,
      channel: 'source-control.pull-request.merged',
      event,
      deliveryId,
      payload: mergedPullRequest,
      status: 202,
      details: {
        accepted: true,
        pullRequestNumber: mergedPullRequest.number,
        repositoryFullName: mergedPullRequest.repositoryFullName,
      },
    };
  },
});
