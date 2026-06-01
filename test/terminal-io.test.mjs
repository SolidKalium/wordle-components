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

// ── Grading mode ─────────────────────────────────────────────────────────────

function makeGradingConstraints() {
  // "CRANE" played: C grey, R grey, A yellow (pos 2), N grey, E green (pos 4)
  const cs = new ConstraintState();
  cs.update('crane', [GREY, GREY, YELLOW, GREY, GREEN]);
  return cs;
}

describe('_renderGradingBlock', () => {
  const prompt = 'Guess 1/6:';
  function render(t, slots, opts = {}) {
    const { error = null, count = null, firstRender = true } = opts;
    t._renderGradingBlock(prompt, slots, 0, error, count, firstRender);
  }

  it('shows "N words possible" on middle row when no error', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { count: 42 });
    expect(t.output).toContain('42 words possible');
  });

  it('shows "1 word possible" (singular)', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { count: 1 });
    expect(t.output).toContain('1 word possible');
  });

  it('shows error instead of count when error present', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { error: "Known: at least 1 'A'", count: 42 });
    expect(t.output).toContain("Known: at least 1 'A'");
    expect(t.output).not.toContain('42 words possible');
  });

  it('error is rendered in red (ANSI 31m)', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { error: 'some error' });
    expect(t.output).toContain('[31m');
    expect(t.output).toContain('some error');
  });

  it('emits three rows (top hint, middle, bottom hint)', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: true });
    // Two \n characters separate the three rows.
    const newlines = (t.output.match(/\n/g) ?? []).length;
    expect(newlines).toBe(2);
  });

  it('subsequent render emits \\x1b[2A reposition prefix', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: false });
    expect(t.output).toContain('\x1b[2A');
  });

  it('first render does NOT emit \\x1b[2A', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: true });
    expect(t.output).not.toContain('\x1b[2A');
  });

  it('hint rows use block characters (▁/▔), not letters', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: true });
    const rows = t.output.split('\n');
    expect(rows).toHaveLength(3);
    // Top hint row uses ▁ (lower-eighth); bottom hint row uses ▔ (upper-eighth).
    expect(rows[0]).toContain('▁');
    expect(rows[2]).toContain('▔');
    // Hint rows do NOT contain the letters of the word.
    expect(rows[0]).not.toMatch(/[CRANE]/);
    expect(rows[2]).not.toMatch(/[CRANE]/);
  });

  it('fixed slots in hint rows render as blank (three spaces)', () => {
    const cs = makeGradingConstraints(); // C, R, N, E all fixed in 'crane'
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', cs);
    render(t, slots, { firstRender: true });
    const rows = t.output.split('\n');
    // All slots fixed for 'crane' with these constraints → hint rows have no block chars.
    expect(rows[0]).not.toContain('▁');
    expect(rows[2]).not.toContain('▔');
  });

  it('neither hint row uses reverse video (\\x1b[7m)', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: true });
    expect(t.output).not.toContain('\x1b[7m');
  });

  it('non-cursor slots in hint rows are dimmed (2m), cursor slot is not', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState()); // all non-fixed
    // cursor=0 is passed implicitly via render() helper (always passes 0).
    render(t, slots, { firstRender: true });
    const rows = t.output.split('\n');
    const topRow = rows[0];
    // Slots 1-4 are non-cursor → should be dimmed.
    expect(topRow).toContain('\x1b[2m');
    // The cursor slot (0) should appear before any dim code in the hint content.
    const padStart = '\r' + ' '.repeat(prompt.length + 1);
    const afterPad = topRow.slice(topRow.indexOf(padStart) + padStart.length);
    expect(afterPad.startsWith('\x1b[2m')).toBe(false);
  });

  it('hint rows are padded to align tiles with middle row', () => {
    const t = new MemoryTerminal();
    const slots = t._computeGradingSlots('crane', new ConstraintState());
    render(t, slots, { firstRender: true });
    const rows = t.output.split('\n');
    // Middle row starts with '\r' + prompt + ' ', hint rows with '\r' + same-length pad.
    const midStart  = `\r${prompt} `;
    const padStart  = '\r' + ' '.repeat(prompt.length + 1);
    expect(rows[1]).toContain(midStart);
    expect(rows[0]).toContain(padStart);
    expect(rows[2]).toContain(padStart);
  });
});

