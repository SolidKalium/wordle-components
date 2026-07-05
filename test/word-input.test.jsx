// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameStoreContext, createGameStore } from '../src/ui/html/stores/gameStore.js';
import { WordInput } from '../src/ui/html/components/WordInput.jsx';
import { KeyboardDockProvider } from '../src/ui/html/components/KeyboardDockContext.jsx';
import { Card } from '../src/ui/html/components/Card.jsx';
import { ConstraintEditor } from '../src/ui/html/components/ConstraintEditor.jsx';
import { ConstraintStoreContext, createConstraintStore } from '../src/ui/html/stores/constraintStore.js';

afterEach(cleanup);

describe('WordInput virtual keyboard', () => {
  it('can be disabled independently from word entry', () => {
    const store = createGameStore({ wordList: ['cigar'], answers: ['cigar'], answer: 'cigar' });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider><WordInput showKeyboard={false} /></KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    expect(screen.queryByRole('group', { name: 'Word entry keyboard' })).toBeNull();
    expect(screen.getByText(/click a tile to move/)).toBeTruthy();
    const inputs = screen.getAllByRole('textbox');
    expect(inputs).toHaveLength(5);
    expect(inputs.every(input => !input.readOnly && input.inputMode === 'text')).toBe(true);

    fireEvent.change(inputs[0], { target: { value: 'C' } });
    expect(inputs[0].value).toBe('C');
    expect(document.activeElement).toBe(inputs[1]);
  });

  it('edits and submits the same draft shown by the input tiles', async () => {
    const user = userEvent.setup();
    const store = createGameStore({
      wordList: ['crane', 'cigar'],
      answers: ['cigar'],
      answer: 'cigar',
    });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider>
          <WordInput />
        </KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    expect(screen.getAllByRole('textbox').every(input => input.readOnly && input.inputMode === 'none')).toBe(true);

    for (const letter of 'crane') {
      await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    }
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(store.getState().guesses).toHaveLength(1);
    expect(store.getState().guesses[0].word).toBe('crane');
  });

  it('moves the cursor to a selected tile', async () => {
    const user = userEvent.setup();
    const store = createGameStore({ wordList: ['crane', 'brane'], answers: ['brane'], answer: 'brane' });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider><WordInput /></KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    for (const letter of 'crane') {
      await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    }
    await user.click(screen.getByRole('textbox', { name: 'Guess letter 1' }));
    await user.click(screen.getByRole('button', { name: 'B' }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(store.getState().guesses[0].word).toBe('brane');
  });

  it('keeps DOM focus and the visual cursor together across repeated Backspace', async () => {
    const user = userEvent.setup();
    const store = createGameStore({ wordList: ['crane'], answers: ['crane'], answer: 'crane' });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider><WordInput /></KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    for (const letter of 'crane') {
      await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    }
    const inputs = screen.getAllByRole('textbox');

    fireEvent.keyDown(inputs[4], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[4]);
    expect(inputs[4].value).toBe('');

    fireEvent.keyDown(inputs[4], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[3]);
    expect(inputs[3].value).toBe('');

    fireEvent.keyDown(inputs[3], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[2]);
    expect(inputs[2].value).toBe('');

    fireEvent.keyDown(inputs[2], { key: 'ArrowRight' });
    expect(document.activeElement).toBe(inputs[3]);
  });

  it('pastes consecutive letters into word-entry cells', () => {
    const store = createGameStore({ wordList: ['crane'], answers: ['crane'], answer: 'crane' });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider><WordInput /></KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    const inputs = screen.getAllByRole('textbox');
    fireEvent.paste(inputs[0], { clipboardData: { getData: () => 'Crane!' } });

    expect(inputs.map(input => input.value).join('')).toBe('CRANE');
    expect(document.activeElement).toBe(inputs[4]);
  });

  it('pastes consecutive letters into ConstraintEditor Known cells', () => {
    const store = createConstraintStore();

    render(
      <ConstraintStoreContext.Provider value={store}>
        <ConstraintEditor defaultShowSuggestions={false} />
      </ConstraintStoreContext.Provider>,
    );

    fireEvent.paste(screen.getByRole('textbox', { name: 'Known position 2' }), {
      clipboardData: { getData: () => 'R-A-N-E' },
    });

    expect(store.getState().green).toEqual([null, 'r', 'a', 'n', 'e']);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Known position 5' }));
  });

  it('transfers the dock and restores a retained preference after collapse or hide', async () => {
    const user = userEvent.setup();
    const store = createGameStore({ wordList: ['cigar'], answers: ['cigar'], answer: 'cigar' });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider>
          <Card title="First" collapsible><WordInput /></Card>
          <Card title="Second" collapsible><WordInput /></Card>
        </KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    const [firstPin, secondPin] = screen.getAllByRole('button', { name: 'Pin keyboard', hidden: true });
    fireEvent.click(firstPin);
    expect(screen.getAllByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toHaveLength(1);

    fireEvent.click(secondPin);
    expect(screen.getAllByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Unpin keyboard', hidden: true })).toHaveLength(1);

    await user.click(screen.getByText('Second'));
    expect(screen.queryByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Unpin keyboard', hidden: true })).toHaveLength(1);

    await user.click(screen.getByText('Second'));
    expect(screen.getAllByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toHaveLength(1);

    const [, secondHide] = screen.getAllByRole('button', { name: 'Hide keyboard', hidden: true });
    fireEvent.click(secondHide);
    expect(screen.queryByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show keyboard', hidden: true }));
    expect(screen.getAllByRole('button', { name: 'Unpin docked keyboard', hidden: true })).toHaveLength(1);
  });

  it('clears a tentative word when another control commits a move', async () => {
    const user = userEvent.setup();
    const store = createGameStore({
      wordList: ['crane', 'cigar'],
      answers: ['cigar'],
      answer: 'cigar',
    });

    render(
      <GameStoreContext.Provider value={store}>
        <KeyboardDockProvider><WordInput /></KeyboardDockProvider>
      </GameStoreContext.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'C' }));
    act(() => store.getState().makeMove('crane'));

    for (const letter of 'cigar') {
      await user.click(screen.getByRole('button', { name: letter.toUpperCase() }));
    }
    await user.click(screen.getByRole('button', { name: 'Enter' }));

    expect(store.getState().guesses.map(guess => guess.word)).toEqual(['crane', 'cigar']);
  });
});
