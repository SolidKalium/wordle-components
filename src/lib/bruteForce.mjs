const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

/**
 * Generates valid 5-letter combinations in alphabetical order given a ConstraintState.
 * Does not require or use a word list.
 *
 * Model: five "wheels", each with its own set of valid letters (positional constraints).
 * Cross-wheel constraints are minCounts (a letter must appear on ≥N wheels) and
 * maxCounts (a letter may appear on ≤N wheels).
 *
 * Navigation is O(1) per step — no trial-and-error:
 *   next(combo): advance rightmost wheel; if it overflows carry left, then fill
 *                remaining wheels with the lex-smallest valid suffix.
 *   prev(combo): retreat rightmost wheel; if it underflows carry left, then fill
 *                remaining wheels with the lex-largest valid suffix.
 *
 * The fill step uses a small DFS (depth ≤ 5, branching ≤ 26) with forward-checking
 * to directly find the minimum (or maximum) valid suffix without trying invalid ones.
 */
export class BruteForceGenerator {
  /** @param {import('./constraints.mjs').ConstraintState} constraints */
  constructor(constraints) {
    // Valid letters at each position, sorted alphabetically.
    this.posLetters = Array.from({ length: 5 }, (_, i) => {
      if (constraints.known[i]) return [constraints.known[i]];
      // isExhausted, not eliminated: a present letter with no room for more
      // copies must also be barred from every remaining open position.
      return ALPHABET.filter(ch => !constraints.isExhausted(ch) && !constraints.excluded[i].has(ch));
    });

    // Fast letter-index lookup per position.
    this.posIndex = this.posLetters.map(ls =>
      Object.fromEntries(ls.map((ch, i) => [ch, i]))
    );

    this.posLetterSets = this.posLetters.map(ls => new Set(ls));

    this.minCounts = constraints.minCounts;
    this.maxCounts = constraints.maxCounts;

    // Letters whose running count must be tracked while walking positions — only
    // letters with a positive minCount, since every other letter is "free": picking
    // any one of them affects no constraint, so they're interchangeable for both
    // counting and indexing. Bounded by 5 distinct letters (5 positions total).
    this._trackedLetters = [...this.minCounts.keys()].filter(ch => this.minCounts.get(ch) > 0);
    this._posTracked = this.posLetters.map(ls => ls.filter(ch => this._trackedLetters.includes(ch)));
    this._posFreeCount = this.posLetters.map((ls, i) => ls.length - this._posTracked[i].length);

    this._completionsMemo = new Map();
  }

  /** Exact count of valid combinations. */
  exactTotal() {
    return this._completions(0, new Map());
  }

  /**
   * Returns the 0-indexed k-th valid combination in lexicographic order, or null
   * if k is out of range. Built on the same completions-counting core as
   * `exactTotal()` — counting and indexing are one function used two ways.
   * @param {number} k
   */
  nth(k) {
    if (k < 0) return null;
    let remaining = k;
    let counts = new Map();
    let result = '';

    for (let pos = 0; pos < 5; pos++) {
      let chosen = false;

      for (const ch of this.posLetters[pos]) {
        const maxCh = this.maxCounts.get(ch);
        const have  = counts.get(ch) ?? 0;
        if (maxCh !== undefined && have + 1 > maxCh) continue;

        const tracked    = this._trackedLetters.includes(ch);
        const nextCounts = tracked ? _inc(counts, ch) : counts;
        const blockSize  = this._completions(pos + 1, nextCounts);

        if (remaining < blockSize) {
          result += ch;
          counts = nextCounts;
          chosen = true;
          break;
        }
        remaining -= blockSize;
      }

      if (!chosen) return null;
    }

    return result;
  }

  /**
   * Number of valid ways to fill positions [pos..4], given the running count of
   * each tracked letter placed in [0..pos-1]. Memoized — the state space is
   * bounded by (tracked letters ≤ 5) × (counts 0..5 each) × (5 positions), so this
   * stays small regardless of how open the board is: untracked letters at a
   * position all lead to the same next state, so they're folded into one multiply
   * (`_posFreeCount`) rather than branching per letter.
   */
  _completions(pos, counts) {
    if (pos === 5) {
      for (const ch of this._trackedLetters) {
        if ((counts.get(ch) ?? 0) < this.minCounts.get(ch)) return 0;
      }
      return 1;
    }

    const key = pos + '|' + this._trackedLetters.map(ch => counts.get(ch) ?? 0).join(',');
    const cached = this._completionsMemo.get(key);
    if (cached !== undefined) return cached;

    let total = 0;
    for (const ch of this._posTracked[pos]) {
      const maxCh = this.maxCounts.get(ch);
      const have  = counts.get(ch) ?? 0;
      if (maxCh !== undefined && have + 1 > maxCh) continue;
      total += this._completions(pos + 1, _inc(counts, ch));
    }

    const freeCount = this._posFreeCount[pos];
    if (freeCount > 0) {
      total += freeCount * this._completions(pos + 1, counts);
    }

    this._completionsMemo.set(key, total);
    return total;
  }

  /** Returns the first valid combination, or null if the space is empty. */
  first() {
    const required = _buildRequired(this.minCounts, new Map());
    if (!this._feasible(0, new Map(), required)) return null;
    return this._minFill(0, new Map(), required);
  }

  /** Returns the last valid combination, or null if the space is empty. */
  last() {
    const required = _buildRequired(this.minCounts, new Map());
    if (!this._feasible(0, new Map(), required)) return null;
    return this._maxFill(0, new Map(), required);
  }

  /**
   * Returns the lex-next valid combination after `combo`, or null if exhausted.
   * @param {string} combo
   */
  next(combo) {
    return this._step(combo, +1);
  }

