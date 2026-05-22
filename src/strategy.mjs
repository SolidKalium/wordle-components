import { partitionByGuess } from './core.mjs';

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
  chooseGuess(_game, candidates) {
    const idx = Math.floor(Math.random() * candidates.length);
    return candidates[idx];
  }
}

/**
 * Always guesses the first word in the remaining list (alphabetically
 * if the list is sorted). Deterministic, so useful for reproducible tests.
 */
export class FirstWordStrategy extends Strategy {
  chooseGuess(_game, candidates) {
    return candidates[0];
  }
}

/**
 * Decorate another strategy to make it consider a constrained set of words.
 */
class FilteredStrategy extends Strategy {
  constructor(baseStrategy, filters = []) {
    super();
    this.base = baseStrategy;
    this.filters = filters;
  }

  chooseGuess(game, candidates, remainingWords) {
    let narrowed = candidates;
    for (const f of this.filters) {
      if (!f.isActive(game, remainingWords)) continue;
      const filtered = f.filter(narrowed, game);
      if (filtered.length > 0) narrowed = filtered;
    }
    return this.base.chooseGuess(game, narrowed, remainingWords);
  }
}

/** Maximizes the number of partitions, minimizing average group size. */
class MaxGroupsStrategy extends Strategy {
  chooseGuess(_game, candidates, remainingWords) {
    if (candidates.length <= 2) return candidates[0];
    let best = candidates[0];
    let bestScore = -Infinity;
    for (const word of candidates) {
      const score = partitionByGuess(word, remainingWords).size;
      if (score > bestScore) { bestScore = score; best = word; }
    }
    return best;
  }
}

/**
 * Minimizes Σ(groupSize²), equivalent to minimizing the expected number of
 * remaining candidates after the guess (assuming a uniform answer distribution). Intuively, this can be explained as minimizing the average number of words each word sees in its group. This is optimizing for the average case.
 */
class MinExpectedRemainingStrategy extends Strategy {
  chooseGuess(_game, candidates, remainingWords) {
    if (candidates.length <= 2) return candidates[0];
    let best = candidates[0];
    let bestScore = Infinity;
    for (const word of candidates) {
      let score = 0;
      for (const group of partitionByGuess(word, remainingWords).values()) {
        score += group.length * group.length;
      }
      if (score < bestScore) { bestScore = score; best = word; }
    }
    return best;
  }
}

/** Minimizes the largest group, optimising for the worst case. */
class MinimaxStrategy extends Strategy {
  chooseGuess(_game, candidates, remainingWords) {
    if (candidates.length <= 2) return candidates[0];
    let best = candidates[0];
    let bestScore = Infinity;
    for (const word of candidates) {
      let score = 0;
      for (const group of partitionByGuess(word, remainingWords).values()) {
        if (group.length > score) score = group.length;
      }
      if (score < bestScore) { bestScore = score; best = word; }
    }
    return best;
  }
}
