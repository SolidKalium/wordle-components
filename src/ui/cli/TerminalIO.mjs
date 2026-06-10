import { GREEN, YELLOW, GREY } from '../../lib/core.mjs';
import { computePendingSlots } from '../../lib/pendingWord.mjs';

// ANSI escape sequences for Wordle tile colours.
// Each entry covers background + text colour; follow with a letter then RESET.
const ANSI = {
  [GREEN]:  '\x1b[42m\x1b[1m\x1b[97m',   // green bg,      bold bright-white
  [YELLOW]: '\x1b[43m\x1b[1m\x1b[30m',   // yellow bg,     bold black (contrast)
  grey:     '\x1b[100m\x1b[1m\x1b[97m',  // dark-grey bg,  bold bright-white
  reset:    '\x1b[0m',
  eraseToEol: '\x1b[K',                   // clear from cursor to end of line
  underline: '\x1b[4m',                   // underline on   — used for cursor highlight
  red:       '\x1b[31m',                  // red fg         — validation errors
};

const PENDING = {
  yellowFg: '\x1b[33m',         // yellow fg — letter in word, position unknown
  greenFg:  '\x1b[1m\x1b[32m', // bold green fg — confirmed letter not yet placed
};

// Colours for the grading hint-row block characters.
// Top row uses ▂ (lower-quarter) with fg colour — produces a strip at the bottom
// of each cell, adjacent to the main tile row below.
// Bottom row uses ▆ (lower-three-quarters) inverted (bg=colour, fg=black) so that
// only the upper quarter of each cell shows colour, adjacent to the main row above.
const STRIP = {
  [GREEN]:  { fg: '\x1b[32m', bg: '\x1b[42m' },
  [YELLOW]: { fg: '\x1b[33m', bg: '\x1b[43m' },
  grey:     { fg: '\x1b[90m', bg: '\x1b[100m' },
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
   * Write `message` then wait for the user to press Ctrl-Z (undo) or Enter/Ctrl-C (quit).
   * Returns 'undo' or 'quit'.  Used when the word pool is fully exhausted.
   * @param {string} message
   * @returns {Promise<'undo'|'quit'>}
   */
  readUndoOrQuit(_message) {
    throw new Error(`${this.constructor.name}.readUndoOrQuit() not implemented`);
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
    const { slots } = computePendingSlots(word, constraints, cursor);
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
    const { slots, pool } = computePendingSlots(word, constraints, cursor);
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

  // ── Grading mode (human grades the computer's guess) ─────────────────────

  /**
   * Compute per-slot grading state for a word the computer has just guessed.
   *
   * Each slot describes the letter, its current colour, whether it is fixed
   * (determined entirely by existing constraints — the user cannot change it),
   * and the ordered list of colours the user may cycle through with Up/Down.
   *
   * Cycle order (Up advances): grey → yellow → green → grey.
   * Fixed slots have a single-element `allowed` array.
   *
   * @param {string}   word         The computer's guessed word (5 chars).
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @returns {Array<{letter:string, state:string, fixed:boolean, allowed:string[]}>}
   */
  _computeGradingSlots(word, constraints) {
    const slots = [];
    for (let i = 0; i < 5; i++) {
      const L = word[i].toLowerCase();

      if (constraints.known[i] === L) {
        slots.push({ letter: L, state: GREEN, fixed: true, allowed: [GREEN] });
        continue;
      }
      if (constraints.isExhausted(L)) {
        slots.push({ letter: L, state: GREY, fixed: true, allowed: [GREY] });
        continue;
      }
      if (constraints.excluded[i].has(L)) {
        slots.push({ letter: L, state: YELLOW, fixed: true, allowed: [YELLOW] });
        continue;
      }

      // Non-fixed: green allowed unless a different letter is confirmed at this position.
      const greenAllowed = constraints.known[i] === null;
      const allowed = [GREY, YELLOW];
      if (greenAllowed) allowed.push(GREEN);
      slots.push({ letter: L, state: GREY, fixed: false, allowed });
    }
    return slots;
  }

  /**
   * Convert a grading slots array to an ANSI tile-row string.
   * The slot at `cursor` receives an underline highlight.
   *
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {number} cursor  0–4; -1 = no cursor.
   * @returns {string}
   */
  _gradingSlotsToAnsi(slots, cursor = -1) {
    return slots.map(({ letter, state }, i) => {
      const ul    = (i === cursor) ? ANSI.underline : '';
      const color = ANSI[state] ?? ANSI.grey;
      return `${ul}${color} ${letter.toUpperCase()} ${ANSI.reset}`;
    }).join('');
  }

  /**
   * Build one hint-row ANSI string showing what Up (+1) or Down (-1) would
   * cycle each slot to.
   *
   * Top row (dir=+1): ▁▁▁ (lower-eighth block) with fg=colour — the strip
   * appears at the bottom of the character cell, flush against the tile row below.
   *
   * Bottom row (dir=-1): ▔▔▔ (upper-eighth block) with fg=colour — the strip
   * appears at the top of the character cell, flush against the tile row above.
   * Unicode has no "upper quarter" block; ▔ (upper eighth) is the closest option
   * that keeps colour in the foreground, so dim works the same way as the top row.
   *
   * Non-cursor slots are dimmed (2m) to make the active slot visually distinct.
   * Fixed slots render as three spaces (no indicator — they cannot change).
   *
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {+1|-1} dir     +1 = top hint row, -1 = bottom hint row.
   * @param {number} cursor  0–4; slot at this index is NOT dimmed.  -1 = no dimming.
   * @returns {string}
   */
  _hintRowAnsi(slots, dir, cursor = -1) {
    return slots.map(({ state, fixed, allowed }, i) => {
      if (fixed) return '   ';
      const nextState = allowed[(allowed.indexOf(state) + dir + allowed.length) % allowed.length];
      const colors    = STRIP[nextState] ?? STRIP.grey;
      const dim       = (cursor !== -1 && i !== cursor) ? '\x1b[2m' : '';
      const char      = dir === +1 ? '▁▁▁' : '▔▔▔';
      return `${dim}${colors.fg}${char}${ANSI.reset}`;
    }).join('');
  }

  /**
   * Render the three-row grading block:
   *   top row    — dim hint tiles showing what Up would cycle to
   *   middle row — active grading tiles with cursor underline + annotation
   *   bottom row — dim hint tiles showing what Down would cycle to
   *
   * On the first render the block is written from the current cursor position.
   * On subsequent renders `\x1b[2A` repositions to the top of the block first.
   *
   * @param {string} prompt
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {number} cursor
   * @param {string|null} [error]
   * @param {number|null} [remainingCount]
   * @param {boolean} [firstRender=false]
   */
  _renderGradingBlock(prompt, slots, cursor, error = null, remainingCount = null, firstRender = false) {
    const pad    = ' '.repeat(prompt.length + 1); // align hint rows with tile columns
    const top    = pad + this._hintRowAnsi(slots, +1, cursor);
    const mid    = prompt + ' ' + this._gradingSlotsToAnsi(slots, cursor);
    const bot    = pad + this._hintRowAnsi(slots, -1, cursor);
    const annotation = error
      ? '     ' + ANSI.red + error + ANSI.reset
      : remainingCount !== null
        ? `     ${remainingCount} ${remainingCount === 1 ? 'word' : 'words'} possible`
        : '';
    const reposition = firstRender ? '' : '\x1b[2A';
    this.write(
      reposition +
      '\r' + top + ANSI.eraseToEol + '\n' +
      '\r' + mid + annotation + ANSI.eraseToEol + '\n' +
      '\r' + bot + ANSI.eraseToEol
    );
  }

  /**
   * Validate a completed grading against known constraints.
   * Only cross-letter count checks — per-letter state is already enforced by
   * the fixed/allowed system.
   *
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @returns {string|null}  Error message, or null if valid.
   */
  _validateGradingSlots(slots, constraints) {
    // Tally yellow+green count per letter across the guessed word.
    const positiveCount = new Map();
    for (const { letter, state } of slots) {
      if (state !== GREY) positiveCount.set(letter, (positiveCount.get(letter) ?? 0) + 1);
    }

    for (const [letter, count] of positiveCount) {
      const max = constraints.maxCounts.get(letter);
      if (max !== undefined && count > max) {
        return `Known: at most ${max} '${letter.toUpperCase()}'`;
      }
    }
    // Also check letters the word uses that have a minimum — must meet minCounts.
    for (const { letter } of slots) {
      const min = constraints.minCounts.get(letter) ?? 0;
      if (min > 0 && (positiveCount.get(letter) ?? 0) < min) {
        return `Known: at least ${min} '${letter.toUpperCase()}'`;
      }
    }
    return null;
  }

  /**
   * Move cursor left or right, skipping fixed slots.
   * Stops at 0 (leftward) or 4 (rightward) if no non-fixed slot exists further.
   *
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {number} cursor  Current position (0–4).
   * @param {number} dir     +1 or -1.
   * @returns {number}  New cursor position.
   */
  _gradingMoveCursor(slots, cursor, dir) {
    let next = cursor + dir;
    while (next >= 0 && next < 5) {
      if (!slots[next].fixed) return next;
      next += dir;
    }
    return cursor;
  }

  /**
   * Process one raw key in grading mode and return the updated state.
   *
   * Key semantics:
   *   ← / → / A / D   Move cursor (skipping fixed slots).
   *   Space            Advance cursor right (forward).
   *   ↑ / W            Cycle colour forward  (grey → yellow → green → grey).
   *   ↓ / S            Cycle colour backward (grey → green → yellow → grey).
   *   g / G     Set current slot green  (if allowed) and advance cursor.
   *   y / Y     Set current slot yellow (if allowed) and advance cursor.
   *   Backspace Reset current slot to grey (no-op on fixed).
   *   Enter     Validate and submit.
   *   Ctrl-C    Signal exit.
   *   Ctrl-Z    Signal undo (caller collapses block and returns null to GradingRunner).
   *
   * @param {string}   rawKey
   * @param {ReturnType<TerminalIO['_computeGradingSlots']>} slots
   * @param {number}   cursor
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {number}   [errorPressCount=0]  How many consecutive Enter presses have shown the current error.
   * @returns {{ slots, cursor: number, done: boolean, exit: boolean, undo: boolean, error: string|null, errorPressCount: number }}
   */
  _handleGradingKey(rawKey, slots, cursor, constraints, errorPressCount = 0) {
    const ok = (s, c, err = null) => ({ slots: s, cursor: c, done: false, exit: false, undo: false, error: err, errorPressCount: 0 });

    if (rawKey === '\x03') return { slots, cursor, done: false, exit: true,  undo: false, error: null, errorPressCount: 0 };
    if (rawKey === '\x1a') return { slots, cursor, done: false, exit: false, undo: true,  error: null, errorPressCount: 0 };

    if (rawKey === '\r' || rawKey === '\n') {
      const baseError = this._validateGradingSlots(slots, constraints);
      if (baseError) {
        const nextCount = (errorPressCount % 3) + 1;
        return { slots, cursor, done: false, exit: false, undo: false, error: baseError + '!'.repeat(nextCount), errorPressCount: nextCount };
      }
      return { slots, cursor, done: true, exit: false, undo: false, error: null, errorPressCount: 0 };
    }

    if (rawKey === '\x1b[D' || rawKey === 'a' || rawKey === 'A') return ok(slots, this._gradingMoveCursor(slots, cursor, -1));
    if (rawKey === '\x1b[C' || rawKey === 'd' || rawKey === 'D' || rawKey === ' ') return ok(slots, this._gradingMoveCursor(slots, cursor, +1));

    if (rawKey === '\x1b[A' || rawKey === 'w' || rawKey === 'W' ||
        rawKey === '\x1b[B' || rawKey === 's' || rawKey === 'S') {  // up / down arrow or W / S
      const slot = slots[cursor];
      if (slot.fixed) return ok(slots, cursor);
      const dir   = (rawKey === '\x1b[A' || rawKey === 'w' || rawKey === 'W') ? +1 : -1;
      const idx   = slot.allowed.indexOf(slot.state);
      const next  = (idx + dir + slot.allowed.length) % slot.allowed.length;
      const updated = slots.map((s, i) => i === cursor ? { ...s, state: s.allowed[next] } : s);
      return ok(updated, cursor);
    }

    if (rawKey === '\x7f' || rawKey === '\b') {
      const slot = slots[cursor];
      if (slot.fixed || slot.state === GREY) return ok(slots, cursor);
      const updated = slots.map((s, i) => i === cursor ? { ...s, state: GREY } : s);
      return ok(updated, cursor);
    }

    if (rawKey === 'g' || rawKey === 'G') {
      const slot = slots[cursor];
      if (!slot.fixed && slot.allowed.includes(GREEN)) {
        const updated = slots.map((s, i) => i === cursor ? { ...s, state: GREEN } : s);
        return ok(updated, this._gradingMoveCursor(updated, cursor, +1));
      }
      return ok(slots, cursor);
    }

    if (rawKey === 'y' || rawKey === 'Y') {
      const slot = slots[cursor];
      if (!slot.fixed && slot.allowed.includes(YELLOW)) {
        const updated = slots.map((s, i) => i === cursor ? { ...s, state: YELLOW } : s);
        return ok(updated, this._gradingMoveCursor(updated, cursor, +1));
      }
      return ok(slots, cursor);
    }

    if (rawKey.startsWith('\x1b')) return ok(slots, cursor);

    return ok(slots, cursor);
  }

  /**
   * Render one guess row with ANSI tile colours.
   * Appends ESC[K before the newline to erase any leftover content on this line.
   * @param {string}   word     The guessed word.
   * @param {string[]} pattern  Array of GREEN / YELLOW / GREY constants.
   * @param {string}   [suffix='']  Optional annotation appended after the tiles.
   */
  writeGuessResult(word, pattern, suffix = '') {
    const cells = [...word].map((letter, i) => {
      const color = ANSI[pattern[i]] ?? ANSI.grey;
      return `${color} ${letter.toUpperCase()} ${ANSI.reset}`;
    });
    this.writeLine(cells.join('') + suffix + ANSI.eraseToEol);
  }
}
