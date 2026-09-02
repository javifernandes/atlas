import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { PlanWorkstreamExplorer } from './atlas-explorer';

import { ThemeProvider } from '@/components/theme-provider';
import type {
  PlanWorkstreamNode,
  PlanWorkstreamSnapshot,
} from '@/atlas/model/snapshot';

const createNode = (
  id: string,
  input: {
    kind?: PlanWorkstreamNode['kind'];
    markdown: string;
    semanticId: string;
    shortTitle: string;
    statusGroup?: PlanWorkstreamNode['statusGroup'];
    summary?: string;
  },
): PlanWorkstreamNode => ({
  id,
  kind: input.kind ?? 'system-primitive',
  title: input.shortTitle,
  shortTitle: input.shortTitle,
  statusGroup: input.statusGroup ?? 'current',
  status: input.statusGroup ?? 'current',
  territory: 'Test Territory',
  path: `atlas/items/${id}.md`,
  semanticId: input.semanticId,
  markdown: input.markdown,
  summary: input.summary,
  sections: [],
  relatedCount: 0,
  candidateCount: 0,
});

const snapshot: PlanWorkstreamSnapshot = {
  generatedAt: '2026-07-15T00:00:00.000Z',
  metrics: [],
  territories: [],
  nodes: [
    createNode('parent-item', {
      kind: 'territory',
      semanticId: 'parent-item',
      shortTitle: 'Parent Item',
      markdown: 'Parent Item overview text.',
      summary: 'Parent Item summary.',
    }),
    createNode('item-a', {
      semanticId: 'item-a',
      shortTitle: 'Item A',
      markdown: 'Item A overview text.',
      summary: 'Item A summary.',
    }),
    createNode('item-b', {
      kind: 'plan',
      semanticId: 'item-b',
      shortTitle: 'Item B',
      statusGroup: 'next',
      markdown: 'Item B overview text. [[atlas:item-a|Back to item A]]',
      summary: 'Item B summary.',
    }),
    createNode('item-c', {
      semanticId: 'item-c',
      shortTitle: 'Item C',
      markdown: 'Item C overview text.',
      summary: 'Item C summary.',
    }),
    createNode('item-d', {
      semanticId: 'item-d',
      shortTitle: 'Item D',
      markdown: 'Item D overview text.',
      summary: 'Item D summary.',
    }),
    createNode('wrapped-list-item', {
      kind: 'plan',
      semanticId: 'wrapped-list-item',
      shortTitle: 'Wrapped List Item',
      markdown: `## Execution Slices

### Slice 0

- [x] Record the high-level entity, operation, relation, storage, and codegen
      inventory.
- [ ] Classify every graph API entry as an entity, relation, view, or
      compatibility alias.

1. Compare the semantic
   vocabulary.

- Preserve the reflected
  metadata.`,
    }),
  ],
  edges: [
    {
      id: 'parent-item-to-item-a',
      from: 'parent-item',
      to: 'item-a',
      kind: 'contains',
    },
    {
      id: 'item-a-to-item-b',
      from: 'item-a',
      to: 'item-b',
      kind: 'shaped-by',
    },
    {
      id: 'item-a-to-item-c',
      from: 'item-a',
      to: 'item-c',
      kind: 'supports',
    },
    {
      id: 'item-a-to-item-d',
      from: 'item-a',
      to: 'item-d',
      kind: 'related',
    },
  ],
};

const renderExplorer = ({
  value = snapshot,
}: {
  value?: PlanWorkstreamSnapshot;
} = {}) =>
  render(
    <ThemeProvider forcedTheme='dark'>
      <PlanWorkstreamExplorer snapshot={value} />
    </ThemeProvider>,
  );

