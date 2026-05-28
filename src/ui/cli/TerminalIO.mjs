import { GREEN, YELLOW } from '../../lib/core.mjs';

// ANSI escape sequences for Wordle tile colours.
// Each entry covers background + text colour; follow with a letter then RESET.
const ANSI = {
  [GREEN]:  '\x1b[42m\x1b[1m\x1b[97m',   // green bg,      bold bright-white
  [YELLOW]: '\x1b[43m\x1b[1m\x1b[30m',   // yellow bg,     bold black (contrast)
  grey:     '\x1b[100m\x1b[1m\x1b[97m',  // dark-grey bg,  bold bright-white
  reset:    '\x1b[0m',
  eraseToEol: '\x1b[K',                   // clear from cursor to end of line
  underline: '\x1b[4m',                   // underline on   — used for cursor highlight
};

const PENDING = {
  yellowFg: '\x1b[33m',         // yellow fg — letter in word, position unknown
  greenFg:  '\x1b[1m\x1b[32m', // bold green fg — confirmed letter not yet placed
};

/**
 * Abstract base for terminal I/O.
 *
 * Concrete subclasses implement write() and readLine(); everything else is
 * provided here, including ANSI-coloured guess rendering that works on any
 * terminal that understands standard escape sequences (Node TTY, xterm.js).
 */
export class TerminalIO {
  /** Write raw text with no trailing newline. */
  write(_text) {
    throw new Error(`${this.constructor.name}.write() not implemented`);
  }

  /** Write text followed by a newline. */
  writeLine(text = '') {
    this.write(text + '\n');
  }

  /**
   * Prompt the user and return their input as a resolved Promise.
   * @param {string} prompt
   * @returns {Promise<string>}
   */
  readLine(_prompt = '') {
    throw new Error(`${this.constructor.name}.readLine() not implemented`);
  }

  /** Release any held resources (readline interface, listeners, etc.). */
  close() {}

  /**
   * Compute the styled slot data and pool for a partially-typed word.
   *
   * This is a pure computation (no ANSI, no platform specifics) so it can be
   * consumed by both CLI renderers (_slotsToAnsi / _poolToAnsi) and future
   * HTML/React renderers without modification.
   *
   * @param {string|(string|null)[]} word
   *   Letters typed so far.  Either a plain string (0–5 chars, positions beyond
   *   word.length are empty) or a 5-element array where null means "empty slot".
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {number} [cursor=-1]  Slot index (0–4) for cursor highlight; -1 = none.
   * @returns {{
   *   slots: Array<{kind: string, letter: string|null, atCursor: boolean}>,
   *   pool:  Array<{kind: 'green-unplaced'|'yellow-unplaced', letter: string}>
   * }}
   */
  _computePending(word, constraints, cursor = -1) {
    // Pre-compute confirmed positions per letter — used in both the
    // fully-placed check (Pass 1) and the yellow-fg pool (Pass 2).
    const knownCount = new Map();
    for (const L of constraints.known) {
      if (L) knownCount.set(L, (knownCount.get(L) ?? 0) + 1);
    }

    // Pass 1: assign high-priority colours per position.
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const letter = word[i] ?? null; // works for both string and (string|null)[] input
      if (!letter) { slots.push({ kind: 'empty', letter: null }); continue; }
      if (constraints.known[i] === letter) { slots.push({ kind: 'green', letter }); continue; }

      // Grey if every copy of this letter is already at a confirmed position
      // (covers fully-eliminated letters and letters whose copies are all
      // accounted for by greens, e.g. the second O in BOOTH after the first went green).
      if (constraints.isExhausted(letter)) {
        slots.push({ kind: 'grey', letter }); continue;
      }

      if (constraints.excluded[i].has(letter)) { slots.push({ kind: 'yellow-tile', letter }); continue; }
      slots.push({ kind: 'candidate', letter });
    }

    // Pass 2: assign yellow-fg within pool (left-to-right through candidates).
    // Pool = minCounts[L] − knownCount[L]; yellow-tile slots don't consume pool.
    const yellowFgUsed = new Map();
    for (const s of slots) {
      if (s.kind !== 'candidate') continue;
      const L = s.letter;
      const pool = Math.max(0,
        (constraints.minCounts.get(L) ?? 0) -
        (knownCount.get(L)            ?? 0)
      );
      const used = yellowFgUsed.get(L) ?? 0;
      s.kind = used < pool ? 'yellow-fg' : 'default';
      if (s.kind === 'yellow-fg') yellowFgUsed.set(L, used + 1);
    }

