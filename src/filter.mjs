export class Filter {
  get name() {
    return this.constructor.name;
  }

  isActive(_game, _remainingWords) {
    return true;
  }

  /**
   * Word-level predicate. Subclasses override this instead of filter().
   * Always receives a plain string regardless of whether the caller holds
   * a string[] or a ranked {word, score}[] list.
   *
   * @param {string} word
   * @param {import('./game.mjs').Game} game
   * @returns {boolean}
   */
  accepts(_word, _game) {
    return true;
  }

  /**
   * @param {string[] | {word: string, score: number}[]} candidates
   * @param {import('./game.mjs').Game} game
   */
  filter(candidates, game) {
    return candidates.filter(item =>
      this.accepts(typeof item === 'string' ? item : item.word, game),
    );
  }
}

/**
 * Base for filters that deactivate once exploration is no longer useful:
 * past a turn limit, too few words remain, or too few untried letters are left.
 */
class ExplorationFilter extends Filter {
  constructor({ maxTurn = 4, minRemaining = 10, minUnknownLetters = 2 } = {}) {
    super();
    this.maxTurn = maxTurn;
    this.minRemaining = minRemaining;
    this.minUnknownLetters = minUnknownLetters;
  }

  isActive(game, remainingWords) {
    if (game.guesses.length > this.maxTurn) return false;
    if (remainingWords.length < this.minRemaining) return false;
    if (26 - this._exploredLetters(game).size < this.minUnknownLetters) return false;
    return true;
  }

  /** @returns {Set<string>} All letters that appear in any previous guess. */
  _exploredLetters(game) {
    return new Set(game.guesses.flatMap(g => [...g.word]));
  }
}

/** Keeps only words whose every letter is unexplored, maximising new information. */
class LetterExplorationFilter extends ExplorationFilter {
  accepts(word, game) {
    const explored = this._exploredLetters(game);
    return [...word].every(ch => !explored.has(ch));
  }
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Within exploration candidates, avoids introducing new vowels so that
 * exploration guesses focus on consonants (21 options vs 5 vowels).
 */
class AntiVowelExplorationFilter extends ExplorationFilter {
  accepts(word, game) {
    const explored = this._exploredLetters(game);
    return [...word].every(ch => !VOWELS.has(ch) || explored.has(ch));
  }
}

/**
 * Within exploration candidates, prefers introducing new vowels to rule out
 * more of the vowel space alongside consonant placement.
 */
class VowelExplorationFilter extends ExplorationFilter {
  accepts(word, game) {
    const explored = this._exploredLetters(game);
    return [...word].every(ch => !VOWELS.has(ch) || !explored.has(ch));
  }
}

/** Keeps only words that contain all required letters (multiset: duplicates count). */
export class MustContainFilter extends Filter {
  /** @param {string | string[]} letters */
  constructor(letters) {
    super();
    this.required = new Map();
    for (const ch of letters) {
      this.required.set(ch, (this.required.get(ch) ?? 0) + 1);
    }
  }

  accepts(word, _game) {
    const counts = new Map();
    for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    for (const [ch, n] of this.required) {
      if ((counts.get(ch) ?? 0) < n) return false;
    }
    return true;
  }
}

/**
 * Keeps only words buildable from a letter rack (multiset: each letter may be
 * used at most as many times as it appears in the rack).
 */
export class ScrabbleFilter extends Filter {
  /** @param {string | string[]} rack */
  constructor(rack) {
    super();
    this.available = new Map();
    for (const ch of rack) {
      this.available.set(ch, (this.available.get(ch) ?? 0) + 1);
    }
  }

  accepts(word, _game) {
    const counts = new Map();
    for (const ch of word) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    for (const [ch, n] of counts) {
      if (n > (this.available.get(ch) ?? 0)) return false;
    }
    return true;
  }
}

/**
 * Keeps only words that use exclusively letters from the given set
 * (each letter may appear any number of times).
 */
export class KeyboardFilter extends Filter {
  /** @param {string | string[]} keys */
  constructor(keys) {
    super();
    this.allowed = new Set(keys);
  }

  accepts(word, _game) {
    return [...word].every(ch => this.allowed.has(ch));
  }
}
