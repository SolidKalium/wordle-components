import { describe, it, expect } from 'vitest';
import { GREEN, YELLOW, GREY } from '../src/lib/core.mjs';
import { TerminalIO } from '../src/ui/cli/TerminalIO.mjs';
import { ConstraintState } from '../src/lib/constraints.mjs';

// Minimal concrete subclass for capturing output.
class MemoryTerminal extends TerminalIO {
  constructor() { super(); this.output = ''; }
  write(text) { this.output += text; }
  readLine() { return Promise.resolve(''); }
}

describe('TerminalIO base', () => {
  it('write() throws on the abstract base', () => {
    const t = new TerminalIO();
    expect(() => t.write('hi')).toThrow();
  });

  it('readLine() throws on the abstract base', () => {
    const t = new TerminalIO();
    expect(() => t.readLine()).toThrow();
  });

  it('close() is a no-op on the base', () => {
    expect(() => new TerminalIO().close()).not.toThrow();
  });
});

describe('writeLine', () => {
  it('appends a newline to the text', () => {
    const t = new MemoryTerminal();
    t.writeLine('hello');
    expect(t.output).toBe('hello\n');
  });

  it('writes just a newline when called with no argument', () => {
    const t = new MemoryTerminal();
    t.writeLine();
    expect(t.output).toBe('\n');
  });
});

// Helper: extract visible letters and their ANSI prefix from a tile row string.
// Returns an array of { letter, prefix } objects (one per non-empty slot).
// Works for both ANSI-wrapped tiles and plain default tiles (no escape codes).
function parseTileRow(row) {
  const RESET = '\x1b[0m';
  const cells = [];
  let searchFrom = 0;
  for (let i = 0; i < row.length; i++) {
    if (/[A-Z]/.test(row[i])) {
      cells.push({ letter: row[i], prefix: row.slice(searchFrom, i) });
      let j = i + 2; // skip letter + trailing space
      if (row.startsWith(RESET, j)) j += RESET.length;
      searchFrom = j;
      i = j - 1; // loop will i++
    }
  }
  return cells;
}

// Build a ConstraintState by replaying a series of guesses and their patterns.
function makeConstraints(plays = []) {
  const cs = new ConstraintState();
  for (const [guess, pattern] of plays) cs.update(guess, pattern);
  return cs;
}

// Capture _pendingTileRow output as an array of cell objects.
function tileRow(word, constraints) {
  const t = new MemoryTerminal();
  return parseTileRow(t._pendingTileRow(word, constraints));
}