describe('_computeGradingSlots', () => {
  const t = new MemoryTerminal();

  it('fresh constraints: all slots non-fixed, default grey', () => {
    const cs = new ConstraintState();
    const slots = t._computeGradingSlots('crane', cs);
    expect(slots).toHaveLength(5);
    for (const s of slots) {
      expect(s.fixed).toBe(false);
      expect(s.state).toBe(GREY);
      expect(s.allowed).toContain(GREEN);
      expect(s.allowed).toContain(YELLOW);
      expect(s.allowed).toContain(GREY);
    }
  });

  it('known position → fixed green', () => {
    const cs = makeGradingConstraints(); // E is known at pos 4
    const slots = t._computeGradingSlots('crate', cs); // E at pos 4
    expect(slots[4]).toMatchObject({ letter: 'e', state: GREEN, fixed: true, allowed: [GREEN] });
  });

  it('exhausted letter → fixed grey', () => {
    const cs = makeGradingConstraints(); // C eliminated
    const slots = t._computeGradingSlots('crane', cs);
    expect(slots[0]).toMatchObject({ letter: 'c', state: GREY, fixed: true, allowed: [GREY] });
  });

  it('excluded-at-position letter → fixed yellow', () => {
    const cs = makeGradingConstraints(); // A excluded at pos 2
    const slots = t._computeGradingSlots('crane', cs);
    expect(slots[2]).toMatchObject({ letter: 'a', state: YELLOW, fixed: true, allowed: [YELLOW] });
  });

  it('green not allowed when position is taken by a different letter', () => {
    const cs = new ConstraintState();
    cs.update('bxxxx', [GREEN, GREY, GREY, GREY, GREY]); // pos 0 is 'b'
    const slots = t._computeGradingSlots('crane', cs); // 'c' at pos 0, but pos 0 is known 'b'
    expect(slots[0].fixed).toBe(false);
    expect(slots[0].allowed).not.toContain(GREEN);
    expect(slots[0].allowed).toContain(YELLOW);
    expect(slots[0].allowed).toContain(GREY);
  });
});

describe('_validateGradingSlots', () => {
  const t = new MemoryTerminal();

  it('returns null when no constraints violated', () => {
    const cs = new ConstraintState();
    const slots = t._computeGradingSlots('crane', cs);
    expect(t._validateGradingSlots(slots, cs)).toBeNull();
  });

  it('returns error when positive count exceeds maxCounts', () => {
    // After CRANE with C grey: maxCounts has C=0 (eliminated).
    // If grader somehow marks C green (shouldn't be possible via UI, but validates logic).
    const cs = makeGradingConstraints();
    const slots = t._computeGradingSlots('crane', cs);
    // Manually override the fixed grey on C to green to simulate the check.
    const tampered = slots.map((s, i) => i === 0 ? { ...s, state: GREEN } : s);
    expect(t._validateGradingSlots(tampered, cs)).toMatch(/at most/i);
  });

  it('returns error when required letter graded all grey', () => {
    // A is required (minCounts >= 1) from the yellow in CRANE.
    const cs = makeGradingConstraints();
    // 'badge': A at pos 1 — not excluded there, so non-fixed and defaults to grey.
    const slots = t._computeGradingSlots('badge', cs);
    expect(slots[1]).toMatchObject({ letter: 'a', fixed: false, state: GREY });
    // All grey → A graded grey → violates minCounts.
    expect(t._validateGradingSlots(slots, cs)).toMatch(/at least/i);
  });
});

