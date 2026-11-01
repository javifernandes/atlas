import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeAsync = vi.hoisted(() => vi.fn());
vi.mock('@ontahi/react/graph', () => ({
  useOperation: () => ({ executeAsync, isExecuting: false }),
}));

import { PlanAssistant } from './plan-assistant';

describe('PlanAssistant', () => {
  beforeEach(() => executeAsync.mockReset());

  it('submits a read-only question and renders cited Plans', async () => {
    executeAsync.mockResolvedValue({
      ok: true,
      value: {
        answer: '[Plan 137, Workspace Ownership V0](plan-137) is the authorization boundary.',
        citations: [
          { planId: 'plan-137', path: 'plans/done/137.md', title: 'Workspace Ownership V0' },
        ],
      },
    });
    render(<PlanAssistant workspaceId='workspace-1' />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask Atlas about Plans' }));
    fireEvent.change(screen.getByLabelText('Question about Atlas Plans'), {
      target: { value: 'What owns authorization?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));

    await waitFor(() => expect(executeAsync).toHaveBeenCalledOnce());
    expect(executeAsync).toHaveBeenCalledWith({
      workspace: { id: 'workspace-1' },
      question: 'What owns authorization?',
    });
    expect(screen.queryByText(/Plan consulted/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan 137, Workspace Ownership V0' })).toHaveAttribute(
      'href',
      '/?node=plan-137&full=plan-137',
    );
    fireEvent.click(screen.getByRole('link', { name: 'Plan 137, Workspace Ownership V0' }));
    expect(globalThis.location.search).toBe('?node=plan-137&full=plan-137');
    expect(screen.getByRole('region', { name: 'Atlas Plan assistant' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Plan 137, Workspace Ownership V0' })).toBeInTheDocument();
  });

  it('submits from the composer with Command Enter', async () => {
    executeAsync.mockResolvedValue({
      ok: true,
      value: { answer: 'A bounded answer.', citations: [] },
    });
    render(<PlanAssistant workspaceId='workspace-1' />);

    fireEvent.click(screen.getByRole('button', { name: 'Ask Atlas about Plans' }));
    const composer = screen.getByLabelText('Question about Atlas Plans');
    fireEvent.change(composer, { target: { value: 'What is bounded?' } });
    fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });

    await waitFor(() => expect(executeAsync).toHaveBeenCalledWith({
      workspace: { id: 'workspace-1' },
      question: 'What is bounded?',
    }));
  });
});
