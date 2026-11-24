import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { InteractionEvidence } from './interaction-evidence';

const itemId = 'spec-workstream-atlas.access-identity.workspace.respond-to-invitation';
const previousStorybookUrl = process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;

afterEach(() => {
  if (previousStorybookUrl === undefined) {
    delete process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;
  } else {
    process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL = previousStorybookUrl;
  }
});

describe('InteractionEvidence', () => {
  it('shows the selected semantic state as a live Storybook realization', () => {
    process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL = 'https://storybook.example.test';
    render(<InteractionEvidence itemId={itemId} />);

    const initialPreview = screen.getByTitle('Checking invitation Storybook preview');
    expect(initialPreview).toHaveAttribute(
      'src',
      expect.stringContaining(
        'https://storybook.example.test/iframe.html?id=interactions-respond-to-workspace-invitation--checking-invitation',
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /Identity mismatch/i }));

    expect(screen.getByTitle('Identity mismatch Storybook preview')).toHaveAttribute(
      'src',
      expect.stringContaining('--identity-mismatch&viewMode=story'),
    );
    expect(screen.getByRole('link', { name: /Open in Storybook/i })).toHaveAttribute(
      'href',
      expect.stringContaining('--identity-mismatch'),
    );
  });

  it('explains when an Interaction has no registered UI evidence', () => {
    render(<InteractionEvidence itemId='unregistered-item' />);

    expect(screen.getByText('No inspectable UI evidence is registered yet.')).toBeVisible();
  });

  it('keeps the semantic binding visible without rendering broken Storybook surfaces', () => {
    delete process.env.NEXT_PUBLIC_ATLAS_STORYBOOK_URL;
    render(<InteractionEvidence itemId={itemId} />);

    expect(screen.getAllByText('Checking invitation')).toHaveLength(2);
    expect(screen.getAllByText('resolve-context')).toHaveLength(2);
    expect(screen.getByText('Storybook preview is not configured.')).toBeVisible();
    expect(screen.queryByTitle(/Storybook preview/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Open in Storybook/i })).not.toBeInTheDocument();
  });
});
