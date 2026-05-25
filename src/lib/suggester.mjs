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
    const rankings = this._computeRankings(game, remainingWords);
    const seen = new Set();
    const results = [];

    for (const source of this.sources) {
      const poolKey = source.pool ?? 'remaining';
      const ranked = rankings.get(source.strategy).get(poolKey);
      const fromTop = source.fromTop ?? 1;
      const method = source.method ?? 'top';
      const words = this._select(ranked, source.slots, fromTop, method);
      let added = 0;

      const addWord = (word) => {
        if (seen.has(word)) return false;
        seen.add(word);
        const rankIdx = ranked.findIndex(r => r.word === word);
        results.push({
          word,
          meta: {
            source: `${source.strategy.name}/${poolKey}`,
            rank: rankIdx + 1,
            percentile: rankIdx / ranked.length,
          },
        });
        return true;
      };

      for (const word of words) {
        if (addWord(word)) added++;
      }

      // Non-strict: fill unfilled slots from the top of the ranked list.
      if (!this.strict && added < source.slots) {
        for (const { word } of ranked) {
          if (added >= source.slots) break;
          if (addWord(word)) added++;
        }
      }
    }

    return this._shuffle(results);
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
    // Map<Strategy, Map<pool, ranked[]>> — same (strategy, pool) pair shares one call.
    const cache = new Map();
    for (const source of this.sources) {
      if (!cache.has(source.strategy)) cache.set(source.strategy, new Map());
      const byPool = cache.get(source.strategy);
      const poolKey = source.pool ?? 'remaining';
      if (byPool.has(poolKey)) continue;
      const candidates = poolKey === 'full' ? game.wordList : remainingWords;
      byPool.set(poolKey, source.strategy.rankGuesses(game, candidates, remainingWords));
    }
    return cache;
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
    const windowSize = Math.max(1, Math.floor(ranked.length * fromTop));
    const window = ranked.slice(0, windowSize);

    if (method === 'top') {
      return window.slice(0, slots).map(r => r.word);
    }

    if (method === 'tiers') {
      const words = [];
      for (let t = 0; t < slots; t++) {
        // Centre of each equal-width tier.
        const idx = Math.floor((t + 0.5) * windowSize / slots);
        words.push(window[Math.min(idx, window.length - 1)].word);
      }
      return words;
    }

    // method === 'random'
    const pool = window.slice();
    const count = Math.min(slots, pool.length);
    for (let i = 0; i < count; i++) {
      const j = i + Math.floor(this.rng() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count).map(r => r.word);
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
