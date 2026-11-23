import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ScrollableOverflow } from '@/components/scrollable-overflow';

const rect = (top: number, bottom: number) => ({
  bottom,
  height: bottom - top,
  left: 0,
  right: 100,
  toJSON: () => ({}),
  top,
  width: 100,
  x: 0,
  y: top,
});

describe('ScrollableOverflow', () => {
  it('reports how many vertical items remain beyond each viewport edge', () => {
    render(
      <ScrollableOverflow axis='vertical' viewportProps={{ 'aria-label': 'Results' }}>
        <div>One</div>
        <div>Two</div>
        <div>Three</div>
      </ScrollableOverflow>,
    );
    const viewport = screen.getByLabelText('Results');
    const items = [...(viewport.firstElementChild?.children ?? [])] as HTMLElement[];

    viewport.getBoundingClientRect = () => rect(0, 100) as DOMRect;
    items[0]!.getBoundingClientRect = () => rect(-20, 20) as DOMRect;
    items[1]!.getBoundingClientRect = () => rect(20, 70) as DOMRect;
    items[2]!.getBoundingClientRect = () => rect(70, 130) as DOMRect;
    fireEvent.scroll(viewport);

    expect(screen.getByLabelText('1 more above')).toHaveTextContent('1 more');
    expect(screen.getByLabelText('1 more below')).toHaveTextContent('1 more');
  });

  it('counts nested rows selected by the consumer', () => {
    render(
      <ScrollableOverflow
        axis='vertical'
        itemSelector='[data-row]'
        viewportProps={{ 'aria-label': 'Nested results' }}
      >
        <div>
          <div data-row>One</div>
          <div data-row>Two</div>
          <div data-row>Three</div>
        </div>
      </ScrollableOverflow>,
    );
    const viewport = screen.getByLabelText('Nested results');
    const items = [...viewport.querySelectorAll<HTMLElement>('[data-row]')];

    viewport.getBoundingClientRect = () => rect(0, 100) as DOMRect;
    items[0]!.getBoundingClientRect = () => rect(0, 40) as DOMRect;
    items[1]!.getBoundingClientRect = () => rect(40, 90) as DOMRect;
    items[2]!.getBoundingClientRect = () => rect(90, 140) as DOMRect;
    fireEvent.scroll(viewport);

    expect(screen.getByLabelText('1 more below')).toHaveTextContent('1 more');
  });
});
