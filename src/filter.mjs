/**
 * maxTurn int: Maximum turn number where the filter can be active
 * minUnknownLetters int: Minimum unexplored letters for the filter to be active
 * minRemaining int: Minimum words remaining for the filter to be active
 */
export class Filter {
  constructor({ maxTurn = 4, minRemaining = 10, minUnknownLetters = 2 }) {
    // TODO
  }

  /** Human-readable name for display and logging. */
  get name() {
    return this.constructor.name;
  }

  isActive(game, remainingWords) {
    // returns false (disabling itself) if any exit condition is met
    // TODO
  }

  filter(candidates, game) {
    // removes words that reuse already-explored letters
  }
}

class LetterExplorationFilter extends Filter {
  filter(candidates, game) {
    // removes words that reuse already-explored letters
  }
}

/**
 * Avoids guessing new vowels
 */
class AntiVowelExplorationFilter extends Filter {
  filter(candidates, game) {
    // removes words that reuse already-explored letters
  }
}
