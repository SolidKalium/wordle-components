import { WORD_LENGTH } from './core.mjs';

export class Filter {
  get name() {
    return this.constructor.name;
  }

  get id() {
    return this.constructor.name;
  }

  get displayName() {
    return this.id;
  }

  /**
   * Describes what constructor arguments this filter requires, or null if it
   * can be instantiated with no arguments. Used by UIs to determine whether
   * a filter can be offered as a simple toggle vs. needing a configuration step.
   *
   * @returns {Record<string, string> | null}
   */
  get parameters() {
    return null;
  }

  /** Derived: true if the filter needs constructor arguments to be useful. */
  get requiresInput() {
    return this.parameters !== null;
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
export class ExplorationFilter extends Filter {
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
export class LetterExplorationFilter extends ExplorationFilter {
  get id() { return 'letterExploration'; }
  get displayName() { return 'Letter Exploration'; }

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
export class AntiVowelExplorationFilter extends ExplorationFilter {
  get id() { return 'antiVowelExploration'; }
  get displayName() { return 'Anti-Vowel Exploration'; }

  accepts(word, game) {
    const explored = this._exploredLetters(game);
    return [...word].every(ch => !VOWELS.has(ch) || explored.has(ch));
  }
}

/**
 * Within exploration candidates, prefers introducing new vowels to rule out
 * more of the vowel space alongside consonant placement.
 */
export class VowelExplorationFilter extends ExplorationFilter {
  get id() { return 'vowelExploration'; }
  get displayName() { return 'Vowel Exploration'; }

  accepts(word, game) {
    const explored = this._exploredLetters(game);
    return [...word].every(ch => !VOWELS.has(ch) || !explored.has(ch));
  }
}

/** Keeps only words that contain all required letters (multiset: duplicates count). */
export class MustContainFilter extends Filter {
  get id() { return 'mustContain'; }
  get displayName() { return 'Must Contain'; }
  get parameters() { return { letters: 'Letters the guess must contain (multiset)' }; }

  /** @param {string | string[]} letters */
  constructor(letters) {
    super();
    this.required = new Map();
    for (const ch of letters) {
      this.required.set(ch, (this.required.get(ch) ?? 0) + 1);
    }
    const total = [...this.required.values()].reduce((s, n) => s + n, 0);
    if (total > WORD_LENGTH) {
      throw new RangeError(
        `MustContainFilter requires ${total} letters but words are only ${WORD_LENGTH} long`,
      );
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
  get id() { return 'scrabble'; }
  get displayName() { return 'Scrabble'; }
  get parameters() { return { rack: 'Available letter rack (multiset)' }; }

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
  get id() { return 'keyboard'; }
  get displayName() { return 'Keyboard'; }
  get parameters() { return { keys: 'Allowed letters (set)' }; }

  /** @param {string | string[]} keys */
  constructor(keys) {
    super();
    this.allowed = new Set(keys);
  }

  accepts(word, _game) {
    return [...word].every(ch => this.allowed.has(ch));
  }
}

/**
 * Preset filters that require no constructor arguments — suitable for simple
 * UI toggles. Argument-requiring filters (MustContainFilter, ScrabbleFilter,
 * KeyboardFilter) are exported as classes only.
 */
export const EXPLORATION_FILTERS = [
  new LetterExplorationFilter(),
  new VowelExplorationFilter(),
  new AntiVowelExplorationFilter(),
];
