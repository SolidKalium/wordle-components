import {
  GREEN, WORD_LENGTH, MAX_GUESSES, ALL_GREEN_STR,
  computePattern, patternToString,
} from './core.mjs';
import { ConstraintState } from './constraints.mjs';

/**
 * Move validation result codes.
 *
 * String values rather than numeric so they are human-readable in logs
 * and straightforwardly translatable.
 */
export const MoveResult = Object.freeze({
  OK: 'OK',
  WRONG_LENGTH: 'WRONG_LENGTH',
  NOT_IN_LIST: 'NOT_IN_LIST',
  GAME_OVER: 'GAME_OVER',
  /** Hard mode: a known (green) letter was not kept in its position. */
  HARD_MODE_KNOWN: 'HARD_MODE_KNOWN',
  /** Hard mode: a revealed (yellow) letter was not included. */
  HARD_MODE_REQUIRED: 'HARD_MODE_REQUIRED',
});

/**
 * A single Wordle game.
 *
 * Two construction modes:
 *   - **Answer-known**: pass `answer` and the game scores guesses itself.
 *   - **External**: omit `answer`; caller must supply the pattern with each move.
 *
 * @example
 *   // Answer-known
 *   const g = new Game({ answer: 'crane', wordList });
 *   g.makeMove('slate');   // → { ok: true, pattern: [...] }
 *
 *   // External (e.g. human scoring)
 *   const g = new Game({ wordList });
 *   g.makeMove('slate', patternFromString('_Y__G'));
 */
export class Game {
  /**
   * @param {object}   opts
   * @param {string}   [opts.answer]    - Omit for external mode.
   * @param {string[]} opts.wordList    - Valid words for this game.
   * @param {boolean}  [opts.hardMode]  - Enforce hard-mode constraints on guesses.
   * @param {number}   [opts.maxGuesses] - Override default 6.
   */
  constructor({ answer = null, wordList, hardMode = false, maxGuesses = MAX_GUESSES }) {
    /** @type {string|null} */
    this.answer = answer?.toLowerCase() ?? null;

    /** @type {string[]} */
    this.wordList = wordList;

    /** @type {boolean} */
    this.hardMode = hardMode;

    /** @type {number} */
    this.maxGuesses = maxGuesses;

    /**
     * History of moves made.
     * @type {{ word: string, pattern: string[] }[]}
     */
    this.guesses = [];

    /** @type {ConstraintState} */
    this.constraints = new ConstraintState();

    /** @type {boolean} */
    this.solved = false;
  }

  /** Whether the game is over (solved or out of guesses). */
  get isOver() {
    return this.solved || this.guesses.length >= this.maxGuesses;
  }

  /** 'known' if the answer was provided; 'external' otherwise. */
  get mode() {
    return this.answer !== null ? 'known' : 'external';
  }

  /** Number of guesses remaining. */
  get remaining() {
    return this.maxGuesses - this.guesses.length;
  }

  /**
   * Validate a prospective guess without committing it.
   *
   * @param {string} word
   * @returns {{ valid: boolean, error: string, detail?: string }}
   */
  checkMove(word) {
    word = word.toLowerCase();

    if (this.isOver) {
      return { valid: false, error: MoveResult.GAME_OVER };
    }
    if (word.length !== WORD_LENGTH) {
      return { valid: false, error: MoveResult.WRONG_LENGTH };
    }
    if (!this.wordList.includes(word)) {
      return { valid: false, error: MoveResult.NOT_IN_LIST };
    }

    if (this.hardMode) {
      const hardCheck = this._checkHardMode(word);
      if (hardCheck) return hardCheck;
    }

    return { valid: true, error: MoveResult.OK };
  }

  /**
   * Play a guess.
   *
   * In answer-known mode, the pattern is computed automatically.
   * In external mode, `pattern` must be provided.
   *
   * @param {string}    word
   * @param {string[]}  [pattern] - Required in external mode; ignored in known mode.
   * @returns {{ valid: boolean, error: string, pattern?: string[], detail?: string }}
   */
  makeMove(word, pattern = null) {
    word = word.toLowerCase();

    const check = this.checkMove(word);
    if (!check.valid) return check;

    if (this.mode === 'known') {
      pattern = computePattern(word, this.answer);
    } else {
      if (!pattern) {
        throw new Error('External mode requires a pattern argument');
      }
    }

    this.guesses.push({ word, pattern });
    this.constraints.update(word, pattern);

    if (patternToString(pattern) === ALL_GREEN_STR) {
      this.solved = true;
    }

    return { valid: true, error: MoveResult.OK, pattern };
  }

  /**
   * Check hard-mode constraints against current knowledge.
   *
   * Hard mode requires:
   *   1. Every known (green) letter stays in its confirmed position.
   *   2. Every revealed letter (with minCount > 0) appears at least that many times.
   *
   * It does NOT enforce exclusions or max counts — those are strategic, not rules.
   *
   * @private
   */
  _checkHardMode(word) {
    // 1. Known positions must be honored.
    for (let i = 0; i < WORD_LENGTH; i++) {
      const k = this.constraints.known[i];
      if (k !== null && word[i] !== k) {
        return {
          valid: false,
          error: MoveResult.HARD_MODE_KNOWN,
          detail: `Position ${i + 1} must be '${k}'`,
        };
      }
    }

    // 2. Minimum letter counts must be met.
    const counts = new Map();
    for (const ch of word) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }

    for (const [letter, min] of this.constraints.minCounts) {
      if (min > 0 && (counts.get(letter) ?? 0) < min) {
        return {
          valid: false,
          error: MoveResult.HARD_MODE_REQUIRED,
          detail: `Guess must include '${letter}' (at least ${min})`,
        };
      }
    }

    return null; // passes
  }
}
