import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlanWorkstreamNode } from '@/atlas/model/snapshot';
import { PlanTitle } from '@/atlas/viewer/plan-title';

const node = (overrides: Partial<PlanWorkstreamNode> = {}): PlanWorkstreamNode => ({
  id: 'plan:atlas://plans/125-example',
  kind: 'plan',
  title: '125. Example',
  shortTitle: 'Example',
  statusGroup: 'done',
  status: 'done',
  territory: 'Atlas',
  sections: [],
  relatedCount: 0,
  candidateCount: 0,
  ...overrides,
});

describe('PlanTitle', () => {
  it('renders a source-qualified filename-derived Plan ID separately from its title', () => {
    render(<PlanTitle node={node({ planKey: '125a' })} />);

    expect(screen.getByLabelText('Plan ATL-125A')).toHaveTextContent('ATL-125A');
    expect(screen.getByText('Example')).toBeInTheDocument();
  });

  it('uses stable prefixes to disambiguate federated repositories', () => {
    const { rerender } = render(
      <PlanTitle node={node({ path: 'bookops://plans/101-example', planKey: '101' })} />,
    );
    expect(screen.getByLabelText('Plan BOK-101')).toBeInTheDocument();

    rerender(<PlanTitle node={node({ sourceId: 'ontahi', planKey: '101' })} />);
    expect(screen.getByLabelText('Plan ONT-101')).toBeInTheDocument();
  });

  it('does not decorate non-Plan nodes or legacy Plans without a numeric key', () => {
    const { rerender } = render(<PlanTitle node={node({ planKey: 'example' })} />);
    expect(screen.queryByLabelText(/Plan /)).not.toBeInTheDocument();

    rerender(<PlanTitle node={node({ kind: 'model', planKey: '125' })} />);
    expect(screen.queryByLabelText(/Plan /)).not.toBeInTheDocument();
  });
});