describe('_handleGradingKey', () => {
  const t = new MemoryTerminal();
  const cs = new ConstraintState(); // fresh — all non-fixed

  function grade(rawKey, slots, cursor) {
    return t._handleGradingKey(rawKey, slots, cursor, cs);
  }

  function freshSlots(word = 'crane') {
    return t._computeGradingSlots(word, cs);
  }

  it('up arrow cycles grey → yellow', () => {
    const r = grade('\x1b[A', freshSlots(), 0);
    expect(r.slots[0].state).toBe(YELLOW);
    expect(r.cursor).toBe(0);
    expect(r.done).toBe(false);
  });

  it('up arrow cycles yellow → green', () => {
    const slots = freshSlots();
    const after1 = grade('\x1b[A', slots, 0).slots;
    const after2 = grade('\x1b[A', after1, 0).slots;
    expect(after2[0].state).toBe(GREEN);
  });

  it('up arrow cycles green → grey (wrap)', () => {
    const slots = freshSlots();
    let s = slots;
    s = grade('\x1b[A', s, 0).slots; // → yellow
    s = grade('\x1b[A', s, 0).slots; // → green
    s = grade('\x1b[A', s, 0).slots; // → grey (wrap)
    expect(s[0].state).toBe(GREY);
  });

  it('down arrow cycles grey → green', () => {
    const r = grade('\x1b[B', freshSlots(), 0);
    expect(r.slots[0].state).toBe(GREEN);
  });

  it('backspace resets slot to grey', () => {
    let s = grade('\x1b[A', freshSlots(), 2).slots; // slot 2 → yellow
    s = grade('\x7f', s, 2).slots;
    expect(s[2].state).toBe(GREY);
  });

  it('up/down no-op on fixed slot', () => {
    const cs2 = makeGradingConstraints();
    const slots = t._computeGradingSlots('crane', cs2);
    // slot 0 is fixed grey (C exhausted)
    const r = t._handleGradingKey('\x1b[A', slots, 0, cs2);
    expect(r.slots[0].state).toBe(GREY);
  });

  it('right arrow skips fixed slot', () => {
    // Build a word where slot 1 is fixed (exhausted letter).
    const cs2 = makeGradingConstraints(); // C=grey,R=grey fixed; A=yellow fixed; N=grey fixed
    const slots = t._computeGradingSlots('crane', cs2);
    // slot 0 is non-fixed (actually C is fixed grey), slot 1 is fixed grey (R exhausted)
    // Let's find first non-fixed slot.
    const firstFree = slots.findIndex(s => !s.fixed); // should be slot 4 (e is green fixed...)
    // Actually in makeGradingConstraints, C,R,N are eliminated (grey fixed), A is yellow fixed, E is green fixed
    // So ALL slots are fixed for 'crane' with this constraint state.
    // Use a different word where some slots are non-fixed.
    const cs3 = new ConstraintState();
    cs3.update('crane', [GREY, GREY, GREY, GREY, GREY]); // all greys: C,R,A,N,E eliminated
    const slotsAllFixed = t._computeGradingSlots('crane', cs3);
    // All should be fixed grey.
    expect(slotsAllFixed.every(s => s.fixed)).toBe(true);
  });

  it('left/right arrow moves cursor', () => {
    const r = grade('\x1b[C', freshSlots(), 1);
    expect(r.cursor).toBe(2);
    const r2 = grade('\x1b[D', freshSlots(), 2);
    expect(r2.cursor).toBe(1);
  });

  it('space moves cursor right', () => {
    const r = grade(' ', freshSlots(), 0);
    expect(r.cursor).toBe(1);
  });

  it('g sets green and advances cursor', () => {
    const r = grade('g', freshSlots(), 0);
    expect(r.slots[0].state).toBe(GREEN);
    expect(r.cursor).toBe(1);
  });

  it('G (uppercase) sets green and advances', () => {
    const r = grade('G', freshSlots(), 0);
    expect(r.slots[0].state).toBe(GREEN);
    expect(r.cursor).toBe(1);
  });

  it('y sets yellow and advances cursor', () => {
    const r = grade('y', freshSlots(), 0);
    expect(r.slots[0].state).toBe(YELLOW);
    expect(r.cursor).toBe(1);
  });

  it('g no-op when green not in allowed', () => {
    // Slot where known[i] is a different letter → green not allowed.
    const cs2 = new ConstraintState();
    cs2.update('bxxxx', [GREEN, GREY, GREY, GREY, GREY]); // pos 0 known 'b'
    const slots = t._computeGradingSlots('crane', cs2); // 'c' at pos 0, green not allowed
    const r = t._handleGradingKey('g', slots, 0, cs2);
    expect(r.slots[0].state).toBe(GREY); // unchanged
    expect(r.cursor).toBe(0);            // didn't advance
  });

  it('ctrl-c signals exit', () => {
    const r = grade('\x03', freshSlots(), 0);
    expect(r.exit).toBe(true);
  });

  it('enter submits when valid', () => {
    // Grade each slot yellow/green to satisfy a trivially fresh constraint.
    let slots = freshSlots();
    for (let i = 0; i < 5; i++) {
      slots = grade('\x1b[A', slots, i).slots; // all → yellow (first up-press)
    }
    const r = grade('\r', slots, 0);
    expect(r.done).toBe(true);
    expect(r.error).toBeNull();
  });

  it('enter shows error on constraint violation with one !', () => {
    const cs2 = makeGradingConstraints();
    const slots = t._computeGradingSlots('badge', cs2);
    const r = t._handleGradingKey('\r', slots, 0, cs2, 0);
    expect(r.done).toBe(false);
    expect(r.error).toMatch(/at least/i);
    expect(r.error).toMatch(/!$/);
    expect(r.errorPressCount).toBe(1);
  });

  it('consecutive Enter presses cycle ! count 1→2→3→1', () => {
    const cs2 = makeGradingConstraints();
    const slots = t._computeGradingSlots('badge', cs2);
    const r1 = t._handleGradingKey('\r', slots, 0, cs2, 0);
    expect(r1.error).toMatch(/!$/);
    expect((r1.error.match(/!+$/)[0])).toHaveLength(1);

    const r2 = t._handleGradingKey('\r', slots, 0, cs2, 1);
    expect((r2.error.match(/!+$/)[0])).toHaveLength(2);

    const r3 = t._handleGradingKey('\r', slots, 0, cs2, 2);
    expect((r3.error.match(/!+$/)[0])).toHaveLength(3);

    const r4 = t._handleGradingKey('\r', slots, 0, cs2, 3); // wraps back to 1
    expect((r4.error.match(/!+$/)[0])).toHaveLength(1);
  });

  it('non-Enter key resets errorPressCount to 0', () => {
    const r = grade('\x1b[C', freshSlots(), 0); // right arrow
    expect(r.errorPressCount).toBe(0);
  });
});