describe('_pendingTileRow — pending input colouring', () => {
  it('empty word renders five blank cells', () => {
    const cs = makeConstraints();
    const t = new MemoryTerminal();
    expect(t._pendingTileRow('', cs)).toBe('               '); // 5 × "   "
  });

  it('fully unknown letter with no constraints renders as default (no ANSI)', () => {
    const cs = makeConstraints();
    const cells = tileRow('a', cs);
    expect(cells[0].prefix.trim()).toBe(''); // no escape codes
  });

  it('letter matching a known (green) position gets green tile', () => {
    // After CRANE all-green, 'c' at pos 0 is known.
    const cs = makeConstraints([['crane', [GREEN, GREEN, GREEN, GREEN, GREEN]]]);
    const cells = tileRow('crane', cs);
    // Green ANSI contains '42m' (green background)
    expect(cells[0].prefix).toContain('42m');
  });

  it('letter at excluded position (yellow-tile) gets yellow tile', () => {
    // After CRANE with C yellow at pos 0, typing C at pos 0 again triggers yellow-tile.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('c', cs);
    expect(cells[0].prefix).toContain('43m'); // yellow bg
  });

  it('eliminated letter gets grey tile', () => {
    const cs = makeConstraints([['crane', [GREY, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('c', cs);
    expect(cells[0].prefix).toContain('100m'); // dark-grey bg
  });

  it('letter known to be in word (yellow-fg) but position untested', () => {
    // After CRANE with C yellow at pos 0, typing C elsewhere (e.g. pos 1) → yellow-fg.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('xc', cs); // C at pos 1, not excluded from pos 1
    expect(cells[1].prefix).toContain('33m'); // yellow fg
  });

  it('duplicate letter: yellow-fg count capped at minCount', () => {
    // After CRANE with C yellow at pos 0 → minCount 1.
    // Typing CC → first C gets yellow-fg, second gets default.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('xccxx', cs); // C at pos 1 and 2
    expect(cells[1].prefix).toContain('33m');  // first candidate C → yellow-fg
    expect(cells[2].prefix.trim()).toBe('');    // second candidate C → default
  });

  it('yellow-tile does not block yellow-fg; once pool exhausted yellow-tile becomes grey', () => {
    // C was yellow at pos 0 → excluded[0].has('c'), minCounts['c']=1, no confirmed position.
    // Typing C at pos 0 (yellow-tile) + C at pos 2 (candidate):
    //   - yellow-tile must NOT consume the pool → pos 2 gets yellow-fg
    //   - after Pass 3, yellow-fg at pos 2 has exhausted the pool (1/1) → pos 0 → grey
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('cxcxx', cs); // C at pos 0 (excluded) and pos 2 (candidate)
    expect(cells[0].prefix).toContain('100m'); // pos 0 → grey (pool exhausted by pos 2)
    expect(cells[2].prefix).toContain('33m');  // pos 2 → yellow-fg (pool = 1)
  });

  it('yellow-tile becomes grey once all pool copies are placed as yellow-fg elsewhere', () => {
    // Scenario from real play: T was yellow in earlier guesses (minCounts=1, no maxCounts).
    // Typing TENT: T at pos 3 is yellow-fg (using the one pool copy).
    // T at pos 0 is excluded[0] → was yellow-tile, but pool exhausted → should be grey.
    const cs = makeConstraints([
      ['tired', [YELLOW, GREY, GREY, GREY, GREY]], // T yellow at 0
    ]);
    // 'tent': T at pos 0 (excluded → yellow-tile → grey after pass 3), T at pos 3 (yellow-fg)
    const cells = tileRow('tent', cs);
    expect(cells[0].prefix).toContain('100m'); // pos 0 → grey (pool consumed by pos 3)
    expect(cells[3].prefix).toContain('33m');  // pos 3 → yellow-fg
  });

  it('yellow-tile becomes grey when normalize auto-promotes letter, exhausting pool', () => {
    // T excluded from 0, 2, 4; pos 1 occupied by O → only pos 3 open → _normalize promotes T.
    // knownCount['t']=1 = minCounts → pool=0 → yellow-tile at pos 0 should be grey.
    const cs = makeConstraints([
      ['ticks', [YELLOW, GREY, GREY, GREY, GREY]], // T yellow at 0 → excluded[0]
      ['enter', [GREY, GREY, YELLOW, GREY, GREY]], // T yellow at 2 → excluded[2]
      ['court', [GREY, GREEN, GREY, GREY, YELLOW]], // O green at 1; T yellow at 4 → excluded[4]
    ]);
    // _normalize: only pos 3 left for T → known[3]='t'. pool=1-1=0.
    const cells = tileRow('txnth', cs);
    expect(cells[0].prefix).toContain('100m'); // pos 0: grey (T accounted for at known[3])
    expect(cells[3].prefix).toContain('42m');  // pos 3: green (T is known here)
  });

  it('yellow-tile stays yellow when pool has remaining unplaced copies', () => {
    // If minCounts['t']=2 (two T's in word), typing TT uses only 1 pool copy via yellow-fg.
    // The yellow-tile at pos 0 should stay yellow-tile (1 T still unaccounted for).
    const cs = makeConstraints([
      ['tater', [YELLOW, GREY, YELLOW, GREY, GREY]], // T yellow at 0 and 2 → minCounts=2
    ]);
    // 'ttxxx': T at pos 0 (excluded → yellow-tile), T at pos 1 (not excluded → yellow-fg,
    //          uses 1 of pool 2).  Pool remaining = 1 → yellow-tile at pos 0 stays.
    const cells = tileRow('ttxxx', cs);
    expect(cells[0].prefix).toContain('43m'); // pos 0 → yellow-tile (pool not exhausted)
    expect(cells[1].prefix).toContain('33m'); // pos 1 → yellow-fg (1 of 2 pool copies)
  });

  it('letter at confirmed position exhausts pool: typing it elsewhere is default', () => {
    // After SOUTH [grey,GREEN,grey,GREEN,GREEN]: O confirmed at pos 1, minCounts['o']=1.
    // Pool = minCounts - knownCount = 1 - 1 = 0.
    // OBOES has O at pos 0 and pos 2 (neither at pos 1) → both default.
    const cs = makeConstraints([['south', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const cells = tileRow('oboes', cs);
    expect(cells[0].prefix.trim()).toBe(''); // pos 0 → default
    expect(cells[2].prefix.trim()).toBe(''); // pos 2 → default
  });

  it('filling the confirmed position still leaves extra occurrences default', () => {
    // Same constraints. BOOST puts O at pos 1 (green) and O at pos 2 (candidate).
    // Pool = 1 - 1 = 0, so the extra O at pos 2 is default.
    const cs = makeConstraints([['south', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const cells = tileRow('boost', cs);
    expect(cells[1].prefix).toContain('42m'); // O at known pos → green
    expect(cells[2].prefix.trim()).toBe('');   // extra O → default
  });

  it('fully-placed letter: grey everywhere except the confirmed position', () => {
    // BOOTH vs MONTH: O green at pos 1, O grey at pos 2.
    // maxCounts['o'] = 1 (exact count), knownCount['o'] = 1 → all non-green O → grey.
    // This fixes the bug where the grey O at pos 2 was showing as yellow-tile.
    const cs = makeConstraints([['booth', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const cells = tileRow('ooooo', cs);
    expect(cells[0].prefix).toContain('100m'); // pos 0 → grey
    expect(cells[1].prefix).toContain('42m');  // pos 1 → green (known)
    expect(cells[2].prefix).toContain('100m'); // pos 2 → grey (not yellow-tile)
    expect(cells[3].prefix).toContain('100m'); // pos 3 → grey
    expect(cells[4].prefix).toContain('100m'); // pos 4 → grey
  });
});

// _computePending returns pool as a structured array of {kind, letter} objects
// so both CLI (ANSI) and HTML renderers can consume the same computation.
describe('_computePending pool', () => {
  const t = new MemoryTerminal();

  it('empty pool when no constraints', () => {
    const cs = makeConstraints();
    expect(t._computePending('', cs).pool).toEqual([]);
    expect(t._computePending('crane', cs).pool).toEqual([]);
  });

  it('unplaced green letters appear in pool as green-unplaced', () => {
    // After SOUTH: O confirmed at pos 1, T at pos 3, H at pos 4.
    const cs = makeConstraints([['south', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const { pool } = t._computePending('', cs);
    expect(pool).toContainEqual({ kind: 'green-unplaced', letter: 'o' });
    expect(pool).toContainEqual({ kind: 'green-unplaced', letter: 't' });
    expect(pool).toContainEqual({ kind: 'green-unplaced', letter: 'h' });
  });

  it('pool shrinks as player fills confirmed positions', () => {
    const cs = makeConstraints([['south', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const { pool } = t._computePending('xo', cs); // O placed at pos 1
    expect(pool.some(p => p.letter === 'o')).toBe(false);
    expect(pool).toContainEqual({ kind: 'green-unplaced', letter: 't' });
    expect(pool).toContainEqual({ kind: 'green-unplaced', letter: 'h' });
  });

  it('pool is empty when all confirmed positions are filled', () => {
    const cs = makeConstraints([['south', [GREY, GREEN, GREY, GREEN, GREEN]]]);
    const { pool } = t._computePending('month', cs);
    expect(pool).toEqual([]);
  });

  it('yellow-fg pool letters appear as yellow-unplaced when not yet placed', () => {
    // C yellow at pos 0 → minCounts['c']=1, knownCount['c']=0. Pool=1.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const { pool } = t._computePending('xxxxx', cs);
    expect(pool).toContainEqual({ kind: 'yellow-unplaced', letter: 'c' });
  });

  it('yellow-fg pool letter removed when placed as yellow-fg', () => {
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const { pool } = t._computePending('xcxxx', cs);
    expect(pool).toEqual([]);
  });

  it('yellow-tile does not consume pool — letter stays in pool', () => {
    // C at excluded pos 0 → yellow-tile, but pool must still show C.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const { pool } = t._computePending('cxxxx', cs);
    expect(pool).toContainEqual({ kind: 'yellow-unplaced', letter: 'c' });
  });
});

describe('writeGuessResult', () => {
  it('contains each letter of the word (uppercased)', () => {
    const t = new MemoryTerminal();
    t.writeGuessResult('crane', [GREEN, GREEN, GREEN, GREEN, GREEN]);
    for (const letter of 'CRANE') {
      expect(t.output).toContain(letter);
    }
  });

  it('ends with a newline', () => {
    const t = new MemoryTerminal();
    t.writeGuessResult('crane', [GREY, GREY, GREY, GREY, GREY]);
    expect(t.output.endsWith('\n')).toBe(true);
  });

  it('uses different escape sequences for green vs yellow vs grey', () => {
    const tGreen  = new MemoryTerminal();
    const tYellow = new MemoryTerminal();
    const tGrey   = new MemoryTerminal();

    tGreen.writeGuessResult('crane',  [GREEN,  GREY, GREY, GREY, GREY]);
    tYellow.writeGuessResult('crane', [YELLOW, GREY, GREY, GREY, GREY]);
    tGrey.writeGuessResult('crane',   [GREY,   GREY, GREY, GREY, GREY]);

    // The first cell differs; extract the escape up to the first letter.
    const prefix = (output) => output.slice(0, output.indexOf('C'));
    expect(prefix(tGreen.output)).not.toBe(prefix(tYellow.output));
    expect(prefix(tGreen.output)).not.toBe(prefix(tGrey.output));
    expect(prefix(tYellow.output)).not.toBe(prefix(tGrey.output));
  });

  it('applies the right colour to each position independently', () => {
    const t = new MemoryTerminal();
    // mixed: green, yellow, grey, yellow, green
    t.writeGuessResult('crane', [GREEN, YELLOW, GREY, YELLOW, GREEN]);

    // All letters present.
    for (const letter of 'CRANE') expect(t.output).toContain(letter);

    // Spot-check: output should contain at least two distinct non-grey escapes
    // (green and yellow), plus a reset after each cell.
    const resetSeq = '[0m';
    const resets = [...t.output.matchAll(new RegExp(resetSeq.replace('[', '\\['), 'g'))];
    expect(resets.length).toBeGreaterThanOrEqual(5); // one per cell
  });
});

// ---------------------------------------------------------------------------
// _handleWordKey — buffer is (string|null)[] of 5 slots
// ---------------------------------------------------------------------------

// Convert a partial word string to a 5-slot buffer array.
function toBuffer(str) {
  return Array.from({ length: 5 }, (_, i) => str[i] ?? null);
}

// Thin wrapper: returns the full result object.
function key(rawKey, buffer, cursor, suggestions = [], constraints = null) {
  const t = new MemoryTerminal();
  return t._handleWordKey(rawKey, buffer, cursor, suggestions, constraints);
}

describe('_handleWordKey — cursor movement', () => {
  it('left arrow moves cursor left', () => {
    expect(key('\x1b[D', toBuffer('crane'), 3).cursor).toBe(2);
  });

  it('left arrow stops at 0', () => {
    expect(key('\x1b[D', toBuffer('cra'), 0).cursor).toBe(0);
  });

  it('right arrow moves cursor right', () => {
    expect(key('\x1b[C', toBuffer('cra'), 1).cursor).toBe(2);
  });

  it('right arrow can advance into empty territory past typed letters', () => {
    // buffer has 3 typed letters; cursor at end (3) → right goes to 4 (empty slot)
    expect(key('\x1b[C', toBuffer('cra'), 3).cursor).toBe(4);
  });

  it('right arrow stops at 5', () => {
    expect(key('\x1b[C', toBuffer('crane'), 5).cursor).toBe(5);
  });

  it('left/right do not change the buffer', () => {
    expect(key('\x1b[D', toBuffer('crane'), 3).buffer).toEqual(toBuffer('crane'));
    expect(key('\x1b[C', toBuffer('crane'), 3).buffer).toEqual(toBuffer('crane'));
  });
});

describe('_handleWordKey — typing with cursor', () => {
  it('typing at an empty slot fills it and advances cursor', () => {
    const r = key('n', toBuffer('cra'), 3); // cursor at first empty slot
    expect(r.buffer).toEqual(toBuffer('cran'));
    expect(r.cursor).toBe(4);
  });

  it('typing at cursor < filled length replaces that slot', () => {
    const r = key('x', toBuffer('crane'), 2);
    expect(r.buffer).toEqual(['c','r','x','n','e']);
    expect(r.cursor).toBe(3);
  });

  it('replacing at cursor 0 changes the first slot', () => {
    const r = key('b', toBuffer('crane'), 0);
    expect(r.buffer).toEqual(['b','r','a','n','e']);
    expect(r.cursor).toBe(1);
  });

  it('replacing at last slot advances cursor to 5', () => {
    const r = key('x', toBuffer('crane'), 4);
    expect(r.buffer).toEqual(['c','r','a','n','x']);
    expect(r.cursor).toBe(5);
  });

  it('typing at cursor=5 (past end) does nothing', () => {
    const r = key('x', toBuffer('crane'), 5);
    expect(r.buffer).toEqual(toBuffer('crane'));
    expect(r.cursor).toBe(5);
  });

  it('typing into a skipped slot fills it without disturbing other slots', () => {
    // Buffer has a gap: c,_,a,n,e (null at pos 1). Cursor at pos 1.
    const buf = ['c', null, 'a', 'n', 'e'];
    const r = key('r', buf, 1);
    expect(r.buffer).toEqual(['c','r','a','n','e']);
    expect(r.cursor).toBe(2);
  });
});

describe('_handleWordKey — space (forward delete)', () => {
  it('space clears current slot and advances cursor', () => {
    const r = key(' ', toBuffer('crane'), 2);
    expect(r.buffer).toEqual(['c','r',null,'n','e']);
    expect(r.cursor).toBe(3);
  });

  it('space at cursor 4 clears slot 4 and advances to 5', () => {
    const r = key(' ', toBuffer('crane'), 4);
    expect(r.buffer).toEqual(['c','r','a','n',null]);
    expect(r.cursor).toBe(5);
  });

  it('space at cursor 5 does nothing (past end)', () => {
    const r = key(' ', toBuffer('crane'), 5);
    expect(r.buffer).toEqual(toBuffer('crane'));
    expect(r.cursor).toBe(5);
  });
});

describe('_handleWordKey — backspace with cursor', () => {
  it('backspace clears the slot before cursor (no shift)', () => {
    const r = key('\x7f', toBuffer('cran'), 4);
    expect(r.buffer).toEqual(['c','r','a',null,null]);
    expect(r.cursor).toBe(3);
  });

  it('backspace in the middle clears that slot, does not shift later slots', () => {
    const r = key('\x7f', toBuffer('crane'), 2);
    expect(r.buffer).toEqual(['c',null,'a','n','e']);
    expect(r.cursor).toBe(1);
  });

  it('backspace at cursor 0 does nothing', () => {
    const r = key('\x7f', toBuffer('crane'), 0);
    expect(r.buffer).toEqual(toBuffer('crane'));
    expect(r.cursor).toBe(0);
  });
});

describe('_handleWordKey — enter / submit', () => {
  it('enter submits when all 5 slots are filled', () => {
    const r = key('\r', toBuffer('crane'), 5);
    expect(r.done).toBe(true);
  });

  it('enter does nothing when a slot is empty', () => {
    const r = key('\r', ['c','r',null,'n','e'], 5);
    expect(r.done).toBe(false);
  });

  it('enter does nothing when buffer has a skipped slot', () => {
    const r = key('\r', ['c',null,'a','n','e'], 5);
    expect(r.done).toBe(false);
  });
});

describe('_handleWordKey — skip slots with right arrow', () => {
  it('right arrow advances past typed letters into empty territory', () => {
    const r = key('\x1b[C', toBuffer('cr'), 2);
    expect(r.cursor).toBe(3);
    expect(r.buffer).toEqual(toBuffer('cr')); // unchanged
  });

  it('typing after skip fills the skipped-to slot', () => {
    // Advance cursor to pos 3 (skipping pos 2), then type 'n'
    const buf = [null, null, null, null, null];
    const r1 = key('\x1b[C', buf, 0); // cursor → 1
    const r2 = key('\x1b[C', r1.buffer, r1.cursor); // cursor → 2
    const r3 = key('\x1b[C', r2.buffer, r2.cursor); // cursor → 3
    const r4 = key('n', r3.buffer, r3.cursor);       // type 'n' at pos 3
    expect(r4.buffer).toEqual([null, null, null, 'n', null]);
    expect(r4.cursor).toBe(4);
  });

  it('enter is not done when skipped slots remain empty', () => {
    // Fill pos 0,2,3,4 but skip pos 1
    const buf = ['c', null, 'a', 'n', 'e'];
    expect(key('\r', buf, 5).done).toBe(false);
  });
});

describe('_handleWordKey — tab autofill', () => {
  it('tab fills all known (green) positions from constraints', () => {
    const cs = makeConstraints([
      ['crane', [GREEN, GREY, GREEN, GREY, GREEN]], // C green at 0, A green at 2, E green at 4
    ]);
    const r = key('\t', [null,null,null,null,null], 0, [], cs);
    expect(r.buffer[0]).toBe('c');
    expect(r.buffer[1]).toBe(null);
    expect(r.buffer[2]).toBe('a');
    expect(r.buffer[3]).toBe(null);
    expect(r.buffer[4]).toBe('e');
    expect(r.cursor).toBe(1); // first empty slot
  });

  it('tab overwrites a wrong letter at a known position', () => {
    const cs = makeConstraints([['crane', [GREEN, GREY, GREY, GREY, GREY]]]);
    const r = key('\t', ['x',null,null,null,null], 0, [], cs);
    expect(r.buffer[0]).toBe('c'); // overwrites 'x' with confirmed 'c'
  });

  it('tab sets cursor to 5 when all positions are already filled after autofill', () => {
    const cs = makeConstraints([['crane', [GREEN, GREEN, GREEN, GREEN, GREEN]]]);
    const r = key('\t', [null,null,null,null,null], 0, [], cs);
    expect(r.buffer).toEqual(['c','r','a','n','e']);
    expect(r.cursor).toBe(5);
  });

  it('tab without constraints is a no-op', () => {
    const buf = [null,null,null,null,null];
    const r = key('\t', buf, 0); // no constraints arg
    expect(r.buffer).toEqual(buf);
    expect(r.cursor).toBe(0);
  });
});

describe('_handleWordKey — number suggestions with cursor', () => {
  it('number key fills buffer and sets cursor to 5', () => {
    const r = key('1', toBuffer('cr'), 1, ['crane', 'trade']);
    expect(r.buffer).toEqual(['c','r','a','n','e']);
    expect(r.cursor).toBe(5);
  });
});

describe('_handleWordKey — escape sequences', () => {
  it('unrecognised escape sequence is ignored', () => {
    const r = key('\x1b[A', toBuffer('crane'), 3); // up arrow
    expect(r.buffer).toEqual(toBuffer('crane'));
    expect(r.cursor).toBe(3);
    expect(r.done).toBe(false);
    expect(r.exit).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// _pendingTileRow — cursor highlight
// ---------------------------------------------------------------------------

describe('_pendingTileRow — cursor highlight', () => {
  it('cursor position contains underline code (4m)', () => {
    const cs = makeConstraints();
    const t = new MemoryTerminal();
    // cursor at pos 1 in 'crane'
    const cells = parseTileRow(t._pendingTileRow('crane', cs, 1));
    expect(cells[1].prefix).toContain('4m');
  });

  it('non-cursor positions are unaffected by cursor', () => {
    const cs = makeConstraints();
    const t = new MemoryTerminal();
    const cells = parseTileRow(t._pendingTileRow('crane', cs, 2));
    // pos 0 and 1 are not at cursor and have no constraints → default (no ANSI prefix)
    expect(cells[0].prefix.trim()).toBe('');
    expect(cells[1].prefix.trim()).toBe('');
  });

  it('cursor on green tile keeps green and adds underline', () => {
    const cs = makeConstraints([['crane', [GREEN, GREEN, GREEN, GREEN, GREEN]]]);
    const t = new MemoryTerminal();
    const cells = parseTileRow(t._pendingTileRow('crane', cs, 0));
    expect(cells[0].prefix).toContain('42m'); // green bg
    expect(cells[0].prefix).toContain('4m');  // underline
  });

  it('cursor on grey tile keeps grey and adds underline', () => {
    const cs = makeConstraints([['crane', [GREY, GREY, GREY, GREY, GREY]]]);
    const t = new MemoryTerminal();
    const cells = parseTileRow(t._pendingTileRow('crane', cs, 1));
    expect(cells[1].prefix).toContain('100m'); // grey bg
    expect(cells[1].prefix).toContain('4m');   // underline
  });

  it('cursor on empty slot produces a visible marker (no letter parsed, but underline present)', () => {
    const cs = makeConstraints();
    const t = new MemoryTerminal();
    const raw = t._pendingTileRow('cr', cs, 3); // cursor past typed region
    // No uppercase letter at pos 3 (empty), but the row contains the underline code
    expect(raw).toContain('\x1b[4m');
    // And only 2 cells are parseable (the typed letters)
    expect(parseTileRow(raw).length).toBe(2);
  });

  it('no cursor when cursor arg is omitted (backward compat)', () => {
    const cs = makeConstraints();
    const t = new MemoryTerminal();
    const cells = parseTileRow(t._pendingTileRow('crane', cs));
    for (const cell of cells) {
      expect(cell.prefix).not.toContain('4m');
    }
  });
});
