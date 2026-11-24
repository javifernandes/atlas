import { afterEach, describe, expect, it } from 'vitest';

import {
  atlasStorybookEvidence,
  getAtlasStoryParameters,
  getStorybookBaseUrl,
  getStorybookDeepLink,
  getStorybookEvidenceById,
  getStorybookEvidenceForItem,
  getStorybookPreviewUrl,
} from './storybook-evidence';

const previousStorybookUrl = process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;

afterEach(() => {
  if (previousStorybookUrl === undefined) {
    delete process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;
  } else {
    process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL = previousStorybookUrl;
  }
});

describe('Storybook evidence registry', () => {
  it('keeps evidence and story identifiers unique', () => {
    expect(new Set(atlasStorybookEvidence.map(item => item.id)).size).toBe(
      atlasStorybookEvidence.length,
    );
    expect(new Set(atlasStorybookEvidence.map(item => item.storyId)).size).toBe(
      atlasStorybookEvidence.length,
    );
  });

  it('projects stable Atlas parameters for a registered story', () => {
    const pending = getStorybookEvidenceById('pending-invitation');

    expect(getAtlasStoryParameters(pending)).toEqual({
      atlas: {
        activity: 'claim-invitation',
        interaction: 'respond-to-workspace-invitation',
        item: 'spec-workstream-atlas.access-identity.workspace.respond-to-invitation',
      },
    });
    expect(getStorybookEvidenceForItem(pending.itemId)).toContain(pending);
  });

  it('derives preview and deep links from the configured Storybook base URL', () => {
    process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL = 'https://storybook.example.test/';
    const pending = getStorybookEvidenceById('pending-invitation');

    expect(getStorybookBaseUrl()).toBe('https://storybook.example.test');
    expect(getStorybookPreviewUrl(pending)).toBe(
      `https://storybook.example.test/iframe.html?id=${pending.storyId}&viewMode=story`,
    );
    expect(getStorybookDeepLink(pending)).toBe(
      `https://storybook.example.test/?path=/story/${pending.storyId}`,
    );
  });

  it('does not invent Storybook URLs outside development when none is configured', () => {
    delete process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;
    const pending = getStorybookEvidenceById('pending-invitation');

    expect(getStorybookBaseUrl()).toBeNull();
    expect(getStorybookPreviewUrl(pending)).toBeNull();
    expect(getStorybookDeepLink(pending)).toBeNull();
  });

  it('rejects unknown evidence identifiers', () => {
    expect(() => getStorybookEvidenceById('missing')).toThrow(
      'Unknown Atlas Storybook evidence: missing',
    );
  });
});
