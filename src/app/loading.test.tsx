import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import Loading from './loading';

describe('Atlas loading screen', () => {
  it('keeps the brand name and product language outside the image assets', () => {
    const { container } = render(<Loading />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
    expect(
      screen.getByText('Shape systems. Navigate structure. Track evolution.'),
    ).toBeInTheDocument();

    const images = [...container.querySelectorAll('img')];
    expect(images).toHaveLength(2);
    expect(images.map(image => image.getAttribute('src'))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('atlas-mark-light.png'),
        expect.stringContaining('atlas-mark-dark-transparent.png'),
      ]),
    );
    expect(images.every(image => image.getAttribute('alt') === '')).toBe(true);
  });
});
