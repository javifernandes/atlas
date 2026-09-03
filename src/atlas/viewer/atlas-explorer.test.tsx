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
    const detailTitle = within(dialog).getByRole('heading', { name: 'Item A' });
    const titleRow = detailTitle.parentElement;

    expect(titleRow).not.toBeNull();
    expect(
      within(titleRow as HTMLElement).getByRole('navigation', { name: 'Detail sections' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('Item A overview text.')).toBeInTheDocument();

    const evolutionLink = within(dialog).getByRole('link', { name: 'evolution' });
    expect(evolutionLink).toHaveAttribute(
      'href',
      '/internal/plans?full=item-a&section=evolution',
    );

    await user.click(evolutionLink);
    expect(globalThis.location.search).toBe('?full=item-a&section=evolution');
    expect(within(dialog).queryByText('Item A overview text.')).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Item C' })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Item D' })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'context' }));
    expect(globalThis.location.search).toBe('?full=item-a&section=context');
    expect(within(dialog).getAllByRole('button', { name: 'Parent Item' })).toHaveLength(1);
    expect(
      within(dialog).queryByRole('button', { name: /contained by\s*Parent Item/ }),
    ).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /supports\s*Item C/ })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /related\s*Item D/ })).toBeInTheDocument();

    await user.click(within(dialog).getByRole('link', { name: 'evolution' }));
    await user.click(within(dialog).getByRole('button', { name: 'Item B' }));

    dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Item B overview text/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Back to item A' }));

    dialog = screen.getByRole('dialog');
    expect(within(dialog).queryByText('Item A overview text.')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Item B summary.')).toBeInTheDocument();
    expect(new URLSearchParams(globalThis.location.search).get('full')).toBe('item-a');
    expect(new URLSearchParams(globalThis.location.search).get('section')).toBe('evolution');
  });

  it('opens a directly linked full-detail section', () => {
    globalThis.history.replaceState(
      {},
      '',
      '/internal/plans?full=item-a&section=context',
    );

    renderExplorer();

    const dialog = screen.getByRole('dialog');
    const contextLink = within(dialog).getByRole('link', { name: 'context' });

    expect(contextLink).toHaveAttribute('aria-current', 'page');
    expect(within(dialog).queryByText('Item A overview text.')).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: /supports\s*Item C/ })).toBeInTheDocument();
  });

  it('shows every project membership in full detail when Atlas has multiple projects', () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=item-b');
    const ontahiProject = createNode('ontahi-project', {
      kind: 'project',
      semanticId: 'ontahi',
      shortTitle: 'Ontahi',
      markdown: 'Ontahi project.',
    });
    const bookOpsProject = createNode('bookops-project', {
      kind: 'project',
      semanticId: 'bookops',
      shortTitle: 'BookOps',
      markdown: 'BookOps project.',
    });
    const bookOpsArea = createNode('bookops-area', {
      semanticId: 'bookops.area',
      shortTitle: 'BookOps Area',
      markdown: 'BookOps area.',
    });
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      nodes: [...snapshot.nodes, ontahiProject, bookOpsProject, bookOpsArea],
      edges: [
        ...snapshot.edges,
        {
          id: 'ontahi-project-to-parent-item',
          from: ontahiProject.id,
          to: 'parent-item',
          kind: 'contains',
        },
        {
          id: 'bookops-project-to-area',
          from: bookOpsProject.id,
          to: bookOpsArea.id,
          kind: 'contains',
        },
        {
          id: 'bookops-area-to-item-b',
          from: bookOpsArea.id,
          to: 'item-b',
          kind: 'shaped-by',
        },
      ],
    };

    renderExplorer({ value });

    const dialog = screen.getByRole('dialog');

    expect(within(dialog).getByLabelText('Project: Ontahi')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Project: BookOps')).toBeInTheDocument();
  });

  it('omits redundant project badges when Atlas has only one project', () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=item-a');
    const ontahiProject = createNode('ontahi-project', {
      kind: 'project',
      semanticId: 'ontahi',
      shortTitle: 'Ontahi',
      markdown: 'Ontahi project.',
    });
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      nodes: [...snapshot.nodes, ontahiProject],
      edges: [
        ...snapshot.edges,
        {
          id: 'ontahi-project-to-parent-item',
          from: ontahiProject.id,
          to: 'parent-item',
          kind: 'contains',
        },
      ],
    };

    renderExplorer({ value });

    expect(
      within(screen.getByRole('dialog')).queryByLabelText('Project: Ontahi'),
    ).not.toBeInTheDocument();
  });

  it('navigates to the parent and direct children inside the same modal', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans?full=item-a');
    const user = userEvent.setup();
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      nodes: snapshot.nodes.map(node =>
        node.id === 'item-a'
          ? {
              ...node,
              markdown: `Item A overview text.

## Child Items

- [[item-c|Item C]]`,
            }
          : node,
      ),
      edges: [
        ...snapshot.edges,
        {
          id: 'item-a-contains-item-c',
          from: 'item-a',
          to: 'item-c',
          kind: 'contains',
        },
      ],
    };

    renderExplorer({ value });

    const dialog = screen.getByRole('dialog');
    const parentLink = within(dialog).getByRole('link', {
      name: 'Parent node: Parent Item',
    });
    const childNavigation = within(dialog).getByRole('navigation', { name: 'Child nodes' });
    const childLink = within(childNavigation).getByRole('link', {
      name: 'Child node: Item C',
    });

    expect(within(dialog).queryByRole('heading', { name: 'Child Items' })).not.toBeInTheDocument();
    expect(
      new URL(parentLink.getAttribute('href') ?? '', 'http://atlas.local').searchParams.get('full'),
    ).toBe('parent-item');
    expect(
      new URL(childLink.getAttribute('href') ?? '', 'http://atlas.local').searchParams.get('full'),
    ).toBe('item-c');

    await user.click(childLink);

    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByRole('heading', { name: 'Item C' })).toBeInTheDocument();
    expect(within(dialog).queryByRole('button', { name: 'Back to Item A' })).not.toBeInTheDocument();

    await user.click(
      within(dialog).getByRole('link', {
        name: 'Parent node: Item A',
      }),
    );

    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(within(dialog).getByRole('heading', { name: 'Item A' })).toBeInTheDocument();
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

  it('keeps the board plan-only while filtering plans to one project', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const user = userEvent.setup();
    const ontahiProject = createNode('ontahi-project', {
      kind: 'project',
      semanticId: 'ontahi',
      shortTitle: 'Ontahi',
      markdown: 'Ontahi project.',
    });
    const ontahiWork = createNode('ontahi-work', {
      semanticId: 'ontahi.work',
      shortTitle: 'Continue Ontahi',
      markdown: 'Ontahi work.',
    });
    const ontahiPlan = createNode('ontahi-plan', {
      kind: 'plan',
      semanticId: 'ontahi-plan',
      shortTitle: 'Ontahi next plan',
      statusGroup: 'next',
      markdown: 'Ontahi plan.',
    });
    const bookOpsProject = createNode('bookops-project', {
      kind: 'project',
      semanticId: 'bookops',
      shortTitle: 'BookOps',
      markdown: 'BookOps project.',
    });
    const bookOpsWork = createNode('bookops-work', {
      semanticId: 'bookops.work',
      shortTitle: 'Continue BookOps',
      markdown: 'BookOps work.',
    });
    const bookOpsPlan = createNode('bookops-plan', {
      kind: 'plan',
      semanticId: 'bookops-plan',
      shortTitle: 'BookOps next plan',
      statusGroup: 'next',
      markdown: 'BookOps plan.',
    });
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      nodes: [
        ...snapshot.nodes,
        ontahiProject,
        ontahiWork,
        ontahiPlan,
        bookOpsProject,
        bookOpsWork,
        bookOpsPlan,
      ],
      edges: [
        ...snapshot.edges,
        {
          id: 'ontahi-project-to-work',
          from: ontahiProject.id,
          to: ontahiWork.id,
          kind: 'contains',
        },
        {
          id: 'ontahi-work-to-plan',
          from: ontahiWork.id,
          to: ontahiPlan.id,
          kind: 'shaped-by',
        },
        {
          id: 'bookops-project-to-work',
          from: bookOpsProject.id,
          to: bookOpsWork.id,
          kind: 'contains',
        },
        {
          id: 'bookops-work-to-plan',
          from: bookOpsWork.id,
          to: bookOpsPlan.id,
          kind: 'shaped-by',
        },
      ],
    };

    renderExplorer({ value });
    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(screen.getByRole('button', { name: 'Ontahi next plan' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'BookOps next plan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue Ontahi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue BookOps' })).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter board by project' }),
      ontahiProject.id,
    );

    expect(screen.getByRole('button', { name: 'Ontahi next plan' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'BookOps next plan' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Item A' })).not.toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Filter board by project' }),
      '',
    );

    expect(screen.getByRole('button', { name: 'BookOps next plan' })).toBeInTheDocument();
  });

  it('returns to the map when Board search selects a structural item', async () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const user = userEvent.setup();

    renderExplorer();
    await user.click(screen.getByRole('button', { name: 'Board' }));

    expect(screen.queryByRole('button', { name: 'Item A' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open Atlas search' }));
    const searchDialog = screen.getByRole('dialog', { name: 'Search Atlas' });

    await user.type(within(searchDialog).getByRole('textbox', { name: 'Search atlas' }), 'Item A');
    await user.click(within(searchDialog).getByRole('button', { name: /Item A/ }));

    expect(screen.getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
    expect(
      screen.queryByRole('combobox', { name: 'Filter board by project' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Item A' })).toBeInTheDocument();
  });

  it('renders Plans as visually distinct temporal nodes in the Map', () => {
    globalThis.history.replaceState({}, '', '/internal/plans');
    const plan = createNode('map-plan', {
      kind: 'plan',
      semanticId: 'map-plan',
      shortTitle: 'Map Plan',
      markdown: 'Map plan details.',
    });
    const root = createNode('root:planning', {
      kind: 'root',
      semanticId: 'root',
      shortTitle: 'Atlas',
      markdown: 'Atlas root.',
    });
    const value: PlanWorkstreamSnapshot = {
      ...snapshot,
      nodes: [root, plan],
      edges: [
        {
          id: 'root-to-plan',
          from: root.id,
          to: plan.id,
          kind: 'contains',
        },
      ],
    };

    renderExplorer({ value });

    expect(screen.getByRole('button', { name: 'Map Plan' })).toHaveClass('border-dashed');
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
    const mergedAt = new Date(Date.now() - 3 * 60 * 60 * 1_000).toISOString();
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
            mergedAt,
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

    await user.click(within(dialog).getByRole('link', { name: 'evolution' }));

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
    expect(within(pullRequest).getByText('#42')).toBeInTheDocument();
    expect(within(pullRequest).getByText('3h ago')).toHaveAttribute('title');
    expect(within(pullRequest).queryByText('acme/product')).not.toBeInTheDocument();
    expect(within(pullRequest).queryByText('shapes')).not.toBeInTheDocument();
    expect(within(pullRequest).queryByText(/explicit PR assertion/)).not.toBeInTheDocument();
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
