import { describe, it, expect, beforeEach } from 'vitest';
import { GREEN, YELLOW, GREY, patternFromString } from '../src/lib/core.mjs';
import { Game, MoveResult } from '../src/lib/game.mjs';
import { TEST_WORDS } from '../src/lib/wordlist.mjs';

let game;
beforeEach(() => {
  game = new Game({ answer: 'crane', wordList: TEST_WORDS });
});

describe('undoMove', () => {
  it('returns null when there are no guesses', () => {
    expect(game.undoMove()).toBeNull();
  });

  it('returns the removed guess', () => {
    game.makeMove('slate');
    const removed = game.undoMove();
    expect(removed.word).toBe('slate');
    expect(removed.pattern).toBeDefined();
  });

  it('decrements guesses.length by one', () => {
    game.makeMove('slate');
    game.makeMove('crane');
    game.undoMove();
    expect(game.guesses).toHaveLength(1);
  });

  it('restores constraints to before the undone move', () => {
    game.makeMove('slate');       // s,l,a,t,e now in constraints
    const beforeUndo = game.constraints.toKey();
    game.makeMove('crane');
    game.undoMove();
    expect(game.constraints.toKey()).toBe(beforeUndo);
  });

  it('constraints after undo no longer reflect the removed guess', () => {
    // After guessing 'crane' (the answer) all-green, constraints knows c at pos 0.
    game.makeMove('crane');
    expect(game.constraints.known[0]).toBe('c');
    game.undoMove();
    expect(game.constraints.known[0]).toBeNull();
  });

  it('sets solved to false after undoing the winning move', () => {
    game.makeMove('crane');
    expect(game.solved).toBe(true);
    game.undoMove();
    expect(game.solved).toBe(false);
  });

  it('game is playable again after undoing the winning move', () => {
    game.makeMove('crane');
    game.undoMove();
    const result = game.makeMove('slate');
    expect(result.error).toBe(MoveResult.OK);
  });

  it('multiple consecutive undos restore earlier states', () => {
    const empty = game.constraints.toKey();
    game.makeMove('slate');
    const afterSlate = game.constraints.toKey();
    game.makeMove('crane');
    game.undoMove();
    expect(game.constraints.toKey()).toBe(afterSlate);
    game.undoMove();
    expect(game.constraints.toKey()).toBe(empty);
    expect(game.guesses).toHaveLength(0);
  });

  it('calling undoMove more times than guesses eventually returns null', () => {
    game.makeMove('slate');
    game.undoMove();
    expect(game.undoMove()).toBeNull();
  });

  it('works in external mode', () => {
    const ext = new Game({ wordList: TEST_WORDS });
    ext.makeMove('slate', patternFromString('_____'));
    ext.undoMove();
    expect(ext.guesses).toHaveLength(0);
    expect(ext.constraints.toKey()).toBe(new Game({ wordList: TEST_WORDS }).constraints.toKey());
  });
});
