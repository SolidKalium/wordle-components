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

  it('yellow-tile at one position does not block yellow-fg at another', () => {
    // C was yellow at pos 0 → excluded[0].has('c'), minCounts['c']=1, no confirmed position.
    // Typing C at pos 0 (yellow-tile) + C at pos 2 (candidate): the yellow-tile must not
    // consume the pool, so pos 2 should still get yellow-fg.
    const cs = makeConstraints([['crane', [YELLOW, GREY, GREY, GREY, GREY]]]);
    const cells = tileRow('cxcxx', cs); // C at pos 0 (excluded) and pos 2 (candidate)
    expect(cells[0].prefix).toContain('43m'); // pos 0 → yellow-tile (bg)
    expect(cells[2].prefix).toContain('33m'); // pos 2 → yellow-fg (pool still = 1)
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
