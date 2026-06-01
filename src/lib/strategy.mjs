import { partitionByGuess } from './core.mjs';

/**
 * Base class for Wordle-solving strategies.
 *
 * Subclasses implement `rankGuesses`. `chooseGuess` is provided here and
 * delegates to `rankGuesses(…, 1)`, so subclasses only need to implement one method.
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
   * Return up to k candidates ranked by the strategy's metric.
   *
   * @param {import('./game.mjs').Game} game
   * @param {string[]} candidates - Words eligible to be guessed (may be pre-filtered).
   * @param {string[]} remainingWords - Full set of words consistent with constraints,
   *   used as the partition target by scoring strategies.
   * @param {number} [k]
   * @returns {{ word: string, score: number | null }[]}
   */
  rankGuesses(game, candidates, remainingWords, k = candidates.length) {
    throw new Error(`${this.name}.rankGuesses() not implemented`);
  }

  /**
   * @param {import('./game.mjs').Game} game
   * @param {string[]} candidates
   * @param {string[]} remainingWords
   * @returns {string}
   */
  chooseGuess(game, candidates, remainingWords) {
    return this.rankGuesses(game, candidates, remainingWords, 1)[0].word;
  }
}

/**
 * Picks a random word from the remaining valid set.
 * Not a good strategy, but a useful baseline and smoke test.
 */
export class RandomStrategy extends Strategy {
  rankGuesses(_game, candidates, _remainingWords, k = candidates.length) {
    const result = candidates.slice();
    const limit = Math.min(k, result.length);
    for (let i = 0; i < limit; i++) {
      const j = i + Math.floor(Math.random() * (result.length - i));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result.slice(0, limit).map(word => ({ word, score: null }));
  }
}

/**
 * Always guesses the first word in the remaining list (alphabetically
 * if the list is sorted). Deterministic, so useful for reproducible tests.
 */
export class FirstWordStrategy extends Strategy {
  rankGuesses(_game, candidates, _remainingWords, k = candidates.length) {
    return candidates.slice(0, k).map(word => ({ word, score: null }));
  }
}

/**
 * Decorates another strategy to make it consider a filtered subset of candidates.
 */
export class FilteredStrategy extends Strategy {
  constructor(baseStrategy, filters = []) {
    super();
    this.base = baseStrategy;
    this.filters = filters;
  }

  rankGuesses(game, candidates, remainingWords, k = candidates.length) {
    let narrowed = candidates;
    for (const f of this.filters) {
      if (!f.isActive(game, remainingWords)) continue;
      const filtered = f.filter(narrowed, game);
      if (filtered.length > 0) narrowed = filtered;
    }
    return this.base.rankGuesses(game, narrowed, remainingWords, k);
  }
}

/** Maximizes the number of partitions, minimizing average group size. */
export class MaxGroupsStrategy extends Strategy {
  rankGuesses(_game, candidates, remainingWords, k = candidates.length) {
    const scored = candidates.map(word => ({
      word,
      score: partitionByGuess(word, remainingWords).size,
    }));
    scored.sort((a, b) => b.score - a.score); // descending: more groups is better
    return scored.slice(0, k);
  }
}

/**
 * Minimizes Σ(groupSize²), equivalent to minimizing the expected number of
 * remaining candidates after the guess (assuming a uniform answer distribution).
 */
export class MinExpectedRemainingStrategy extends Strategy {
  rankGuesses(_game, candidates, remainingWords, k = candidates.length) {
    const scored = candidates.map(word => {
      let score = 0;
      for (const group of partitionByGuess(word, remainingWords).values()) {
        score += group.length * group.length;
      }
      return { word, score };
    });
    scored.sort((a, b) => a.score - b.score); // ascending: lower is better
    return scored.slice(0, k);
  }
}

/**
 * Maximizes expected Shannon information gain.
 *
 * For a fixed set of remaining words, maximizing expected entropy gain is
 * equivalent to minimizing Σ(n * lg(n)), where n is each partition group's size.
 */
export class MaxEntropyStrategy extends Strategy {
  rankGuesses(_game, candidates, remainingWords, k = candidates.length) {
    const scored = candidates.map(word => {
      let score = 0;
      for (const group of partitionByGuess(word, remainingWords).values()) {
        const n = group.length;
        score += n * Math.log2(n);
      }
      return { word, score };
    });
    scored.sort((a, b) => a.score - b.score); // ascending: lower expected remaining entropy is better
    return scored.slice(0, k);
  }
}

/** Minimizes the largest group, optimizing for the worst case. */
export class MinimaxStrategy extends Strategy {
  rankGuesses(_game, candidates, remainingWords, k = candidates.length) {
    const scored = candidates.map(word => {
      let score = 0;
      for (const group of partitionByGuess(word, remainingWords).values()) {
        if (group.length > score) score = group.length;
      }
      return { word, score };
    });
    scored.sort((a, b) => a.score - b.score); // ascending: lower is better
    return scored.slice(0, k);
  }
}