  /**
   * Returns the lex-previous valid combination before `combo`, or null if at start.
   * @param {string} combo
   */
  prev(combo) {
    return this._step(combo, -1);
  }

  /**
   * Fetch a page of valid combinations starting from (and including) `startCombo`.
   * @param {string|null} startCombo - null means start from the beginning.
   * @param {number}      count
   * @returns {{ items: string[], nextCombo: string|null }}
   *   nextCombo is the first combo of the next page (null if exhausted).
   */
  getPage(startCombo, count) {
    const items = [];
    let cur = startCombo ?? this.first();
    while (cur !== null && items.length < count) {
      items.push(cur);
      cur = this.next(cur);
    }
    // After the loop, cur is already pointing past the last item — use it directly.
    return { items, nextCombo: cur };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  _step(combo, dir) {
    const letters = combo.split('');

    for (let pos = 4; pos >= 0; pos--) {
      // Letters already fixed in prefix [0..pos-1].
      const prefixCounts = _countLetters(letters, 0, pos);

      // Try to advance (dir=+1) or retreat (dir=-1) the letter at this position.
      const curIdx = this.posIndex[pos][letters[pos]];
      const candidates =
        dir > 0
          ? this.posLetters[pos].slice(curIdx + 1)          // letters after current
          : this.posLetters[pos].slice(0, curIdx).reverse(); // letters before current (largest first)

      for (const L of candidates) {
        const maxL = this.maxCounts.get(L);
        if (maxL !== undefined && (prefixCounts.get(L) ?? 0) + 1 > maxL) continue;

        const newCounts = _inc(prefixCounts, L);
        const required  = _buildRequired(this.minCounts, newCounts);

        if (!this._feasible(pos + 1, newCounts, required)) continue;

        const suffix = dir > 0
          ? this._minFill(pos + 1, newCounts, required)
          : this._maxFill(pos + 1, newCounts, required);

        if (suffix !== null) {
          return letters.slice(0, pos).join('') + L + suffix;
        }
      }
      // No candidate worked at this position — carry left.
    }

    return null; // beginning or end of space
  }

  /**
   * Find the lex-smallest valid suffix for positions [startPos..4].
   * @param {number} startPos
   * @param {Map}    prefixCounts - letter counts from positions [0..startPos-1]
   * @param {Map}    required     - remaining minCount obligations (letter → still-needed count)
   * @returns {string|null}
   */
  _minFill(startPos, prefixCounts, required) {
    if (startPos === 5) return required.size === 0 ? '' : null;

    for (const L of this.posLetters[startPos]) {
      const maxL = this.maxCounts.get(L);
      if (maxL !== undefined && (prefixCounts.get(L) ?? 0) + 1 > maxL) continue;

      const newCounts  = _inc(prefixCounts, L);
      const newReq     = _decReq(required, L);

      if (!this._feasible(startPos + 1, newCounts, newReq)) continue;

      const rest = this._minFill(startPos + 1, newCounts, newReq);
      if (rest !== null) return L + rest;
    }
    return null;
  }

  /** Find the lex-largest valid suffix (same structure, reversed letter order). */
  _maxFill(startPos, prefixCounts, required) {
    if (startPos === 5) return required.size === 0 ? '' : null;

    for (const L of [...this.posLetters[startPos]].reverse()) {
      const maxL = this.maxCounts.get(L);
      if (maxL !== undefined && (prefixCounts.get(L) ?? 0) + 1 > maxL) continue;

      const newCounts  = _inc(prefixCounts, L);
      const newReq     = _decReq(required, L);

      if (!this._feasible(startPos + 1, newCounts, newReq)) continue;

      const rest = this._maxFill(startPos + 1, newCounts, newReq);
      if (rest !== null) return L + rest;
    }
    return null;
  }

  /**
   * Forward-check: can positions [startPos..4] still satisfy `required`?
   * For each still-needed letter, counts how many remaining positions can hold it.
   * This check is necessary (no false negatives) though not sufficient (can false-positive),
   * so failed fill attempts are possible but harmless.
   */
  _feasible(startPos, currentCounts, required) {
    for (const [ch, need] of required) {
      if (need <= 0) continue;
      const maxCh  = this.maxCounts.get(ch);
      const haveCh = currentCounts.get(ch) ?? 0;
      let slots = 0;
      for (let i = startPos; i < 5; i++) {
        if (!this.posLetterSets[i].has(ch)) continue;
        if (maxCh !== undefined && haveCh + 1 > maxCh) continue;
        slots++;
      }
      if (slots < need) return false;
    }
    return true;
  }
}

// ── pure helpers (no allocation on the hot path when Maps are reused) ───────

function _countLetters(letters, start, end) {
  const m = new Map();
  for (let i = start; i < end; i++) m.set(letters[i], (m.get(letters[i]) ?? 0) + 1);
  return m;
}

function _inc(counts, ch) {
  const m = new Map(counts);
  m.set(ch, (m.get(ch) ?? 0) + 1);
  return m;
}

/** Compute remaining required counts given current totals. */
function _buildRequired(minCounts, currentCounts) {
  const req = new Map();
  for (const [ch, min] of minCounts) {
    const have = currentCounts.get(ch) ?? 0;
    if (have < min) req.set(ch, min - have);
  }
  return req;
}

/** Return a new required map with one unit of `ch` satisfied (or removed if done). */
function _decReq(required, ch) {
  const need = required.get(ch);
  if (!need) return required; // no change needed — avoid Map copy when possible
  const m = new Map(required);
  if (need === 1) m.delete(ch);
  else m.set(ch, need - 1);
  return m;
}
