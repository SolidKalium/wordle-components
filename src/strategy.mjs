/**
 * Base class for Wordle-solving strategies.
 *
 * Subclasses implement `chooseGuess`, receiving the current game state
 * and the remaining valid words. The game state provides access to the
 * full guess history and constraint state if the strategy wants them.
 *
 * Strategies are stateful per-game: a fresh instance is created for each
 * simulation run, so strategies may accumulate internal state across turns.
 */
export class Strategy {
  /** Human-readable name for display and logging. */
  get name() {
    return this.constructor.name;
  }

  /**
   * Choose the next guess.
   *
   * @param {import('./game.mjs').Game} game - Current game state (read-only use recommended).
   * @param {string[]} remainingWords - Words consistent with all constraints so far.
   * @returns {string} The chosen guess.
   */
  chooseGuess(game, remainingWords) {
    throw new Error(`${this.name}.chooseGuess() not implemented`);
  }
}

/**
 * Picks a random word from the remaining valid set.
 * Not a good strategy, but a useful baseline and smoke test.
 */
export class RandomStrategy extends Strategy {
  chooseGuess(_game, remainingWords) {
    const idx = Math.floor(Math.random() * remainingWords.length);
    return remainingWords[idx];
  }
}

/**
 * Always guesses the first word in the remaining list (alphabetically
 * if the list is sorted). Deterministic, so useful for reproducible tests.
 */
export class FirstWordStrategy extends Strategy {
  chooseGuess(_game, remainingWords) {
    return remainingWords[0];
  }
}