describe('PlanWorkstreamExplorer', () => {
  it('opens a new full-detail item on overview and restores the previous item tab when returning', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=item-a');
    const user = userEvent.setup();

    renderExplorer();

    let dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Item A overview text.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'evolution' }));
    expect(within(dialog).queryByText('Item A overview text.')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Item C' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Item D' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'context' }));
    expect(within(dialog).getAllByRole('button', { name: 'Parent Item' })).toHaveLength(2);
    expect(
      within(dialog).queryByRole('button', { name: /contained by\s*Parent Item/ }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /supports\s*Item C/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /related\s*Item D/ })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'evolution' }));
    await user.click(within(dialog).getByRole('button', { name: 'Item B' }));

    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Item B overview text/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Back to item A' }));

    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Item A overview text.')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Item B summary.')).toBeInTheDocument();
  });

  it('keeps indented markdown continuations inside their checklist and list items', () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=wrapped-list-item');

    renderExplorer();

    const dialog = screen.getByRole('dialog');

    expect(
      within(dialog).getByText(
        'Record the high-level entity, operation, relation, storage, and codegen inventory.',
      ),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        'Classify every graph API entry as an entity, relation, view, or compatibility alias.',
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Compare the semantic vocabulary.')).toBeInTheDocument();
    expect(within(dialog).getByText('Preserve the reflected metadata.')).toBeInTheDocument();
    expect(within(dialog).queryByText('inventory.')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('compatibility alias.')).not.toBeInTheDocument();
  });

  it('keeps completed history out of the board until it is requested', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const user = userEvent.setup();
    const value = {
      ...snapshot,
      nodes: [
        ...snapshot.nodes,
        createNode('completed-plan', {
          kind: 'plan',
          semanticId: 'completed-plan',
          shortTitle: 'Completed historical plan',
          statusGroup: 'done',
          markdown: 'Completed historical plan details.',
        }),
      ],
    };

    renderExplorer({ value });
    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(screen.queryByRole('button', { name: 'Completed historical plan' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show history' }));

    expect(screen.getByRole('button', { name: 'Completed historical plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide history' })).toBeInTheDocument();
  });

  it('shows direct and total descendant counts on collapsed branches', () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      edges: [
        {
          id: 'parent-item-to-item-a',
          from: 'parent-item',
          to: 'item-a',
          kind: 'contains',
        },
        {
          id: 'item-a-to-item-b',
          from: 'item-a',
          to: 'item-b',
          kind: 'contains',
        },
        {
          id: 'item-a-to-item-c',
          from: 'item-a',
          to: 'item-c',
          kind: 'contains',
        },
        {
          id: 'item-b-to-item-d',
          from: 'item-b',
          to: 'item-d',
          kind: 'contains',
        },
      ],
    };

    renderExplorer({ value });

    const toggle = screen.getByRole('button', {
      name: 'Expand branch: 2 direct children, 3 total descendants',
    });

    expect(toggle).toHaveTextContent('2 / 3');
    expect(toggle).toHaveAttribute('title', '2 direct children / 3 total descendants');
  });

  it('opens the search palette with Command-K and renders URI schemes as source badges', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const user = userEvent.setup();
    const federatedPlan = {
      ...createNode('federated-plan', {
        kind: 'plan',
        semanticId: 'bookops://plans/68-unified-application-architecture-surface',
        shortTitle: 'Unified Application Architecture Surface',
        markdown: 'Federated plan details.',
      }),
      path: undefined,
    };

    renderExplorer({ value: { ...snapshot, nodes: [...snapshot.nodes, federatedPlan] } });
    expect(screen.getByRole('button', { name: 'Open Atlas search' })).toHaveTextContent('Atlas');
    expect(screen.queryByRole('textbox', { name: 'Search atlas' })).not.toBeInTheDocument();

    fireEvent.keyDown(globalThis.window, { key: 'k', metaKey: true });

    const searchInput = screen.getByRole('textbox', { name: 'Search atlas' });
    expect(screen.getByRole('dialog', { name: 'Search Atlas' })).toBeInTheDocument();
    expect(searchInput).toHaveFocus();

    await user.type(searchInput, '68');

    const result = screen.getByTitle(
      'bookops://plans/68-unified-application-architecture-surface',
    );
    expect(within(result).getByText('68')).toBeInTheDocument();
    expect(within(result).getByText('bookops')).toBeInTheDocument();
    expect(within(result).queryByText('bookops://')).not.toBeInTheDocument();
    expect(
      within(result).getByText('plans/68-unified-application-architecture-surface'),
    ).toBeInTheDocument();
    expect(result).toHaveAttribute(
      'title',
      'bookops://plans/68-unified-application-architecture-surface',
    );

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Search Atlas' })).not.toBeInTheDocument();
  });

  it('renders explicit merged PR evidence as an attachment outside evolution stages', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=item-a');
    const user = userEvent.setup();
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      evidence: [
        {
          id: 'github:acme/product#42->item-a:shapes',
          kind: 'shapes',
          provenance: 'explicit',
          targetNodeId: 'item-a',
          pullRequest: {
            authorAvatarUrl: 'https://avatars.example/javi',
            authorLogin: 'javi',
            mergeCommitSha: 'abc123',
            mergedByAvatarUrl: 'https://avatars.example/maintainer',
            mergedByLogin: 'maintainer',
            mergedAt: '2026-09-01T10:00:00Z',
            number: 42,
            repositoryFullName: 'acme/product',
            title: 'Connect implementation evidence',
            url: 'https://github.com/acme/product/pull/42',
          },
        },
      ],
    };

    renderExplorer({ value });
    const dialog = screen.getByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'evolution' }));

    const implementationEvidence = within(dialog).getByRole('region', {
      name: 'Implementation evidence',
    });
    const pullRequest = within(implementationEvidence).getByRole('link', {
      name: /Connect implementation evidence/,
    });
    const pastColumn = within(dialog).getByRole('heading', { name: 'Past' }).closest('section');

    expect(within(implementationEvidence).getByText('1 merged PR')).toBeInTheDocument();
    expect(pastColumn).not.toBeNull();
    expect(
      within(pastColumn as HTMLElement).queryByRole('link', {
        name: /Connect implementation evidence/,
      }),
    ).not.toBeInTheDocument();
    expect(pullRequest).toHaveAttribute('href', 'https://github.com/acme/product/pull/42');
    expect(within(pullRequest).getByText('acme/product#42')).toBeInTheDocument();
    expect(within(pullRequest).getByText('shapes')).toBeInTheDocument();
    expect(within(pullRequest).queryByText(/by javi/)).not.toBeInTheDocument();
    expect(
      within(pullRequest).getByRole('img', { name: '@javi · PR author avatar' }),
    ).toHaveAttribute('src', 'https://avatars.example/javi');
    expect(
      within(pullRequest).getByRole('img', { name: '@maintainer · Merged PR avatar' }),
    ).toHaveAttribute('src', 'https://avatars.example/maintainer');
    expect(within(pullRequest).getByLabelText('Pull request actors')).toHaveClass('-space-x-2');
  });

});
