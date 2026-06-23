import { GREEN, YELLOW, GREY, WORD_LENGTH } from './core.mjs';

/**
 * Tracks everything learned from guesses so far.
 *
 * Internal representation:
 *   known[i]      - The letter confirmed at position i, or null.
 *   excluded[i]   - Set of letters ruled out at position i (from yellow or grey).
 *   minCounts      - Map<letter, number>: minimum occurrences of this letter in the answer.
 *   maxCounts      - Map<letter, number>: maximum occurrences (set when a grey provides
 *                    an upper bound alongside greens/yellows for the same letter).
 *
 * A letter with maxCounts 0 is fully eliminated. The `eliminated` getter
 * provides that set for convenience.
 *
 * After each update, the state is normalized: if a letter is excluded from
 * 4 of 5 positions and minCounts requires it, it is auto-promoted to known
 * in the remaining position.
 */
export class ConstraintState {
  constructor() {
    /** @type {(string|null)[]} */
    this.known = new Array(WORD_LENGTH).fill(null);

    /** @type {Set<string>[]} */
    this.excluded = Array.from({ length: WORD_LENGTH }, () => new Set());

    /** @type {Map<string, number>} */
    this.minCounts = new Map();

    /** @type {Map<string, number>} */
    this.maxCounts = new Map();
  }

  /** Set of letters known to have zero occurrences in the answer. */
  get eliminated() {
    const out = new Set();
    for (const [letter, max] of this.maxCounts) {
      if (max === 0) out.add(letter);
    }
    return out;
  }

  /**
   * Letters with a known upper bound — the "Gray" set. Superset of `eliminated`:
   * also includes present letters whose count is capped (e.g. exhausted ones),
   * not just letters confirmed absent.
   */
  get gray() {
    return new Set(this.maxCounts.keys());
  }

  /**
   * Returns true when every copy of `letter` is already at a confirmed position
   * (i.e. maxCounts is set and all copies are accounted for by `known`).
   * Distinct from `eliminated`: eliminated means the letter isn't in the word at
   * all; isExhausted means it IS in the word but there's nowhere new to place it.
   *
   * @param {string} letter
   * @returns {boolean}
   */
  isExhausted(letter) {
    const max = this.maxCounts.get(letter);
    if (max === undefined) return false;
    let placed = 0;
    for (const L of this.known) if (L === letter) placed++;
    return max <= placed;
  }

  /**
   * Incorporate information from a single guess and its result pattern.
   *
   * @param {string}   guess   - The guessed word
   * @param {string[]} pattern - Array of GREEN/YELLOW/GREY per position
   */
  update(guess, pattern) {
    // Group positions by letter to handle duplicates correctly.
    const byLetter = new Map();
    for (let i = 0; i < WORD_LENGTH; i++) {
      const letter = guess[i];
      if (!byLetter.has(letter)) {
        byLetter.set(letter, { greens: [], yellows: [], greys: [] });
      }
      const bucket = byLetter.get(letter);
      if (pattern[i] === GREEN) bucket.greens.push(i);
      else if (pattern[i] === YELLOW) bucket.yellows.push(i);
      else bucket.greys.push(i);
    }

    for (const [letter, { greens, yellows, greys }] of byLetter) {
      // Place greens.
      for (const i of greens) {
        this.known[i] = letter;
      }

      // Exclude yellows from their positions (letter is present, but not here).
      for (const i of yellows) {
        this.excluded[i].add(letter);
      }

      // Exclude greys from their positions.
      for (const i of greys) {
        this.excluded[i].add(letter);
      }

      const confirmedCount = greens.length + yellows.length;

      if (confirmedCount > 0) {
        // At least this many of the letter exist.
        this.minCounts.set(
          letter,
          Math.max(this.minCounts.get(letter) ?? 0, confirmedCount),
        );

        if (greys.length > 0) {
          // Grey alongside greens/yellows pins the exact count.
          this.maxCounts.set(letter, confirmedCount);
        }
      } else {
        // All grey: letter does not appear at all.
        this.maxCounts.set(letter, 0);
        this.minCounts.set(letter, 0);
      }
    }

    this._normalize();
  }

  /**
   * Auto-promote: if a letter is excluded from all but one unknown position,
   * and minCounts requires it, lock it into the remaining slot.
   *
   * Auto-exhaust: if a present letter has no remaining open position left to
   * occupy, no further copies of it can appear anywhere. Its effective max is
   * exactly its known count, and the per-position exclusions that led to this
   * conclusion become redundant — clearing them is what makes two raw inputs
   * encoding the same knowledge (explicit max vs. excluded-everywhere) converge
   * on the same normalized state.
   */
  _normalize() {
    for (const [letter, minCount] of this.minCounts) {
      if (minCount === 0) continue;

      // Count how many positions this letter is already known at.
      let knownCount = 0;
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (this.known[i] === letter) knownCount++;
      }
      if (knownCount >= minCount) continue;

      // Find positions where this letter could still go.
      const candidates = [];
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (this.known[i] !== null) continue; // occupied
        if (this.excluded[i].has(letter)) continue; // ruled out
        candidates.push(i);
      }

