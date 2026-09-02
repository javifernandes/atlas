const trimEnv = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const decodeBase64Pem = (value: string): string | null => {
  try {
    const decoded = Buffer.from(value, 'base64').toString('utf8').trim();

    return decoded.includes('BEGIN') && decoded.includes('PRIVATE KEY') ? decoded : null;
  } catch {
    return null;
  }
};

export type AtlasGitHubAppConfig = {
  appId: string;
  privateKey: string;
  webhookSecret: string;
};

export const getAtlasGitHubAppConfig = (): Partial<AtlasGitHubAppConfig> => {
  const privateKeyBase64 = trimEnv(process.env.ATLAS_GITHUB_APP_PRIVATE_KEY_BASE64);

  return {
    appId: trimEnv(process.env.ATLAS_GITHUB_APP_ID) ?? undefined,
    privateKey: privateKeyBase64 ? (decodeBase64Pem(privateKeyBase64) ?? undefined) : undefined,
    webhookSecret: trimEnv(process.env.ATLAS_GITHUB_APP_WEBHOOK_SECRET) ?? undefined,
  };
};

export const getAtlasGitHubAppConfigStatus = () => {
  const config = getAtlasGitHubAppConfig();
  const missing = (['appId', 'privateKey', 'webhookSecret'] as const).filter(
    key => !config[key],
  );

  return {
    configured: missing.length === 0,
    missing,
  };
};

export const requireAtlasGitHubWebhookSecret = (): string | null =>
  getAtlasGitHubAppConfig().webhookSecret ?? null;
