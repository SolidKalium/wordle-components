// @vitest-environment jsdom

import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BruteForceList, createScrollMetrics } from '../src/ui/html/components/BruteForceList.jsx';
import { ConstraintStoreContext, createConstraintStore } from '../src/ui/html/stores/constraintStore.js';

afterEach(cleanup);

it('shows zzzzz when the blank list scrollbar is dragged to the bottom', async () => {
  const store = createConstraintStore();
  render(
    <ConstraintStoreContext.Provider value={store}>
      <BruteForceList wordsPerLine={5} />
    </ConstraintStoreContext.Provider>,
  );

  const scroller = await screen.findByRole('region', { name: 'Generated letter combinations' });
  const metrics = createScrollMetrics(Math.ceil(26 ** 5 / 5));
  scroller.scrollTop = metrics.physicalMax;
  fireEvent.scroll(scroller);

  expect(scroller.getAttribute('aria-busy')).toBe('true');
  expect(screen.getByRole('status').textContent).toBe('Loading rows');
  expect(screen.getByText('zzzyg')).toBeTruthy();
  await waitFor(() => expect(screen.getByText('zzzzz')).toBeTruthy());
  expect(scroller.getAttribute('aria-busy')).toBe('false');
});

it('supports row, page, modifier, and boundary keyboard scrolling', async () => {
  const store = createConstraintStore();
  render(
    <ConstraintStoreContext.Provider value={store}>
      <BruteForceList wordsPerLine={5} />
    </ConstraintStoreContext.Provider>,
  );

  const scroller = await screen.findByRole('region', { name: 'Generated letter combinations' });
  const metrics = createScrollMetrics(Math.ceil(26 ** 5 / 5));

  fireEvent.keyDown(scroller, { key: 'ArrowDown' });
  expect(scroller.scrollTop * metrics.scale).toBeCloseTo(24, 5);

  scroller.scrollTop = 0;
  fireEvent.keyDown(scroller, { key: 'ArrowDown', altKey: true });
  expect(scroller.scrollTop * metrics.scale).toBeCloseTo(196, 5);

  scroller.scrollTop = 0;
  fireEvent.keyDown(scroller, { key: 'ArrowDown', shiftKey: true });
  expect(scroller.scrollTop * metrics.scale).toBeCloseTo(196, 5);

  scroller.scrollTop = 0;
  fireEvent.keyDown(scroller, { key: 'PageDown' });
  expect(scroller.scrollTop * metrics.scale).toBeCloseTo(220, 5);

  fireEvent.keyDown(scroller, { key: 'ArrowDown', metaKey: true });
  expect(scroller.scrollTop).toBeCloseTo(metrics.physicalMax, 5);

  fireEvent.keyDown(scroller, { key: 'ArrowUp', metaKey: true });
  expect(scroller.scrollTop).toBe(0);
});
