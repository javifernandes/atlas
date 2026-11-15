import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Loading from './loading';

describe('Atlas loading screen', () => {
  it('keeps the brand language and uses the mark itself as the loading motion', () => {
    const { container } = render(<Loading />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(screen.getByText('Shape systems')).toBeInTheDocument();
    expect(screen.getByText('Navigate structure')).toBeInTheDocument();
    expect(screen.getByText('Track evolution')).toBeInTheDocument();

    expect(container.querySelector('.atlas-loading-mark')).toBeInTheDocument();
    expect(container.querySelectorAll('.atlas-loading-stroke')).toHaveLength(7);
    expect(container.querySelector('.atlas-loading-core')).toBeInTheDocument();
    expect(container.querySelectorAll('.atlas-loading-message')).toHaveLength(3);
    expect(container.querySelectorAll('[pathLength="1"]')).toHaveLength(7);
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
