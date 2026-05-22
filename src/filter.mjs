export class Filter {
  constructor({ maxTurn = 4, minRemaining = 10, minUnknownLetters = 2 } = {}) {
    this.maxTurn = maxTurn;
    this.minRemaining = minRemaining;
    this.minUnknownLetters = minUnknownLetters;
  }

  get name() {
    return this.constructor.name;
  }

  /**
   * Returns false (disabling the filter) when exploration is no longer useful:
   * past the turn limit, too few words remain, or most letters already tried.
   *
   * @param {import('./game.mjs').Game} game
   * @param {string[]} remainingWords
   */
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

  filter(candidates, _game) {
    return candidates;
  }
}

/** Keeps only words whose every letter is unexplored, maximising new information. */
class LetterExplorationFilter extends Filter {
  filter(candidates, game) {
    const explored = this._exploredLetters(game);
    return candidates.filter(word => [...word].every(ch => !explored.has(ch)));
  }
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/**
 * Within exploration candidates, avoids introducing new vowels so that
 * exploration guesses focus on consonants (21 options vs 5 vowels).
 */
class AntiVowelExplorationFilter extends Filter {
  filter(candidates, game) {
    const explored = this._exploredLetters(game);
    return candidates.filter(word =>
      [...word].every(ch => !VOWELS.has(ch) || explored.has(ch)),
    );
  }
}
