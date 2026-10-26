// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { ConstraintEditor } from '../src/ui/html/components/ConstraintEditor.jsx';
import { ConstraintStoreContext, createConstraintStore } from '../src/ui/html/stores/constraintStore.js';

afterEach(cleanup);

function renderEditor(setup) {
  const store = createConstraintStore();
  act(() => setup(store.getState()));
  render(
    <ConstraintStoreContext.Provider value={store}>
      <ConstraintEditor defaultShowSuggestions={false} />
    </ConstraintStoreContext.Provider>,
  );
}

const warnings = () => [...document.querySelectorAll('p')].map(p => p.textContent);

describe('ConstraintEditor warnings', () => {
  it('warns when a letter has more unplaced copies than a word allows', () => {
    renderEditor(s => s.setUnplaced([...'aaa']));
    expect(warnings().some(w => /has 3 unplaced copies/.test(w))).toBe(true);
  });

  it('allows two unplaced copies of a letter', () => {
    renderEditor(s => s.setUnplaced([...'aa']));
    expect(warnings().some(w => /unplaced copies —/.test(w))).toBe(false);
  });

  it('warns when a gray letter with unplaced copies lacks enough not-at positions', () => {
    renderEditor(s => {
      s.setUnplaced(['e']);
      s.setGray(['e']);
      s.setYellow(2, ['e']);
    });
    expect(warnings().some(w => /E has exactly 1 unplaced copy. We should know 2 places it's not at, but only 1 is ruled out./.test(w))).toBe(true);
  });

  it('warns when an unplaced letter lacks a not-at position for each copy', () => {
    renderEditor(s => s.setUnplaced([...'ee']));
    expect(warnings().some(w => /E has at least 2 unplaced copies\. We should know 2 places it's not at, but none are ruled out\./.test(w))).toBe(true);
  });

  it('accepts one not-at position per unplaced copy for a non-gray letter', () => {
    renderEditor(s => {
      s.setUnplaced(['e']);
      s.setYellow(2, ['e']);
    });
    expect(warnings().some(w => /unplaced copy\. We should know/.test(w))).toBe(false);
  });

  it('counts positions known to be a different letter toward the gray requirement', () => {
    renderEditor(s => {
      s.setUnplaced(['e']);
      s.setGray(['e']);
      s.setYellow(2, ['e']);
      s.setGreen(0, 's');
    });
    expect(warnings().some(w => /has exactly 1 unplaced/.test(w))).toBe(false);
  });

  it('does not count positions known to be the same letter', () => {
    renderEditor(s => {
      s.setUnplaced(['e']);
      s.setGray(['e']);
      s.setYellow(2, ['e']);
      s.setGreen(0, 'e');
    });
    expect(warnings().some(w => /E has exactly 1 unplaced copy/.test(w))).toBe(true);
  });
});
