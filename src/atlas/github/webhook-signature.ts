import { createHmac, timingSafeEqual } from 'node:crypto';

const signaturePrefix = 'sha256=';

export const createAtlasGitHubWebhookSignature = (payload: string, secret: string) =>
  `${signaturePrefix}${createHmac('sha256', secret).update(payload, 'utf8').digest('hex')}`;

export const verifyAtlasGitHubWebhookSignature = (input: {
  payload: string;
  secret: string;
  signatureHeader: string | null;
}) => {
  if (!input.signatureHeader?.startsWith(signaturePrefix)) {
    return false;
  }

  const expected = Buffer.from(
    createAtlasGitHubWebhookSignature(input.payload, input.secret),
    'utf8',
  );
  const received = Buffer.from(input.signatureHeader, 'utf8');

  return expected.length === received.length && timingSafeEqual(expected, received);
};
