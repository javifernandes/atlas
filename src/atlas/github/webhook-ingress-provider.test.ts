// @vitest-environment node

import { describe, expect, it } from 'vitest';

import { createAtlasGitHubWebhookIngressProvider } from './webhook-ingress-provider';
import { createAtlasGitHubWebhookSignature } from './webhook-signature';

const secret = 'atlas-test-secret';

const requestFor = (
  payload: unknown,
  signatureSecret = secret,
  event = 'pull_request',
) => {
  const body = JSON.stringify(payload);

  return new Request('https://atlas.test/api/ingress/github/webhook', {
    method: 'POST',
    headers: {
      'x-github-delivery': 'delivery-1',
      'x-github-event': event,
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
    user: { id: 101, login: 'javi' },
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
        authorProviderAccountId: '101',
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

  it('requires a delivery id for durable deduplication', async () => {
    const provider = createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret });
    const request = requestFor(mergedPullRequestPayload);
    request.headers.delete('x-github-delivery');

    await expect(provider.receive(request)).resolves.toEqual({
      kind: 'rejected',
      status: 400,
      error: 'GitHub webhook delivery id is required',
    });
  });

  it('normalizes a signed repository push event', async () => {
    const provider = createAtlasGitHubWebhookIngressProvider({ getSecret: () => secret });

    await expect(
      provider.receive(
        requestFor(
          {
            after: 'new-revision',
            before: 'old-revision',
            installation: { id: 1234 },
            ref: 'refs/heads/main',
            repository: { full_name: 'acme/product' },
          },
          secret,
          'push',
        ),
      ),
    ).resolves.toMatchObject({
      kind: 'accepted',
      channel: 'source-control.repository.pushed',
      deliveryId: 'delivery-1',
      payload: {
        after: 'new-revision',
        before: 'old-revision',
        installationId: '1234',
        ref: 'refs/heads/main',
        repositoryFullName: 'acme/product',
      },
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