    // Pass 3: yellow-tile → grey when the pool for this letter is exhausted.
    // Covers two cases:
    //   • pool > 0 but yellow-fg placed elsewhere already used all copies
    //   • pool = 0 because _normalize() promoted the letter to a known position
    for (const s of slots) {
      if (s.kind !== 'yellow-tile') continue;
      const L = s.letter;
      const pool = Math.max(0,
        (constraints.minCounts.get(L) ?? 0) -
        (knownCount.get(L)            ?? 0)
      );
      if ((yellowFgUsed.get(L) ?? 0) >= pool) {
        s.kind = 'grey';
      }
    }

    // Attach cursor flag.
    const slotsWithCursor = slots.map((s, i) => ({
      ...s,
      atCursor: cursor >= 0 && cursor < 5 && i === cursor,
    }));

    // Build pool (structured, renderer-agnostic).
    // Greens in position order, then yellow-fg remainders alphabetically.
    const pool = [];
    for (let i = 0; i < 5; i++) {
      const L = constraints.known[i];
      if (L && slots[i].kind !== 'green') {
        pool.push({ kind: 'green-unplaced', letter: L });
      }
    }
    const yellowRemaining = [];
    for (const [L, total] of constraints.minCounts) {
      const poolSize = Math.max(0, total - (knownCount.get(L) ?? 0));
      const remaining = poolSize - (yellowFgUsed.get(L) ?? 0);
      for (let i = 0; i < remaining; i++) yellowRemaining.push(L);
    }
    yellowRemaining.sort();
    for (const L of yellowRemaining) {
      pool.push({ kind: 'yellow-unplaced', letter: L });
    }

