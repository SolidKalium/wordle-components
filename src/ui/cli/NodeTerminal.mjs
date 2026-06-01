import { createInterface } from 'node:readline';
import { GREEN, YELLOW, GREY } from '../../lib/core.mjs';
import { TerminalIO } from './TerminalIO.mjs';

/**
 * TerminalIO adapter for Node.js process stdio.
 *
 * Uses readline for line-buffered input so the user sees their characters
 * echoed and can use backspace before pressing Enter.
 */
export class NodeTerminal extends TerminalIO {
  constructor() {
    super();
    this._rl = createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    // Prevent readline from keeping the process alive on its own.
    this._rl.on('close', () => {});
  }

  write(text) {
    process.stdout.write(text);
  }

  readLine(prompt = '') {
    return new Promise(resolve => {
      this._rl.question(prompt, answer => resolve(answer));
    });
  }

  /**
   * Enter raw mode and read one complete 5-letter word from the player.
   *
   * Renders `prompt + tile row` on every keystroke using constraint-aware
   * colouring.  Number keys 1–6 load the corresponding suggestion into the
   * buffer without submitting.  Falls back to readLine on non-TTY stdin.
   *
   * Caller is responsible for finalising the line after this resolves
   * (e.g. overwriting with the graded result via \r).
   *
   * @param {string}   prompt       e.g. "Guess 1/6:"
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {string[]} [suggestions=[]]  Words mapped to number keys 1–6.
   * @returns {Promise<string>}  Submitted word, 5 chars, lowercase.
   */
  async readWordRaw(prompt, constraints, suggestions = []) {
    if (!process.stdin.isTTY) {
      return (await this.readLine(prompt + ' ')).trim().toLowerCase();
    }

    // Hand stdin over from readline to our raw data loop.
    this._rl.close();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdout.write('\x1b[?25l'); // hide the blinking cursor while we own the line

    return new Promise(resolve => {
      let buffer = [null, null, null, null, null];
      let cursor = 0;

      const cleanup = () => {
        process.stdout.write('\x1b[?25h'); // restore cursor before handing control back
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        this._rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        this._rl.on('close', () => {});
      };

      const onData = (rawKey) => {
        const { buffer: next, cursor: nextCursor, done, exit } =
          this._handleWordKey(rawKey, buffer, cursor, suggestions, constraints);
        buffer = next;
        cursor = nextCursor;

        if (exit) { cleanup(); process.stdout.write('\n'); process.exit(0); }
        if (done) { cleanup(); resolve(buffer.join('')); return; }
        this._renderPendingLine(prompt, buffer, constraints, cursor);
      };

      process.stdin.on('data', onData);
      this._renderPendingLine(prompt, buffer, constraints, cursor);
    });
  }

  /**
   * Enter raw mode and let the human grade the computer's guessed word.
   *
   * Renders a coloured tile row the player navigates with arrow keys, cycling
   * each letter through grey / yellow / green.  Fixed slots (determined by
   * existing constraints) cannot be changed.
   *
   * Falls back to readLine on non-TTY stdin (returns a 5-char pattern string
   * expected as uppercase G/Y/_ characters, then converted to the constant array).
   *
   * @param {string}   prompt
   * @param {string}   word            The computer's 5-letter guess.
   * @param {import('../../lib/constraints.mjs').ConstraintState} constraints
   * @param {number|null} [remainingCount]  Words still possible before this guess.
   * @returns {Promise<string[]>}  5-element pattern array (GREEN/YELLOW/GREY constants).
   */
  async readGradingRaw(prompt, word, constraints, remainingCount = null) {
    if (!process.stdin.isTTY) {
      const line = (await this.readLine(prompt + ' [grade G/Y/_] ')).trim().toUpperCase();
      return [...line.padEnd(5, '_')].slice(0, 5).map(c =>
        c === 'G' ? GREEN : c === 'Y' ? YELLOW : GREY
      );
    }

    this._rl.close();
    process.stdin.setRawMode(true);
    process.stdin.setEncoding('utf8');
    process.stdin.resume();
    process.stdout.write('\x1b[?25l');

    return new Promise(resolve => {
      let slots           = this._computeGradingSlots(word, constraints);
      let cursor          = slots.findIndex(s => !s.fixed);
      let error           = null;
      let errorPressCount = 0;

      if (cursor === -1) {
        // All slots fixed — nothing for the user to grade; resolve immediately.
        process.stdout.write('\x1b[?25h');
        process.stdin.setRawMode(false);
        process.stdin.pause();
        this._rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        this._rl.on('close', () => {});
        resolve(slots.map(s => s.state));
        return;
      }

      const cleanup = () => {
        process.stdout.write('\x1b[?25h');
        process.stdin.removeListener('data', onData);
        process.stdin.setRawMode(false);
        process.stdin.pause();
        this._rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
        this._rl.on('close', () => {});
      };

      const onData = (rawKey) => {
        const result = this._handleGradingKey(rawKey, slots, cursor, constraints, errorPressCount);
        slots           = result.slots;
        cursor          = result.cursor;
        error           = result.error;
        errorPressCount = result.errorPressCount;

        if (result.exit) { cleanup(); process.stdout.write('\n'); process.exit(0); }
        if (result.done) {
          // Collapse the 3-row block to a single line so the caller can
          // overwrite it with the final scored result.
          process.stdout.write('\x1b[2A\r\x1b[J');
          cleanup();
          resolve(slots.map(s => s.state));
          return;
        }
        this._renderGradingBlock(prompt, slots, cursor, error, remainingCount, false);
      };

      process.stdin.on('data', onData);
      this._renderGradingBlock(prompt, slots, cursor, error, remainingCount, true);
    });
  }

  close() {
    this._rl.close();
  }
}
