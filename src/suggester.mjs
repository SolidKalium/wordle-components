/**
 * A source tells the Suggester where and how to draw suggestions.
 *
 * @typedef {object} Source
 * @property {import('./strategy.mjs').Strategy} strategy
 * @property {'remaining' | 'full'} pool
 *   'remaining' = words consistent with current constraints (hard-mode compatible).
 *   'full'      = entire word list, enabling exploratory (non-answer) guesses.
 * @property {number} slots       Desired number of suggestions from this source.
 * @property {number} [fromTop=1] Fraction of the ranked list eligible for selection (0–1].
 * @property {'top' | 'tiers' | 'random'} [method='top']
 *   'top'    — pick the best `slots` words from within the `fromTop` window.
 *   'tiers'  — divide the `fromTop` window into `slots` equal segments, pick one per segment.
 *   'random' — pick `slots` words uniformly at random from within the `fromTop` window.
 *
 * Considered but not implemented: method 'positions' with an explicit positions[] array
 * (e.g. [0.05, 0.3, 0.7]) to select words at exact percentile locations.
 */

/**
 * @typedef {object} Suggestion
 * @property {string} word
 * @property {object} meta   Hidden from the player until revealed (training / explanation mode).
 * @property {string} meta.source     `${strategyName}/${pool}`
 * @property {number} meta.rank       1-based rank within the source's strategy output.
 * @property {number} meta.percentile Fraction of the pool ranked above this word (0–1).
 */

export class Suggester {
  /**
   * @param {object} opts
   * @param {Source[]} opts.sources
   * @param {boolean}  [opts.strict=false]
   *   false — unfilled slots redistribute to sources with capacity; if the total
   *   pool is smaller than the requested count, return everything available.
   *   true  — honour slot quotas exactly; return fewer words rather than overflow.
   * @param {() => number} [opts.rng=Math.random]
   *   Random number source. Pass a seeded function for reproducible results.
   *
   * Note: sources that reference the same Strategy *instance* share a single
   * rankGuesses() call. Behavioural equivalence across separately constructed
   * instances is not detected — reuse the same object to get deduplication.
   */
  constructor({ sources, strict = false, rng = Math.random } = {}) {
    this.sources = sources;
    this.strict = strict;
    this.rng = rng;
  }

  /**
   * @param {import('./game.mjs').Game} game
   * @param {string[]} remainingWords  Words consistent with current constraints.
   * @returns {Suggestion[]}  Shuffled; meta is always populated but should be
   *   withheld from the player until revealed.
   */
  suggest(game, remainingWords) {
    // TODO
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Run rankGuesses for each unique strategy instance, sharing results across
   * sources that reference the same object.
   *
   * @param {import('./game.mjs').Game} game
   * @param {string[]} remainingWords
   * @returns {Map<Strategy, {word: string, score: number}[]>}
   */
  _computeRankings(game, remainingWords) {
    // TODO
  }

  /**
   * Select `slots` words from `ranked` according to `method` and `fromTop`,
   * using `this.rng` for any random choices.
   *
   * @param {{word: string, score: number}[]} ranked  Full sorted list.
   * @param {number} slots
   * @param {number} fromTop  Fraction of `ranked` to treat as the eligible pool.
   * @param {'top'|'tiers'|'random'} method
   * @returns {string[]}
   */
  _select(ranked, slots, fromTop, method) {
    // TODO
  }

  /** Fisher-Yates shuffle in-place using this.rng. */
  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}
