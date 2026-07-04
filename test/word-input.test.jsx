// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameStoreContext, createGameStore } from '../src/ui/html/stores/gameStore.js';
import { WordInput } from '../src/ui/html/components/WordInput.jsx';

afterEach(cleanup);

describe('WordInput virtual keyboard', () => {
  it('edits and submits the same draft shown by the input tiles', async () => {
    const user = userEvent.setup();
    const store = createGameStore({
      wordList: ['crane', 'cigar'],
      answers: ['cigar'],
      answer: 'cigar',
    });

    render(
      <GameStoreContext.Provider value={store}>
        <WordInput />
      </GameStoreContext.Provider>,
    );

    for (const letter of 'crane') {
      await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    }
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(store.getState().guesses).toHaveLength(1);
    expect(store.getState().guesses[0].word).toBe('crane');
  });
});
