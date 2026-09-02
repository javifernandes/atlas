// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createAtlasGitHubWebhookIngressProvider } from './webhook-ingress-provider';
import { createAtlasGitHubWebhookSignature } from './webhook-signature';

const secret = 'atlas-test-secret';

const requestFor = (payload: unknown, signatureSecret = secret) => {
  const body = JSON.stringify(payload);

  return new Request('https://atlas.test/api/ingress/github/webhook', {
    method: 'POST',
    headers: {
      'x-github-delivery': 'delivery-1',
      'x-github-event': 'pull_request',
      'x-hub-signature-256': createAtlasGitHubWebhookSignature(body, signatureSecret),
    },
    body,
  });
};

const mergedPullRequestPayload = {
  action: 'closed',
  installation: { id: 1234 },
  repository: { full_name: 'acme/product' },
  pull_request: {
    number: 42,
    title: 'Connect implementation evidence',
    body: 'Atlas-Shapes: product.reader',
    html_url: 'https://github.com/acme/product/pull/42',
    merged: true,
    merged_at: '2026-09-01T10:00:00Z',
    merge_commit_sha: 'abc123',
    user: { login: 'javi' },
  },
};

describe('Atlas GitHub webhook ingress provider', () => {
  it('normalizes a signed merged pull request event', async () => {
    const provider = createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret });

    await expect(provider.receive(requestFor(mergedPullRequestPayload))).resolves.toMatchObject({
      kind: 'accepted',
      provider: 'github',
      providerKey: 'github-webhook',
      channel: 'source-control.pull-request.merged',
      deliveryId: 'delivery-1',
      status: 202,
      payload: {
        deliveryId: 'delivery-1',
        installationId: '1234',
        repositoryFullName: 'acme/product',
        number: 42,
        title: 'Connect implementation evidence',
      },
    });
  });

  it('rejects an invalid signature before parsing the event', async () => {
    const provider = createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret });

    await expect(
      provider.receive(requestFor(mergedPullRequestPayload, 'wrong-secret')),
    ).resolves.toEqual({
      kind: 'rejected',
      status: 401,
      error: 'Invalid GitHub webhook signature',
    });
  });

  it('ignores a closed pull request that was not merged', async () => {
    const provider = createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret });

    await expect(
      provider.receive(
        requestFor({
          ...mergedPullRequestPayload,
          pull_request: { ...mergedPullRequestPayload.pull_request, merged: false },
        }),
      ),
    ).resolves.toMatchObject({ kind: 'ignored', event: 'pull_request' });
  });
});
