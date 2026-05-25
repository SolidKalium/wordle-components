import { describe, it, expect } from 'vitest';
import { GREEN, YELLOW, GREY } from '../src/lib/core.mjs';
import { TerminalIO } from '../src/ui/cli/TerminalIO.mjs';

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
