import { GREEN, YELLOW } from '../../lib/core.mjs';

// ANSI escape sequences for Wordle tile colours.
// Each entry covers background + text colour; follow with a letter then RESET.
const ANSI = {
  [GREEN]:  '[42m[1m[97m',   // green bg,      bold bright-white
  [YELLOW]: '[43m[1m[30m',   // yellow bg,     bold black (contrast)
  grey:     '[100m[1m[97m',  // dark-grey bg,  bold bright-white
  reset:    '[0m',
  eraseToEol: '[K',                        // clear from cursor to end of line
};

const PENDING = {
  yellowFg: '[33m',         // yellow fg — letter in word, position unknown
  greenFg:  '[1m[32m', // bold green fg — confirmed letter not yet placed
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
   * Compute slots and pool for a partially-typed word.
   * Shared by _pendingTileRow (tests) and _renderPendingLine (live display).
   *
   * @param {string} word
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @returns {{ tileRow: string, pool: string }}
   */
  _computePending(word, constraints) {
    // Pre-compute confirmed positions per letter — used in both the
    // fully-placed check (Pass 1) and the yellow-fg pool (Pass 2).
    const knownCount = new Map();
    for (const L of constraints.known) {
      if (L) knownCount.set(L, (knownCount.get(L) ?? 0) + 1);
    }

    // Pass 1: assign high-priority colours per position.
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const letter = word[i];
      if (!letter) { slots.push({ kind: 'empty', letter }); continue; }
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

    // Build tile row.
    const tileRow = slots.map(s => {
      const u = s.letter?.toUpperCase();
      switch (s.kind) {
        case 'empty':       return '   ';
        case 'green':       return `${ANSI[GREEN]} ${u} ${ANSI.reset}`;
        case 'yellow-tile': return `${ANSI[YELLOW]} ${u} ${ANSI.reset}`;
        case 'grey':        return `${ANSI.grey} ${u} ${ANSI.reset}`;
        case 'yellow-fg':   return `${PENDING.yellowFg} ${u} ${ANSI.reset}`;
        default:            return ` ${u} `;
      }
    }).join('');

    // Build pool: unplaced greens (position order) then remaining yellow-fg (alphabetical).
    const poolParts = [];
    for (let i = 0; i < 5; i++) {
      const L = constraints.known[i];
      if (L && slots[i].kind !== 'green') {
        poolParts.push(`${PENDING.greenFg}${L.toUpperCase()}${ANSI.reset}`);
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
      poolParts.push(`${PENDING.yellowFg}${L.toUpperCase()}${ANSI.reset}`);
    }

    return { tileRow, pool: poolParts.join(' ') };
  }

  /**
   * Build a 15-character tile row for a partially-typed word, using
   * constraint-aware colouring.  Untyped positions render as three spaces.
   *
   * @param {string} word  Letters typed so far (0–5 chars, lowercase).
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @returns {string}  ANSI-styled string (no leading \r, no trailing \n).
   */
  _pendingTileRow(word, constraints) {
    return this._computePending(word, constraints).tileRow;
  }

  /**
   * Overwrite the current terminal line with prompt + tile row + pool hint.
   * Appends ESC[K to erase any leftover content from a longer previous render.
   *
   * @param {string} prompt
   * @param {string} word  Letters typed so far (0–5 chars, lowercase).
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   */
  _renderPendingLine(prompt, word, constraints) {
    const { tileRow, pool } = this._computePending(word, constraints);
    const suffix = pool ? '     ' + pool : '';
    this.write('\r' + prompt + ' ' + tileRow + suffix + ANSI.eraseToEol);
  }

  /**
   * Process one raw key string from a platform keypress source and return the
   * updated word-input state.  Shared by NodeTerminal and XtermTerminal so
   * the key semantics are identical in both environments.
   *
   * @param {string}   rawKey      Single character or control sequence.
   * @param {string}   buffer      Current input buffer (0–5 lowercase chars).
   * @param {string[]} suggestions Words mapped to number keys 1–6.
   * @returns {{ buffer: string, done: boolean, exit: boolean }}
   */
  _handleWordKey(rawKey, buffer, suggestions) {
    if (rawKey === '') return { buffer, done: false, exit: true };

    if (rawKey === '\r' || rawKey === '\n') {
      return { buffer, done: buffer.length === 5, exit: false };
    }

    if (rawKey === '' || rawKey === '\b') {
      return { buffer: buffer.slice(0, -1), done: false, exit: false };
    }

    const n = parseInt(rawKey, 10);
    if (n >= 1 && n <= 6 && suggestions[n - 1]) {
      return { buffer: suggestions[n - 1], done: false, exit: false };
    }

    if (/^[a-zA-Z]$/.test(rawKey) && buffer.length < 5) {
      return { buffer: buffer + rawKey.toLowerCase(), done: false, exit: false };
    }

    return { buffer, done: false, exit: false };
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