    return { slots: slotsWithCursor, pool };
  }

  /**
   * Convert a slots array (from _computePending) to an ANSI tile-row string.
   * Tile format: LETTER + space + RESET for parseTileRow compatibility.
   *
   * @param {Array<{kind: string, letter: string|null, atCursor: boolean}>} slots
   * @returns {string}
   */
  _slotsToAnsi(slots) {
    return slots.map(({ kind, letter, atCursor }) => {
      const u     = letter?.toUpperCase();
      const ul    = atCursor ? ANSI.underline : '';
      const glyph = u ?? (atCursor ? '_' : ' ');

      if (kind === 'empty') {
        return atCursor ? `${ul} ${glyph} ${ANSI.reset}` : '   ';
      }
      switch (kind) {
        case 'green':       return `${ul}${ANSI[GREEN]} ${glyph} ${ANSI.reset}`;
        case 'yellow-tile': return `${ul}${ANSI[YELLOW]} ${glyph} ${ANSI.reset}`;
        case 'grey':        return `${ul}${ANSI.grey} ${glyph} ${ANSI.reset}`;
        case 'yellow-fg':   return `${ul}${PENDING.yellowFg} ${glyph} ${ANSI.reset}`;
        default:            return atCursor ? `${ul} ${glyph} ${ANSI.reset}` : ` ${glyph} `;
      }
    }).join('');
  }

  /**
   * Convert a pool array (from _computePending) to an ANSI hint string.
   *
   * @param {Array<{kind: string, letter: string}>} pool
   * @returns {string}
   */
  _poolToAnsi(pool) {
    return pool.map(({ kind, letter }) => {
      const L = letter.toUpperCase();
      return kind === 'green-unplaced'
        ? `${PENDING.greenFg}${L}${ANSI.reset}`
        : `${PENDING.yellowFg}${L}${ANSI.reset}`;
    }).join(' ');
  }

  /**
   * Build a tile-row string for a partially-typed word, using
   * constraint-aware colouring.  Untyped positions render as three spaces.
   *
   * @param {string|(string|null)[]} word  Letters typed so far (0–5).
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {number} [cursor=-1]  Cursor position (0–4); -1 means no cursor.
   * @returns {string}  ANSI-styled string (no leading \r, no trailing \n).
   */
  _pendingTileRow(word, constraints, cursor = -1) {
    const { slots } = this._computePending(word, constraints, cursor);
    return this._slotsToAnsi(slots);
  }

  /**
   * Overwrite the current terminal line with prompt + tile row + pool hint.
   * Appends ESC[K to erase any leftover content from a longer previous render.
   *
   * @param {string|(string|null)[]} word  Letters typed so far (0–5).
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {number} [cursor=-1]  Cursor position (0–4); -1 means no cursor.
   */
  _renderPendingLine(prompt, word, constraints, cursor = -1) {
    const { slots, pool } = this._computePending(word, constraints, cursor);
    const tileRow = this._slotsToAnsi(slots);
    const poolStr = this._poolToAnsi(pool);
    const suffix  = poolStr ? '     ' + poolStr : '';
    this.write('\r' + prompt + ' ' + tileRow + suffix + ANSI.eraseToEol);
  }

  /**
   * Process one raw key string and return the updated word-input state.
   * Shared by NodeTerminal and XtermTerminal.
   *
   * Buffer is a 5-element array of lowercase chars or null (null = empty slot).
   * Cursor ranges 0–5; it may advance past typed letters to skip a slot.
   *
   * Key semantics:
   *   ← / →        Move cursor (right can enter empty territory up to 5).
   *   Letter        Write at cursor, advance cursor.  No-op at cursor=5.
   *   Backspace     Clear slot at cursor−1, move cursor left.  No shift.
   *   Enter         Submit when all 5 slots are filled; otherwise no-op.
   *   Tab           Fill all confirmed-green positions; cursor → first empty.
   *   1–6           Load suggestion; cursor → 5.
   *   Ctrl-C        Signal exit.
   *   Other ESC seq Silently ignored.
   *
   * @param {string}            rawKey
   * @param {(string|null)[]}   buffer      5-element slot array.
   * @param {number}            cursor      Current insertion point (0–5).
   * @param {string[]}          suggestions Words mapped to keys 1–6.
   * @param {import('../../lib/constraints.mjs').ConstraintState|null} [constraints]
   *   Required for Tab autofill; ignored otherwise.
   * @returns {{ buffer: (string|null)[], cursor: number, done: boolean, exit: boolean }}
   */
  _handleWordKey(rawKey, buffer, cursor, suggestions, constraints = null) {
    if (rawKey === '\x03') return { buffer, cursor, done: false, exit: true };

    if (rawKey === '\r' || rawKey === '\n') {
      return { buffer, cursor, done: buffer.every(c => c !== null), exit: false };
    }

    if (rawKey === '\x7f' || rawKey === '\b') {
      if (cursor > 0) {
        const next = [...buffer];
        next[cursor - 1] = null;
        return { buffer: next, cursor: cursor - 1, done: false, exit: false };
      }
      return { buffer, cursor, done: false, exit: false };
    }

    if (rawKey === '\x1b[D') {  // left arrow
      return { buffer, cursor: Math.max(0, cursor - 1), done: false, exit: false };
    }

    if (rawKey === '\x1b[C') {  // right arrow — may advance into empty territory
      return { buffer, cursor: Math.min(5, cursor + 1), done: false, exit: false };
    }

    if (rawKey === '\t' && constraints) {
      const next = [...buffer];
      for (let i = 0; i < 5; i++) {
        if (constraints.known[i]) next[i] = constraints.known[i];
      }
      const firstEmpty = next.indexOf(null);
      return { buffer: next, cursor: firstEmpty === -1 ? 5 : firstEmpty, done: false, exit: false };
    }

    // Ignore all other escape sequences (up/down arrows, function keys, etc.)
    if (rawKey.startsWith('\x1b')) return { buffer, cursor, done: false, exit: false };

    const n = parseInt(rawKey, 10);
    if (n >= 1 && n <= 6 && suggestions[n - 1]) {
      return { buffer: [...suggestions[n - 1]], cursor: suggestions[n - 1].length, done: false, exit: false };
    }

    if (rawKey === ' ' && cursor < 5) {
      const next = [...buffer];
      next[cursor] = null;
      return { buffer: next, cursor: Math.min(5, cursor + 1), done: false, exit: false };
    }

    if (/^[a-zA-Z]$/.test(rawKey) && cursor < 5) {
      const next = [...buffer];
      next[cursor] = rawKey.toLowerCase();
      return { buffer: next, cursor: Math.min(5, cursor + 1), done: false, exit: false };
    }

    return { buffer, cursor, done: false, exit: false };
  }

  /**
   * Render one guess row with ANSI tile colours.
   * Appends ESC[K before the newline to erase any pool hint left on this line.
   * @param {string}   word     The guessed word.
   * @param {string[]} pattern  Array of GREEN / YELLOW / GREY constants.
   */
  writeGuessResult(word, pattern) {
    const cells = [...word].map((letter, i) => {
      const color = ANSI[pattern[i]] ?? ANSI.grey;
      return `${color} ${letter.toUpperCase()} ${ANSI.reset}`;
    });
    this.writeLine(cells.join('') + ANSI.eraseToEol);
  }
}