      // If exactly enough open slots remain for the unplaced copies, fill them.
      const unplaced = minCount - knownCount;
      if (candidates.length === unplaced) {
        for (const i of candidates) {
          this.known[i] = letter;
        }
      }
    }

    const present = new Set(this.known.filter(Boolean));
    for (const [letter, minCount] of this.minCounts) {
      if (minCount > 0) present.add(letter);
    }

    for (const letter of present) {
      let knownCount = 0;
      for (let i = 0; i < WORD_LENGTH; i++) {
        if (this.known[i] === letter) knownCount++;
      }

      if (!this.maxCounts.has(letter)) {
        let openPosition = false;
        for (let i = 0; i < WORD_LENGTH; i++) {
          if (this.known[i] === letter) continue;
          if (this.known[i] === null && !this.excluded[i].has(letter)) { openPosition = true; break; }
        }
        if (!openPosition) this.maxCounts.set(letter, knownCount);
      }

      // Once exhausted — whether via an explicit max (e.g. Gray) or the
      // inference above — per-position exclusions for this letter are
      // redundant; clearing them is what makes equivalent raw inputs converge.
      const max = this.maxCounts.get(letter);
      if (max !== undefined && max <= knownCount) {
        for (let i = 0; i < WORD_LENGTH; i++) {
          if (this.known[i] === null) this.excluded[i].delete(letter);
        }
      }
    }
  }

  /**
   * Test whether a word is consistent with all accumulated constraints.
   *
   * @param {string} word
   * @returns {boolean}
   */
  matches(word) {
    // Check known positions.
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (this.known[i] !== null && word[i] !== this.known[i]) return false;
      if (this.excluded[i].has(word[i])) return false;
    }

    // Count letters in the word.
    const counts = new Map();
    for (const ch of word) {
      counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }

    // Check minimum counts.
    for (const [letter, min] of this.minCounts) {
      if ((counts.get(letter) ?? 0) < min) return false;
    }

    // Check maximum counts.
    for (const [letter, max] of this.maxCounts) {
      if ((counts.get(letter) ?? 0) > max) return false;
    }

    return true;
  }

  /**
   * Build a ConstraintState from the four rows of the constraint editor UI.
   *
   * @param {Object} opts
   * @param {(string|null)[]} opts.green    - Confirmed letter at each position, or null.
   * @param {string[][]}      opts.yellow   - Letters excluded from each position (per-slot).
   * @param {string[]}        opts.unplaced - Letters known to be in the word but unplaced
   *                                          (duplicates encode minimum count, e.g. ['a','a']).
   * @param {string[]}        opts.gray     - Letters with no additional copies beyond
   *                                          what green + unplaced already account for.
   * @returns {ConstraintState}
   */
  static fromEditor({ green, yellow, unplaced, gray }) {
    const c = new ConstraintState();

    for (let i = 0; i < WORD_LENGTH; i++) {
      if (green[i]) {
        c.known[i] = green[i];
        c.minCounts.set(green[i], (c.minCounts.get(green[i]) ?? 0) + 1);
      }
      for (const ch of yellow[i]) c.excluded[i].add(ch);
    }

    for (const ch of unplaced) {
      c.minCounts.set(ch, (c.minCounts.get(ch) ?? 0) + 1);
    }

    for (const ch of gray) {
      c.maxCounts.set(ch, c.minCounts.get(ch) ?? 0);
    }

    c._normalize();
    return c;
  }

  /**
   * Create a deep copy of this state.
   */
  clone() {
    const copy = new ConstraintState();
    copy.known = [...this.known];
    copy.excluded = this.excluded.map(s => new Set(s));
    copy.minCounts = new Map(this.minCounts);
    copy.maxCounts = new Map(this.maxCounts);
    return copy;
  }

  /**
   * Serialize to a deterministic string key.
   *
   * Format: 5 position slots separated by |, then ;minCounts;maxCounts.
   * Each position: "+L" if known, or "-abc" listing excluded letters sorted.
   * Counts: sorted letter:n pairs.
   *
   * This is informational and cacheable, not a primary design driver.
   */
  toKey() {
    const positions = [];
    for (let i = 0; i < WORD_LENGTH; i++) {
      if (this.known[i]) {
        positions.push(`+${this.known[i]}`);
      } else {
        const ex = [...this.excluded[i]].sort().join('');
        positions.push(ex.length > 0 ? `-${ex}` : '?');
      }
    }

    const mins = [...this.minCounts.entries()]
      .filter(([, n]) => n > 0)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([l, n]) => `${l}${n}`)
      .join('');

    const maxs = [...this.maxCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([l, n]) => `${l}${n}`)
      .join('');

    return `${positions.join('|')};${mins};${maxs}`;
  }
}
